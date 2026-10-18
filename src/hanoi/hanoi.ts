/**
 * Tower of Hanoi แบบคำนวณจากดัชนี Move โดยตรง — ไม่สร้างรายการ Move ทั้งหมดในหน่วยความจำ
 *
 * ใช้ BigInt กับดัชนี Move ทุกจุด จึงใช้ได้กับ n ที่ 2^n - 1 เกิน Number.MAX_SAFE_INTEGER
 * วงแหวนนับจาก 0 = เล็กสุด ถึง n-1 = ใหญ่สุด, เสา 0/1/2 = A/B/C, ย้ายทั้งกองจาก A ไป C
 */

export type Peg = 0 | 1 | 2;
export const PEG_NAMES = ['A', 'B', 'C'] as const;

export interface Move {
  /** ดัชนี Move นับจาก 1 */
  index: bigint;
  disk: number;
  from: Peg;
  to: Peg;
}

function assertRingCount(n: number): void {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`จำนวนวงแหวนต้องเป็นจำนวนเต็ม ≥ 1 (ได้ ${n})`);
}

/** จำนวน Move ทั้งหมด = 2^n - 1 (BigInt เสมอ) */
export function totalMoves(n: number): bigint {
  assertRingCount(n);
  return (1n << BigInt(n)) - 1n;
}

/** เหมือน totalMoves แต่คืน number — ใช้ได้เฉพาะเมื่อค่าอยู่ในช่วงปลอดภัย (n ≤ 53) */
export function totalMovesNumber(n: number): number {
  const total = totalMoves(n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`2^${n} - 1 เกินช่วงตัวเลขที่ปลอดภัย ให้ใช้ totalMoves() แบบ BigInt`);
  }
  return Number(total);
}

/** จำนวนบิต 0 ท้ายสุดของ k (k > 0) — คือหมายเลขวงที่ถูกย้ายใน Move ที่ k */
export function trailingZeros(k: bigint): number {
  if (k <= 0n) throw new RangeError('ดัชนี Move ต้องมากกว่า 0');
  let z = 0;
  while ((k & 1n) === 0n) {
    k >>= 1n;
    z++;
  }
  return z;
}

/** วง d ถูกย้ายไปแล้วกี่ครั้งหลังผ่านไป k Move */
export function timesMoved(d: number, k: bigint): bigint {
  return (k + (1n << BigInt(d))) >> BigInt(d + 1);
}

/**
 * เสาที่วง d อยู่หลังผ่านไป k Move
 * วงแต่ละวงเดินวนทางเดียวตลอด: ถ้า (n - d) เป็นคี่ วน A→C→B→A, ถ้าเป็นคู่ วน A→B→C→A
 */
export function diskPeg(n: number, d: number, k: bigint): Peg {
  const step = (n - d) % 2 === 1 ? 2n : 1n;
  return Number((timesMoved(d, k) * step) % 3n) as Peg;
}

function clampMoves(n: number, k: bigint): bigint {
  const total = totalMoves(n);
  if (k < 0n) return 0n;
  return k > total ? total : k;
}

/** เสาของวงทุกวงหลัง k Move — ดัชนีอาร์เรย์คือหมายเลขวง */
export function pegsOfDisks(n: number, k: bigint): Peg[] {
  const kk = clampMoves(n, k);
  const pegs: Peg[] = new Array(n);
  for (let d = 0; d < n; d++) pegs[d] = diskPeg(n, d, kk);
  return pegs;
}

/** กองบนเสา A, B, C หลัง k Move — แต่ละกองเรียงจากล่าง (ใหญ่) ขึ้นบน (เล็ก) */
export function towersAfter(n: number, k: bigint): [number[], number[], number[]] {
  const pegs = pegsOfDisks(n, k);
  const towers: [number[], number[], number[]] = [[], [], []];
  for (let d = n - 1; d >= 0; d--) towers[pegs[d]].push(d);
  return towers;
}

/** ข้อมูล Move ที่ k (นับจาก 1): วงไหน จากเสาไหน ไปเสาไหน */
export function moveAt(n: number, k: bigint): Move {
  const total = totalMoves(n);
  if (k < 1n || k > total) throw new RangeError(`ดัชนี Move ต้องอยู่ระหว่าง 1 ถึง ${total}`);
  const disk = trailingZeros(k);
  return { index: k, disk, from: diskPeg(n, disk, k - 1n), to: diskPeg(n, disk, k) };
}

/**
 * วิธี bit trick แบบคลาสสิก (ใช้ตรวจไขว้กับ moveAt):
 * from = (k & (k-1)) mod 3, to = ((k | (k-1)) + 1) mod 3 — สูตรนี้ส่งกองไปเสา C เมื่อ n คี่
 * และไปเสา B เมื่อ n คู่ จึงสลับ B กับ C เมื่อ n เป็นเลขคู่
 */
export function moveAtBitTrick(n: number, k: bigint): { from: Peg; to: Peg } {
  const swap = (p: number): Peg => (n % 2 === 0 && p !== 0 ? (3 - p) as Peg : (p as Peg));
  const from = Number((k & (k - 1n)) % 3n);
  const to = Number(((k | (k - 1n)) + 1n) % 3n);
  return { from: swap(from), to: swap(to) };
}
