import { describe, expect, it } from 'vitest';
import { LIFTER_ANIM_MS, LIFTER_MAX_ANIM_MS, LIFTER_STEPS } from '../config';
import { totalMovesNumber } from '../hanoi/hanoi';
import { lifterPhaseAt, lifterStepDurations, lifterStepRange } from '../modes/lifter';
import type { Progress } from '../modes/progress';
import { slotPoint, towerLayout } from './layout';
import { BODY, gripOffset, lifterFrame } from './lifterPose';
import { restingRings, stackInfo } from './scene';

const active = (n: number, index: number, t: number): Progress => ({
  completed: index - 1,
  total: totalMovesNumber(n),
  active: { index, t },
  rest: null,
  done: false,
});

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('ขั้นตอนของคนยก', () => {
  it('ค่าตั้งต้นรวม 3.6 วินาที (เร็วขึ้น 20% จาก 4.5 วิ) ตามลำดับที่กำหนด', () => {
    expect(LIFTER_STEPS.map((s) => [s.key, s.ms])).toEqual([
      ['reach', 640],
      ['grip', 400],
      ['lift', 560],
      ['carry', 960],
      ['place', 560],
      ['recover', 480],
    ]);
    expect(LIFTER_ANIM_MS).toBe(3600);
    expect(lifterPhaseAt(0).step).toBe('reach');
    expect(lifterPhaseAt(0.5).step).toBe('carry');
    expect(lifterPhaseAt(1).step).toBe('recover');
  });

  it('ยืดแอนิเมชันแล้วทุกขั้นช้าลงเท่ากัน ไม่มีขั้นไหนถูกเร่ง', () => {
    const stretched = lifterStepDurations(LIFTER_MAX_ANIM_MS);
    stretched.forEach((s, i) => expect(s.ms).toBeGreaterThanOrEqual(LIFTER_STEPS[i].ms));
    const normal = lifterStepDurations(LIFTER_ANIM_MS);
    normal.forEach((s, i) => expect(s.ms).toBeCloseTo(LIFTER_STEPS[i].ms, 9));
  });
});

