import { describe, expect, it } from 'vitest';
import { LIFTER_ANIM_MS, MAX_REST_MS, TARGET_ANIM_MS, TARGET_MAX_MINUTES, TARGET_MIN_MINUTES } from '../config';
import { LIFTER_CONFIG, planTarget, scheduleProgress, TARGET_CONFIG, type PlanConfig } from './targetPlan';

const MIN = 60_000;

describe('โหมดตั้งเวลา: เลือก n', () => {
  it('ค่าตามตัวอย่างที่คำนวณมือ', () => {
    // 25 นาที = 1500 วิ → 1500/1.2 = 1250 → 2^10-1 = 1023 ≤ 1250 < 2047
    expect(planTarget(25 * MIN, TARGET_CONFIG).n).toBe(10);
    // 45 นาที = 2700 วิ → 2250 → n = 11 (2047)
    expect(planTarget(45 * MIN, TARGET_CONFIG).n).toBe(11);
    // 12 ชั่วโมง → 36000 → n = 15 (32767)
    expect(planTarget(720 * MIN, TARGET_CONFIG).n).toBe(15);
    // คนยก 45 นาที → 2700/3.6 = 750 → n = 9 (511)
    expect(planTarget(45 * MIN, LIFTER_CONFIG).n).toBe(9);
  });

  it.each([
    ['ตั้งเวลา', TARGET_CONFIG],
    ['คนยก', LIFTER_CONFIG],
  ] as const)('%s: n ถูกต้องและเวลาพักไม่ติดลบ ทุกนาทีตั้งแต่ 1 นาทีถึง 12 ชม.', (_name, cfg) => {
    for (let m = TARGET_MIN_MINUTES; m <= TARGET_MAX_MINUTES; m++) {
      const target = m * MIN;
      const p = planTarget(target, cfg);
      expect(p.feasible).toBe(true);
      // n มากที่สุดที่ (2^n - 1) × เวลาแอนิเมชัน ≤ เป้าหมาย
      expect((2 ** p.n - 1) * cfg.animMs).toBeLessThanOrEqual(target);
      expect((2 ** (p.n + 1) - 1) * cfg.animMs).toBeGreaterThan(target);
      expect(p.totalMoves).toBe(2 ** p.n - 1);
      expect(p.restMs).toBeGreaterThanOrEqual(0);
      // เวลารวมเท่ากับเป้าหมายพอดี (คลาดเคลื่อนไม่เกิน 1 วินาที)
      expect(Math.abs(p.totalMoves * p.slotMs - target)).toBeLessThan(1);
      expect(p.totalMs).toBe(target);
      // กฎ 6 วินาทีไม่ถูกใช้กับค่าตั้งต้น แต่ต้องไม่ละเมิด
      expect(p.restMs).toBeLessThanOrEqual(MAX_REST_MS);
    }
  });

  it('คนยกใช้เวลาต่อ Move มากกว่าโหมดตั้งเวลา และได้ n ไม่มากกว่า', () => {
    expect(LIFTER_ANIM_MS).toBe(3600);
    expect(LIFTER_ANIM_MS).toBeGreaterThan(TARGET_ANIM_MS);
    for (let m = TARGET_MIN_MINUTES; m <= TARGET_MAX_MINUTES; m++) {
      const a = planTarget(m * MIN, TARGET_CONFIG);
      const b = planTarget(m * MIN, LIFTER_CONFIG);
      expect(b.slotMs).toBeGreaterThan(a.slotMs);
      expect(b.animMs).toBeGreaterThan(a.animMs);
      expect(b.n).toBeLessThan(a.n);
    }
  });

  it('เป้าหมายสั้นกว่า 1 Move: แจ้งว่าทำไม่ได้และบอกเวลาที่ทำได้จริง', () => {
    const p = planTarget(800, TARGET_CONFIG);
    expect(p.feasible).toBe(false);
    expect(p.n).toBe(1);
    expect(p.totalMs).toBe(TARGET_ANIM_MS);
    expect(p.totalMs).toBeGreaterThan(p.targetMs);
    expect(p.restMs).toBe(0);
    expect(planTarget(3000, LIFTER_CONFIG).feasible).toBe(false);
  });

  it('เวลาพักเกิน 6 วิ: ยืดแอนิเมชันก่อน (ไม่เกิน 2.5 วิ) แล้วจึงพักส่วนที่เหลือ', () => {
    // จำกัดวงไว้ 3 วงเพื่อบังคับให้เวลาพักยาว
    const cfg: PlanConfig = { ...TARGET_CONFIG, maxRings: 3 };
    // 7 Move ใน 49 วิ → 7 วิ/Move → พัก 5.8 วิ ไม่ต้องยืด
    const a = planTarget(49_000, cfg);
    expect(a.stretched).toBe(false);
    expect(a.animMs).toBe(1200);
    // 7 Move ใน 56 วิ → 8 วิ/Move → ยืดเป็น 2 วิ พัก 6 วิ
    const b = planTarget(56_000, cfg);
    expect(b.stretched).toBe(true);
    expect(b.animMs).toBeCloseTo(2000, 6);
    expect(b.restMs).toBeCloseTo(6000, 6);
    expect(b.restOverCap).toBe(false);
    // 7 Move ใน 70 วิ → 10 วิ/Move → ยืดเต็ม 2.5 วิ ที่เหลือพัก 7.5 วิ
    const c = planTarget(70_000, cfg);
    expect(c.animMs).toBe(2500);
    expect(c.restMs).toBeCloseTo(7500, 6);
    expect(c.restOverCap).toBe(true);
    expect(c.n).toBe(3);
  });
});

describe('ตารางเวลา', () => {
  it('วงสุดท้ายวางลงตรงเวลาเป้าหมายพอดี และเสร็จที่เป้าหมาย', () => {
    const p = planTarget(25 * MIN, TARGET_CONFIG);
    const before = scheduleProgress(p, p.totalMs - 1);
    expect(before.done).toBe(false);
    expect(before.active?.index).toBe(p.totalMoves);
    expect(before.completed).toBe(p.totalMoves - 1);
    expect(scheduleProgress(p, p.totalMs).done).toBe(true);
  });

  it('แต่ละ Move = พักก่อน แล้วจึงขยับ', () => {
    const p = planTarget(25 * MIN, TARGET_CONFIG);
    const k = 37;
    const slotStart = k * p.slotMs;
    expect(scheduleProgress(p, slotStart + p.restMs / 2).active).toBeNull();
    const mid = scheduleProgress(p, slotStart + p.restMs + p.animMs / 2);
    expect(mid.active?.index).toBe(k + 1);
    expect(mid.active!.t).toBeCloseTo(0.5, 6);
    expect(scheduleProgress(p, slotStart + p.slotMs + 1).completed).toBe(k + 1);
  });

  it('ความคืบหน้าเพิ่มขึ้นเสมอ (monotonic)', () => {
    const p = planTarget(60 * MIN, LIFTER_CONFIG);
    let last = -1;
    for (let e = 0; e <= p.totalMs; e += 997) {
      const c = scheduleProgress(p, e).completed;
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
  });
});
