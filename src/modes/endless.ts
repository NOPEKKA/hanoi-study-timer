/**
 * โหมด 1: Endless — ความเร็วคงที่ตามตัวคูณ เปลี่ยนตัวคูณระหว่างรันได้
 *
 * เก็บ "จุดยึด" (anchor) ณ เวลาที่เปลี่ยนตัวคูณครั้งล่าสุด แล้วคำนวณต่อเป็นเส้นตรงจากจุดนั้น
 * ตำแหน่งจึงต่อเนื่อง ไม่กระโดดเมื่อเปลี่ยนความเร็ว
 */
import {
  ENDLESS_ANIM_FRACTION,
  ENDLESS_SECONDS_PER_MOVE_AT_1X,
  MAX_ANIMATED_MOVES_PER_SEC,
} from '../config';
import { totalMovesNumber } from '../hanoi/hanoi';
import { doneProgress, slotProgress, type Progress } from './progress';

export interface EndlessRun {
  n: number;
  totalMoves: number;
  multiplier: number;
  /** เวลาจริงที่ผ่านไป (ms) ณ จุดยึด */
  anchorElapsedMs: number;
  /** จำนวน Move แบบมีเศษ ณ จุดยึด */
  anchorMoves: number;
  /** เวลาเร่ง (ms) ณ จุดยึด */
  anchorAccelMs: number;
}

export function createEndlessRun(n: number, multiplier: number): EndlessRun {
  return {
    n,
    totalMoves: totalMovesNumber(n),
    multiplier,
    anchorElapsedMs: 0,
    anchorMoves: 0,
    anchorAccelMs: 0,
  };
}

export function movesPerSecond(multiplier: number): number {
  return multiplier / ENDLESS_SECONDS_PER_MOVE_AT_1X;
}

export function msPerMove(multiplier: number): number {
  return (ENDLESS_SECONDS_PER_MOVE_AT_1X * 1000) / multiplier;
}

/** เร็วเกินกว่าจะวาดแอนิเมชันทุก Move */
export function isFastMode(multiplier: number): boolean {
  return movesPerSecond(multiplier) > MAX_ANIMATED_MOVES_PER_SEC;
}

/** เวลาจริงที่ผ่านไป (ms) ตอนที่ Move สุดท้ายเสร็จ */
export function endlessEndElapsedMs(run: EndlessRun): number {
  return run.anchorElapsedMs + (run.totalMoves - run.anchorMoves) * msPerMove(run.multiplier);
}

/** จำนวน Move แบบมีเศษ ณ เวลาจริงที่ผ่านไป elapsedMs */
export function endlessMovesAt(run: EndlessRun, elapsedMs: number): number {
  const dt = Math.max(0, elapsedMs - run.anchorElapsedMs);
  return Math.min(run.totalMoves, run.anchorMoves + dt / msPerMove(run.multiplier));
}

/** เวลาเร่ง = ผลรวมของ (ช่วงเวลาจริง × ตัวคูณในช่วงนั้น) — ถ้าตัวคูณไม่เปลี่ยนจะเท่ากับ เวลาจริง × ตัวคูณ */
export function endlessAccelMsAt(run: EndlessRun, elapsedMs: number): number {
  const e = Math.min(elapsedMs, endlessEndElapsedMs(run));
  return run.anchorAccelMs + Math.max(0, e - run.anchorElapsedMs) * run.multiplier;
}

/** เปลี่ยนตัวคูณ ณ เวลา elapsedMs — ยึดตำแหน่งปัจจุบันไว้แล้วคำนวณต่อด้วยความเร็วใหม่ */
export function changeMultiplier(run: EndlessRun, elapsedMs: number, multiplier: number): EndlessRun {
  if (multiplier === run.multiplier) return run;
  const e = Math.min(Math.max(elapsedMs, run.anchorElapsedMs), endlessEndElapsedMs(run));
  return {
    ...run,
    multiplier,
    anchorElapsedMs: e,
    anchorMoves: endlessMovesAt(run, e),
    anchorAccelMs: endlessAccelMsAt(run, e),
  };
}

export function endlessProgress(run: EndlessRun, elapsedMs: number): Progress {
  const moves = endlessMovesAt(run, elapsedMs);
  if (moves >= run.totalMoves) return doneProgress(run.totalMoves);
  const completed = Math.floor(moves);
  const slot = msPerMove(run.multiplier);
  const within = (moves - completed) * slot;
  return slotProgress(completed, run.totalMoves, within, slot * (1 - ENDLESS_ANIM_FRACTION), slot * ENDLESS_ANIM_FRACTION);
}