describe('คนยกวางวงแหวนบนยอดเสาปลายทางถูกต้อง', () => {
  for (const n of [3, 5, 8, 13]) {
    it(`n=${n}: ทุก Move (หรือสุ่มตัวอย่าง) มือจับวงได้จริงและวางตรงตำแหน่ง`, () => {
      const l = towerLayout('lifter', n);
      const total = totalMovesNumber(n);
      const step = total > 600 ? 37 : 1;
      const placeEnd = lifterStepRange('place').end;
      const gripStart = lifterStepRange('grip').start;
      for (let k = 1; k <= total; k += step) {
        const s = stackInfo(n, k - 1);
        // ปลายขั้นวาง: วงอยู่บนยอดกองปลายทางพอดี และตรงกับสถานะหลัง Move
        const frame = lifterFrame(l, active(n, k, placeEnd));
        const held = frame.heldDisk!;
        const after = restingRings(l, k)[held];
        expect(frame.rings[held].x).toBeCloseTo(after.x, 6);
        expect(frame.rings[held].y).toBeCloseTo(after.y, 6);
        const toPeg = stackInfo(n, k).peg[held];
        expect(after.y).toBeCloseTo(slotPoint(l, toPeg, s.heights[toPeg]).y, 6);
        // ระหว่างจับ: มือทั้งสองอยู่ที่ขอบบนของวงจริง (IK เอื้อมถึง)
        for (let t = gripStart; t <= placeEnd; t += 0.02) {
          const f = lifterFrame(l, active(n, k, t));
          const g = f.pose.gripTargets!;
          expect(g).not.toBeNull();
          expect(dist(f.pose.handL, g.l)).toBeLessThan(0.5);
          expect(dist(f.pose.handR, g.r)).toBeLessThan(0.5);
          const ring = f.rings[held];
          expect(g.l.x).toBeCloseTo(ring.x - gripOffset(l), 6);
          expect(g.r.x).toBeCloseTo(ring.x + gripOffset(l), 6);
          // มืออยู่ในความกว้างของวง
          expect(gripOffset(l) + BODY.handR).toBeLessThan(ring.w / 2);
        }
      }
    });
  }

  it('วงขยับออกด้านข้างได้ก็ต่อเมื่อพ้นยอดเสาแล้วเท่านั้น', () => {
    const n = 6;
    const l = towerLayout('lifter', n);
    const carry = lifterStepRange('carry');
    for (let k = 1; k <= totalMovesNumber(n); k++) {
      for (let t = 0; t <= 1; t += 0.005) {
        const f = lifterFrame(l, active(n, k, t));
        const ring = f.rings[f.heldDisk!];
        const onRod = l.pegX.some((x) => Math.abs(ring.x - x) < 0.01);
        if (!onRod) expect(ring.y + ring.h).toBeLessThanOrEqual(l.pegTop + 0.01);
        if (t > carry.start + 0.01 && t < carry.end - 0.01) expect(ring.y + ring.h).toBeLessThan(l.pegTop);
      }
    }
  });

  it('ตัวละครเคลื่อนต่อเนื่อง ข้อต่อไม่สะบัด/ไม่กระโดดระหว่างเฟรม', () => {
    const parts = ['handL', 'handR', 'elbowL', 'elbowR', 'kneeL', 'kneeR', 'headC', 'hipC'] as const;
    for (const n of [3, 8, 13]) {
      const l = towerLayout('lifter', n);
      for (let k = 1; k <= Math.min(31, totalMovesNumber(n)); k++) {
        let prev = lifterFrame(l, active(n, k, 0)).pose;
        for (let i = 1; i <= 450; i++) {
          const pose = lifterFrame(l, active(n, k, i / 450)).pose;
          // ทุก 10 ms ไม่มีข้อต่อไหนขยับเกิน 12 หน่วย (≈ ช้ากว่า 1.2 เท่าของความสูงตัวต่อวินาที)
          for (const p of parts) expect(dist(pose[p], prev[p])).toBeLessThan(12);
          prev = pose;
        }
      }
    }
  });

  it('มือไม่พับเข้าชิดไหล่ และระหว่างยก/ขนอยู่ต่ำกว่าไหล่', () => {
    for (const n of [3, 8, 13]) {
      const l = towerLayout('lifter', n);
      for (let k = 1; k <= Math.min(31, totalMovesNumber(n)); k++) {
        for (let t = 0; t <= 1; t += 0.01) {
          const f = lifterFrame(l, active(n, k, t));
          const p = f.pose;
          expect(dist(p.handL, p.shoulderL)).toBeGreaterThan(40);
          expect(dist(p.handR, p.shoulderR)).toBeGreaterThan(40);
          if (f.phase && ['lift', 'carry', 'place'].includes(f.phase.step)) {
            expect(p.handL.y).toBeGreaterThan(p.shoulderL.y + 40);
            expect(p.handR.y).toBeGreaterThan(p.shoulderR.y + 40);
          }
        }
      }
    }
  });

  it('ท่าตอนพักเสร็จต่อกับท่าเริ่มเดินของ Move ถัดไปพอดี (ขยับเข้าหาเสาระหว่างพัก)', () => {
    for (const restMs of [0, 400, 2300]) {
      const n = 5;
      const l = towerLayout('lifter', n);
      for (let k = 0; k < totalMovesNumber(n); k++) {
        const restEnd = lifterFrame(
          l,
          { completed: k, total: totalMovesNumber(n), active: null, rest: { sinceMs: restMs, untilMs: 0 }, done: false },
          restMs,
        ).pose;
        const reachStart = lifterFrame(l, active(n, k + 1, 0), restMs).pose;
        for (const p of ['headC', 'hipC', 'handL', 'handR', 'ankleL', 'ankleR'] as const) {
          expect(dist(restEnd[p], reachStart[p])).toBeLessThan(1.5);
        }
      }
    }
  });

  it('วงแหวนไม่หยุดกลางทางระหว่างยก–ขน–วาง', () => {
    const n = 6;
    const l = towerLayout('lifter', n);
    const w0 = lifterStepRange('lift').start;
    const w1 = lifterStepRange('place').end;
    for (let k = 1; k <= totalMovesNumber(n); k++) {
      let prev = lifterFrame(l, active(n, k, w0)).rings;
      for (let i = 1; i <= 200; i++) {
        const t = w0 + ((w1 - w0) * i) / 200;
        const f = lifterFrame(l, active(n, k, t));
        const r = f.rings[f.heldDisk!];
        const q = prev[f.heldDisk!];
        // ยกเว้นช่วงออกตัวและแตะลงตอนท้าย ความเร็วต้องไม่ลดลงถึงศูนย์
        if (i > 12 && i < 188) expect(dist(r, q)).toBeGreaterThan(0.05);
        prev = f.rings;
      }
    }
  });

  it('ท่าตอนเริ่มพักต่อจากท่าจบของ Move ก่อนหน้าพอดี', () => {
    const n = 4;
    const l = towerLayout('lifter', n);
    for (let k = 1; k < totalMovesNumber(n); k++) {
      const end = lifterFrame(l, active(n, k, 1)).pose;
      const rest = lifterFrame(l, {
        completed: k,
        total: totalMovesNumber(n),
        active: null,
        rest: { sinceMs: 0, untilMs: 1000 },
        done: false,
      }).pose;
      expect(dist(end.headC, rest.headC)).toBeLessThan(0.5);
      expect(dist(end.handL, rest.handL)).toBeLessThan(0.5);
      expect(dist(end.ankleR, rest.ankleR)).toBeLessThan(0.5);
    }
  });
});
