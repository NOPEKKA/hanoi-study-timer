import { describe, expect, it } from 'vitest';
import { ENDLESS_SECONDS_PER_MOVE_AT_1X } from '../config';
import {
  changeMultiplier,
  createEndlessRun,
  endlessAccelMsAt,
  endlessEndElapsedMs,
  endlessMovesAt,
  endlessProgress,
  isFastMode,
  movesPerSecond,
} from './endless';

describe('Endless', () => {
  it('ที่ 1x ใช้ 1 Move ต่อ 1 วินาที', () => {
    expect(ENDLESS_SECONDS_PER_MOVE_AT_1X).toBe(1);
    const run = createEndlessRun(5, 1);
    expect(endlessMovesAt(run, 1000)).toBeCloseTo(1, 9);
    expect(endlessProgress(run, 999).completed).toBe(0);
    expect(endlessProgress(run, 1000).completed).toBe(1);
    expect(endlessProgress(run, 10_500).completed).toBe(10);
  });

  it('Moves ต่อวินาที = ตัวคูณ ÷ 1 วินาที', () => {
    expect(movesPerSecond(1)).toBe(1);
    expect(movesPerSecond(50)).toBe(50);
    expect(endlessMovesAt(createEndlessRun(10, 100), 2000)).toBeCloseTo(200, 9);
  });

  it('เกิน 8 Move/วินาที จะเข้าโหมดภาพเร่ง', () => {
    expect(isFastMode(5)).toBe(false);
    expect(isFastMode(10)).toBe(true);
    expect(isFastMode(1000)).toBe(true);
  });

  it('เวลาเร่ง = เวลาจริง × ตัวคูณ', () => {
    const run = createEndlessRun(20, 50);
    expect(endlessAccelMsAt(run, 12_345)).toBeCloseTo(12_345 * 50, 6);
  });

  it('เปลี่ยนตัวคูณระหว่างรันแล้วตำแหน่งไม่กระโดด', () => {
    let run = createEndlessRun(12, 2);
    const t = 7_300;
    const before = endlessMovesAt(run, t);
    const accelBefore = endlessAccelMsAt(run, t);
    run = changeMultiplier(run, t, 100);
    expect(endlessMovesAt(run, t)).toBeCloseTo(before, 9);
    expect(endlessAccelMsAt(run, t)).toBeCloseTo(accelBefore, 6);
    // หลังเปลี่ยน เดินด้วยความเร็วใหม่จากจุดเดิม
    expect(endlessMovesAt(run, t + 1000)).toBeCloseTo(before + 100, 6);
    // ลดความเร็วกลับก็ยังต่อเนื่อง
    const mid = endlessMovesAt(run, t + 1500);
    run = changeMultiplier(run, t + 1500, 1);
    expect(endlessMovesAt(run, t + 1500)).toBeCloseTo(mid, 9);
    expect(endlessMovesAt(run, t + 2500)).toBeCloseTo(mid + 1, 6);
  });

  it('จบเมื่อครบ 2^n - 1 Move และไม่เกิน', () => {
    const run = createEndlessRun(3, 1);
    expect(endlessEndElapsedMs(run)).toBe(7000);
    expect(endlessProgress(run, 6999).done).toBe(false);
    expect(endlessProgress(run, 7000).done).toBe(true);
    expect(endlessMovesAt(run, 1e9)).toBe(7);
  });

  it('วงสุดท้ายวางลงตรงกับเวลาจบพอดี (พักก่อน แล้วขยับ)', () => {
    const run = createEndlessRun(3, 1);
    const p = endlessProgress(run, 6999);
    expect(p.active?.index).toBe(7);
    expect(p.active!.t).toBeGreaterThan(0.99);
    const rest = endlessProgress(run, 6100);
    expect(rest.active).toBeNull();
    expect(rest.rest).not.toBeNull();
  });
});
