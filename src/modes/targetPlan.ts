/**
 * โหมด 2 (Target Time) และโหมด 3 (Human Lifter) ใช้สูตรเดียวกัน ต่างกันแค่เวลาแอนิเมชันต่อ Move
 *
 * 1. เลือก n ที่มากที่สุดที่ (2^n - 1) × เวลาแอนิเมชัน ≤ เวลาเป้าหมาย
 * 2. เวลาพักต่อ Move = (เวลาเป้าหมาย ÷ จำนวน Move) - เวลาแอนิเมชัน (เท่ากันทุก Move)
 * 3. ถ้าเวลาพักยาวเกิน maxRestMs ให้ยืดแอนิเมชัน (ไม่เกิน maxAnimMs) ก่อน ส่วนที่เหลือจึงเป็นเวลาพัก
 * 4. ถ้าเวลาเป้าหมายสั้นกว่า 1 Move จะทำไม่ได้ — feasible = false และ totalMs คือเวลาที่ทำได้จริง
 */
import {
  LIFTER_ANIM_MS,
  LIFTER_MAX_ANIM_MS,
  MAX_REST_MS,
  MAX_RINGS,
  TARGET_ANIM_MS,
  TARGET_MAX_ANIM_MS,
} from '../config';
import { doneProgress, slotProgress, type Progress } from './progress';

export interface PlanConfig {
  animMs: number;
  maxAnimMs: number;
  maxRestMs: number;
  maxRings: number;
}

export const TARGET_CONFIG: PlanConfig = {
  animMs: TARGET_ANIM_MS,
  maxAnimMs: TARGET_MAX_ANIM_MS,
  maxRestMs: MAX_REST_MS,
  maxRings: MAX_RINGS,
};

export const LIFTER_CONFIG: PlanConfig = {
  animMs: LIFTER_ANIM_MS,
  maxAnimMs: LIFTER_MAX_ANIM_MS,
  maxRestMs: MAX_REST_MS,
  maxRings: MAX_RINGS,
};

export interface TargetPlan {
  targetMs: number;
  n: number;
  totalMoves: number;
  animMs: number;
  restMs: number;
  /** เวลาต่อ Move = แอนิเมชัน + พัก */
  slotMs: number;
  /** เวลาที่ใช้จริงทั้งหมด — เท่ากับ targetMs เมื่อ feasible */
  totalMs: number;
  feasible: boolean;
  /** ต้องยืดแอนิเมชันเพราะเวลาพักยาวเกิน */
  stretched: boolean;
  /** เวลาพักยังยาวเกิน maxRestMs แม้ยืดแอนิเมชันเต็มที่แล้ว */
  restOverCap: boolean;
}

export function planTarget(targetMs: number, cfg: PlanConfig): TargetPlan {
  const base = { targetMs, stretched: false, restOverCap: false };
  if (!(targetMs > 0) || targetMs < cfg.animMs) {
    // สั้นเกินกว่า 1 Move — ทำตามกฎไม่ได้ ใช้ 1 วง 1 Move และบอกเวลาที่ทำได้จริง
    return {
      ...base,
      n: 1,
      totalMoves: 1,
      animMs: cfg.animMs,
      restMs: 0,
      slotMs: cfg.animMs,
      totalMs: cfg.animMs,
      feasible: false,
    };
  }
  let n = 1;
  while (n < cfg.maxRings && (2 ** (n + 1) - 1) * cfg.animMs <= targetMs) n++;
  const totalMoves = 2 ** n - 1;
  const slotMs = targetMs / totalMoves;
  let animMs = cfg.animMs;
  let restMs = slotMs - animMs;
  let stretched = false;
  if (restMs > cfg.maxRestMs) {
    animMs = Math.min(cfg.maxAnimMs, slotMs - cfg.maxRestMs);
    restMs = slotMs - animMs;
    stretched = true;
  }
  return {
    ...base,
    n,
    totalMoves,
    animMs,
    restMs,
    slotMs,
    totalMs: targetMs,
    feasible: true,
    stretched,
    restOverCap: restMs > cfg.maxRestMs + 1e-9,
  };
}

export function scheduleProgress(plan: TargetPlan, elapsedMs: number): Progress {
  if (elapsedMs >= plan.totalMs) return doneProgress(plan.totalMoves);
  const e = Math.max(0, elapsedMs);
  const completed = Math.min(plan.totalMoves - 1, Math.floor(e / plan.slotMs));
  return slotProgress(completed, plan.totalMoves, e - completed * plan.slotMs, plan.restMs, plan.animMs);
}

/** เวลานาฬิกา (epoch ms) ที่คาดว่าจะเสร็จ */
export function estimatedCompletion(plan: TargetPlan, nowEpochMs: number, elapsedMs: number): number {
  return nowEpochMs + Math.max(0, plan.totalMs - elapsedMs);
}
