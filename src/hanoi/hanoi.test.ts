import { describe, expect, it } from 'vitest';
import {
  diskPeg,
  moveAt,
  moveAtBitTrick,
  pegsOfDisks,
  totalMoves,
  totalMovesNumber,
  towersAfter,
  type Peg,
} from './hanoi';

/** คำตอบแบบ recursive จริง (ใช้เฉพาะในเทสต์เพื่อเทียบ) */
function recursiveMoves(n: number): { disk: number; from: Peg; to: Peg }[] {
  const out: { disk: number; from: Peg; to: Peg }[] = [];
  const solve = (k: number, from: Peg, to: Peg, via: Peg) => {
    if (k === 0) return;
    solve(k - 1, from, via, to);
    out.push({ disk: k - 1, from, to });
    solve(k - 1, via, to, from);
  };
  solve(n, 0, 2, 1);
  return out;
}

describe('จำนวน Move', () => {
  it('n=1 → 1, n=3 → 7, n=5 → 31', () => {
    expect(totalMoves(1)).toBe(1n);
    expect(totalMoves(3)).toBe(7n);
    expect(totalMoves(5)).toBe(31n);
    expect(totalMovesNumber(5)).toBe(31);
  });

  it('ใช้ BigInt เมื่อเกินช่วงตัวเลขที่ปลอดภัย', () => {
    expect(totalMoves(64)).toBe(18446744073709551615n);
    expect(() => totalMovesNumber(64)).toThrow(RangeError);
    expect(totalMovesNumber(53)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('ทุก Move ถูกกฎ (n = 1..10 ทุก Move)', () => {
  for (let n = 1; n <= 10; n++) {
    it(`n=${n}`, () => {
      const stacks: number[][] = [Array.from({ length: n }, (_, i) => n - 1 - i), [], []];
      const total = Number(totalMoves(n));
      for (let k = 1; k <= total; k++) {
        const mv = moveAt(n, BigInt(k));
        const src = stacks[mv.from];
        const dst = stacks[mv.to];
        expect(mv.from).not.toBe(mv.to);
        // ย้ายเฉพาะวงบนสุด
        expect(src[src.length - 1]).toBe(mv.disk);
        // ไม่วางวงใหญ่ทับวงเล็ก
        if (dst.length) expect(dst[dst.length - 1]).toBeGreaterThan(mv.disk);
        dst.push(src.pop()!);
      }
      // สถานะสุดท้าย: ทุกวงอยู่เสา C เรียงใหญ่ล่างเล็กบน
      expect(stacks[0]).toEqual([]);
      expect(stacks[1]).toEqual([]);
      expect(stacks[2]).toEqual(Array.from({ length: n }, (_, i) => n - 1 - i));
    });
  }
});

describe('คำนวณจากดัชนีตรงกับ recursive จริง', () => {
  for (let n = 1; n <= 10; n++) {
    it(`n=${n}: ทุก Move และทุกสถานะ`, () => {
      const ref = recursiveMoves(n);
      const stacks: number[][] = [Array.from({ length: n }, (_, i) => n - 1 - i), [], []];
      expect(ref.length).toBe(Number(totalMoves(n)));
      ref.forEach((r, i) => {
        const k = BigInt(i + 1);
        const mv = moveAt(n, k);
        expect({ disk: mv.disk, from: mv.from, to: mv.to }).toEqual(r);
        expect(moveAtBitTrick(n, k)).toEqual({ from: r.from, to: r.to });
        stacks[r.to].push(stacks[r.from].pop()!);
        expect(towersAfter(n, k)).toEqual(stacks);
      });
    });
  }

  it('สถานะเริ่มต้น: ทุกวงอยู่เสา A', () => {
    expect(towersAfter(4, 0n)).toEqual([[3, 2, 1, 0], [], []]);
  });

  it('สถานะสุดท้ายอยู่เสา C ทั้งหมด สำหรับ n = 1..20', () => {
    for (let n = 1; n <= 20; n++) {
      expect(towersAfter(n, totalMoves(n))).toEqual([[], [], Array.from({ length: n }, (_, i) => n - 1 - i)]);
    }
  });

  it('ใช้ได้กับ n ใหญ่ที่ต้องใช้ BigInt (n=64)', () => {
    const n = 64;
    const total = totalMoves(n);
    expect(pegsOfDisks(n, total).every((p) => p === 2)).toBe(true);
    // Move ตรงกลางคือการย้ายวงใหญ่สุดจาก A ไป C
    expect(moveAt(n, 1n << 63n)).toEqual({ index: 1n << 63n, disk: 63, from: 0, to: 2 });
    // ก่อนหน้านั้นวงที่เหลือ 63 วงต้องอยู่เสา B ทั้งหมด
    const before = pegsOfDisks(n, (1n << 63n) - 1n);
    expect(before[63]).toBe(0);
    expect(before.slice(0, 63).every((p) => p === 1)).toBe(true);
    expect(diskPeg(n, 0, total)).toBe(2);
  });
});
