import { describe, expect, it } from 'vitest';
import { FAST_FLIGHT_MAX_MS, FAST_FLIGHT_MIN_MS } from '../config';
import { createEndlessRun, endlessProgress, msPerMove } from '../modes/endless';
import { FastRingAnimator, flightMs } from './fastRings';
import { slotPoint, towerLayout } from './layout';
import { stackInfo } from './scene';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('โหมดภาพเร่ง: วงบินจริง ไม่วาป', () => {
  it('เวลาบิน: วงเล็กบินเร็ว วงใหญ่บินช้า อยู่ในช่วงที่กำหนด', () => {
    expect(flightMs(0, msPerMove(10))).toBe(FAST_FLIGHT_MIN_MS);
    expect(flightMs(3, msPerMove(10))).toBe(FAST_FLIGHT_MAX_MS);
    for (const m of [10, 50, 100, 1000]) {
      for (let d = 0; d < 20; d++) {
        const f = flightMs(d, msPerMove(m));
        expect(f).toBeGreaterThanOrEqual(FAST_FLIGHT_MIN_MS);
        expect(f).toBeLessThanOrEqual(FAST_FLIGHT_MAX_MS);
        if (d > 0) expect(f).toBeGreaterThanOrEqual(flightMs(d - 1, msPerMove(m)));
      }
    }
  });

  for (const multiplier of [10, 100, 1000]) {
    it(`${multiplier}x: ทุกเฟรม (60 fps) ไม่มีวงไหนกระโดดข้ามเสาในเฟรมเดียว และหยุดแล้วลงจอดตรงสถานะจริง`, () => {
      const n = 12;
      const l = towerLayout('plain', n);
      const run = createEndlessRun(n, multiplier);
      const anim = new FastRingAnimator();
      const frameMs = 1000 / 60;
      let prev = null as ReturnType<FastRingAnimator['frame']> | null;
      let flying = 0;
      for (let e = 0; e <= 4000; e += frameMs) {
        const p = endlessProgress(run, e);
        const rings = anim.frame(l, stackInfo(n, p.completed), e, msPerMove(multiplier), 'a');
        if (prev) {
          for (let d = 0; d < n; d++) {
            // การวาปคือย้ายข้ามเสา (≥ 320 หน่วย) ในเฟรมเดียว — บินจริงต้องน้อยกว่านั้นมาก
            expect(dist(rings[d], prev[d])).toBeLessThan(160);
          }
        }
        flying = Math.max(flying, rings.filter((r) => r.moving).length);
        prev = rings;
      }
      expect(flying).toBeGreaterThan(0);
      // หยุดเวลา (เช่นกด Pause แล้วเฟรมสุดท้ายผ่านไป) — ทุกวงลงจอดที่ตำแหน่งจริง
      const e = 4000;
      const truth = stackInfo(n, endlessProgress(run, e).completed);
      let settled = anim.frame(l, truth, e, msPerMove(multiplier), 'a');
      // สถานะจริงไม่เปลี่ยนแล้ว: ภายในเวลาบินไม่เกิน 2 รอบ ทุกวงต้องลงจอดตรงที่
      for (let t = e; t <= e + 2 * 480 + 50; t += frameMs) settled = anim.frame(l, truth, t, msPerMove(multiplier), 'a');
      for (let d = 0; d < n; d++) {
        const target = slotPoint(l, truth.peg[d], truth.level[d]);
        expect(settled[d].moving).toBe(false);
        expect(settled[d].x).toBeCloseTo(target.x, 6);
        expect(settled[d].y).toBeCloseTo(target.y, 6);
      }
    });
  }

  it('เริ่มเซสชันใหม่หรือเวลาย้อนกลับ: เริ่มจากสถานะจริงทันที', () => {
    const n = 6;
    const l = towerLayout('plain', n);
    const anim = new FastRingAnimator();
    const truthA = stackInfo(n, 40);
    anim.frame(l, truthA, 5000, 10, 'a');
    const truthB = stackInfo(n, 0);
    const rings = anim.frame(l, truthB, 0, 10, 'b');
    rings.forEach((r, d) => {
      expect(r.moving).toBe(false);
      expect(r.y).toBeCloseTo(slotPoint(l, truthB.peg[d], truthB.level[d]).y, 6);
    });
  });
});
