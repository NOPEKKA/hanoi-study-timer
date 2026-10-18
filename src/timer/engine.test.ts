import { describe, expect, it } from 'vitest';
import { changeMultiplier, createEndlessRun, endlessEndElapsedMs, endlessProgress, type EndlessRun } from '../modes/endless';
import { estimatedCompletion, planTarget, scheduleProgress, TARGET_CONFIG, LIFTER_CONFIG } from '../modes/targetPlan';
import { clockElapsed, clockPause, clockStart, IDLE_CLOCK } from './clock';
import { TimerEngine, type EngineEnv } from './engine';

/** สภาพแวดล้อมปลอม: ควบคุมเวลาเอง, rAF ทำงานทุก 16 ms (หรือหยุดได้เหมือนแท็บถูกซ่อน) */
function fakeEnv() {
  let now = 1_000;
  let nextId = 1;
  const frames = new Map<number, () => void>();
  const timers = new Map<number, { at: number; cb: () => void }>();
  let requestCount = 0;
  const env: EngineEnv = {
    now: () => now,
    requestFrame: (cb) => {
      requestCount++;
      const id = nextId++;
      frames.set(id, cb);
      return id;
    },
    cancelFrame: (id) => void frames.delete(id),
    setTimer: (cb, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, cb });
      return id;
    },
    clearTimer: (id) => void timers.delete(id),
  };
  const fireTimers = () => {
    for (const [id, t] of [...timers]) {
      if (t.at <= now && timers.has(id)) {
        timers.delete(id);
        t.cb();
      }
    }
  };
  return {
    env,
    get now() {
      return now;
    },
    get frames() {
      return frames.size;
    },
    get timers() {
      return timers.size;
    },
    get requestCount() {
      return requestCount;
    },
    /** เดินเวลา ms โดยมีเฟรมทุก frameMs (visible=false = แท็บซ่อน ไม่มีเฟรม) */
    advance(ms: number, { frameMs = 16, visible = true } = {}) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + frameMs);
        fireTimers();
        if (visible) {
          const pending = [...frames];
          frames.clear();
          for (const [, cb] of pending) cb();
        }
      }
    },
  };
}

function makeEngine(endMs: () => number | null) {
  const f = fakeEnv();
  const completions: { end: number; late: number; at: number }[] = [];
  const frameTimes: number[] = [];
  const engine = new TimerEngine(f.env, {
    endElapsedMs: endMs,
    onFrame: (e) => frameTimes.push(e),
    onChange: () => {},
    onComplete: (end, late) => completions.push({ end, late, at: f.now }),
  });
  return { f, engine, completions, frameTimes };
}

describe('นาฬิกา (pure)', () => {
  it('Pause/Resume ไม่ทำให้เวลาคลาดเคลื่อน', () => {
    let c = clockStart(IDLE_CLOCK, 100);
    expect(clockElapsed(c, 5_100)).toBe(5_000);
    c = clockPause(c, 5_100);
    expect(clockElapsed(c, 99_999)).toBe(5_000);
    c = clockStart(c, 100_000);
    expect(clockElapsed(c, 102_500)).toBe(7_500);
  });

  it('กด Start ซ้ำขณะเดินอยู่ไม่รีเซ็ตเวลาเริ่ม', () => {
    const c = clockStart(IDLE_CLOCK, 0);
    expect(clockStart(c, 3_000)).toBe(c);
  });
});

describe('TimerEngine', () => {
  it('กด Start/Resume รัว ๆ มี loop และ timeout แค่ชุดเดียว', () => {
    const { f, engine, frameTimes } = makeEngine(() => 60_000);
    for (let i = 0; i < 20; i++) engine.start();
    expect(f.frames).toBe(1);
    expect(f.timers).toBe(1);
    f.advance(1_000);
    for (let i = 0; i < 20; i++) engine.start();
    expect(f.frames).toBe(1);
    expect(f.timers).toBe(1);
    // 1 วินาทีที่ 16 ms/เฟรม ≈ 63 เฟรม ไม่ใช่ 63 × 20
    expect(frameTimes.length).toBeLessThan(70);
    engine.pause();
    engine.pause();
    expect(f.frames).toBe(0);
    expect(f.timers).toBe(0);
    for (let i = 0; i < 5; i++) engine.start();
    expect(f.frames).toBe(1);
  });

  it('Pause/Resume หลายรอบ เวลาและสถานะตรงทุกครั้ง', () => {
    const plan = planTarget(25 * 60_000, TARGET_CONFIG);
    const { f, engine } = makeEngine(() => plan.totalMs);
    engine.start();
    f.advance(65_432);
    engine.pause();
    const atPause = engine.elapsed();
    expect(atPause).toBe(65_432);
    const stateAtPause = scheduleProgress(plan, atPause);
    f.advance(600_000, { visible: false });
    expect(engine.elapsed()).toBe(atPause);
    expect(scheduleProgress(plan, engine.elapsed())).toEqual(stateAtPause);
    engine.start();
    f.advance(10_000);
    expect(engine.elapsed()).toBe(75_432);
    engine.pause();
    engine.start();
    engine.pause();
    engine.start();
    f.advance(4_568);
    expect(engine.elapsed()).toBe(80_000);
  });

  it('แท็บถูกซ่อน (rAF หยุด) ตำแหน่งยังคำนวณถูก และจบตรงเวลาด้วย timeout', () => {
    const plan = planTarget(5 * 60_000, TARGET_CONFIG);
    const { f, engine, completions } = makeEngine(() => plan.totalMs);
    engine.start();
    f.advance(2_000);
    f.advance(120_000, { visible: false });
    expect(engine.elapsed()).toBe(122_000);
    // แท็บกลับมา: สถานะคำนวณจากเวลา ไม่ใช่จากจำนวนเฟรม
    const expected = Math.floor(122_000 / plan.slotMs);
    expect(scheduleProgress(plan, engine.elapsed()).completed).toBe(expected);
    f.advance(plan.totalMs, { visible: false, frameMs: 250 });
    expect(completions).toHaveLength(1);
    expect(completions[0].end).toBe(plan.totalMs);
    expect(completions[0].late).toBeLessThan(1_000);
    expect(engine.state.status).toBe('completed');
    expect(engine.elapsed()).toBe(plan.totalMs);
    // จบแล้วไม่เริ่มใหม่เอง
    engine.start();
    f.advance(5_000);
    expect(engine.state.status).toBe('completed');
    expect(completions).toHaveLength(1);
  });

  it('Estimated Completion ตรงกับเวลาที่ simulate ได้จริง (รวมกรณีหยุดกลางทาง)', () => {
    for (const cfg of [TARGET_CONFIG, LIFTER_CONFIG]) {
      const plan = planTarget(25 * 60_000, cfg);
      const { f, engine, completions } = makeEngine(() => plan.totalMs);
      const startEpoch = f.now;
      const etaAtStart = estimatedCompletion(plan, startEpoch, 0);
      engine.start();
      f.advance(400_000);
      engine.pause();
      f.advance(90_000, { visible: false });
      const etaAfterPause = estimatedCompletion(plan, f.now, engine.elapsed());
      expect(etaAfterPause - etaAtStart).toBe(90_000);
      engine.start();
      f.advance(plan.totalMs, { frameMs: 16 });
      expect(completions).toHaveLength(1);
      // ตรวจเจอในเฟรมถัดไป (≤ 16 ms) และค่าเวลาจบที่บันทึกคือค่าที่คำนวณได้พอดี
      expect(Math.abs(completions[0].at - etaAfterPause)).toBeLessThanOrEqual(16);
      expect(completions[0].at - completions[0].late).toBeCloseTo(etaAfterPause, 6);
    }
  });

  it('Reset กลับค่าเริ่มต้นและหยุด loop', () => {
    const { f, engine } = makeEngine(() => 10_000);
    engine.start();
    f.advance(3_000);
    engine.reset();
    expect(engine.state).toEqual(IDLE_CLOCK);
    expect(engine.elapsed()).toBe(0);
    expect(f.frames + f.timers).toBe(0);
  });

  it('Endless: เปลี่ยนตัวคูณแล้วเวลาจบถูกตั้งใหม่', () => {
    let run: EndlessRun = createEndlessRun(6, 1); // 63 วินาที
    const { f, engine, completions } = makeEngine(() => endlessEndElapsedMs(run));
    engine.start();
    f.advance(10_000);
    run = changeMultiplier(run, engine.elapsed(), 10);
    engine.reschedule();
    // เหลือ 53 Move ที่ 10 Move/วิ = 5.3 วินาที
    expect(endlessEndElapsedMs(run)).toBeCloseTo(15_300, 6);
    f.advance(5_400);
    expect(completions).toHaveLength(1);
    expect(completions[0].end).toBeCloseTo(15_300, 6);
    expect(endlessProgress(run, completions[0].end).done).toBe(true);
  });

  it('กู้คืนเซสชันที่เลยเวลาจบไปแล้ว → Completed ทันที ณ เวลาจบที่ถูกต้อง', () => {
    const { engine, completions } = makeEngine(() => 30_000);
    engine.restore('running', 45_000);
    expect(engine.state.status).toBe('completed');
    expect(completions[0]).toMatchObject({ end: 30_000, late: 15_000 });
  });

  it('กู้คืนแบบหยุดไว้ ไม่เดินเวลาเอง', () => {
    const { f, engine } = makeEngine(() => 30_000);
    engine.restore('paused', 12_000);
    f.advance(5_000);
    expect(engine.state.status).toBe('paused');
    expect(engine.elapsed()).toBe(12_000);
    expect(f.frames).toBe(0);
  });
});
