/**
 * ขนาดและตำแหน่งในฉาก SVG (หน่วย viewBox 1000 × 560)
 * - plain: โหมด 1/2 ฐานไม้วางบนโต๊ะเต็มฉาก รองรับ 3–20 วง
 * - lifter: โหมด 3 เสาเตี้ยกว่าและชิดกว่า วางบนโต๊ะ มีคนยืนด้านหลัง
 */
import type { Peg } from '../hanoi/hanoi';

export type SceneKind = 'plain' | 'lifter';

export const VIEW_W = 1000;
export const VIEW_H = 560;

export interface Pt {
  x: number;
  y: number;
}

export interface TowerLayout {
  kind: SceneKind;
  n: number;
  pegX: readonly [number, number, number];
  /** y ของผิวฐานที่วงล่างสุดวางอยู่ */
  groundY: number;
  ringH: number;
  pegH: number;
  pegTop: number;
  rodW: number;
  /** y ขอบบนของวงตอนยกพ้นยอดเสา */
  liftY: number;
  minRingW: number;
  maxRingW: number;
  base: { x0: number; x1: number; y: number; h: number };
  /** รัศมีโค้งของเส้นทางวงแหวน (ต้องไม่เกินระยะพ้นยอดเสา) */
  cornerR: number;
}

const CLEARANCE = 24;

export function towerLayout(kind: SceneKind, n: number): TowerLayout {
  if (kind === 'plain') {
    const ringH = Math.min(40, 300 / n);
    const pegH = n * ringH + 44;
    const groundY = 470;
    const pegTop = groundY - pegH;
    return {
      kind,
      n,
      pegX: [180, 500, 820],
      groundY,
      ringH,
      pegH,
      pegTop,
      rodW: 16,
      liftY: pegTop - CLEARANCE - ringH,
      minRingW: 74,
      maxRingW: 292,
      base: { x0: 52, x1: 948, y: groundY, h: 26 },
      cornerR: CLEARANCE - 4,
    };
  }
  // เสาสูงคงที่ทุก n: ยอดเสาอยู่ราวระดับท้องของตัวละคร จึงยกวงพ้นเสาได้โดยมืออยู่ต่ำกว่าไหล่เสมอ
  const pegH = 140;
  const ringH = Math.min(26, (pegH - 26) / n);
  const groundY = LIFTER_TABLE_Y - 18;
  const pegTop = groundY - pegH;
  return {
    kind,
    n,
    pegX: [310, 500, 690],
    groundY,
    ringH,
    pegH,
    pegTop,
    rodW: 12,
    liftY: pegTop - CLEARANCE - ringH,
    minRingW: 62,
    maxRingW: 176,
    base: { x0: 222, x1: 778, y: groundY, h: 18 },
    cornerR: CLEARANCE - 4,
  };
}

/** โหมดคนยก: พื้นห้อง และผิวโต๊ะ */
export const LIFTER_FLOOR_Y = 540;
/** โต๊ะเตี้ย: ไหล่ตัวละครอยู่ที่ y≈172 ระดับขนย้ายวงอยู่ราว y≈250–270 (ต่ำกว่าไหล่ 80–100) */
export const LIFTER_TABLE_Y = 458;

export function ringWidth(l: TowerLayout, disk: number): number {
  if (l.n <= 1) return l.maxRingW;
  return l.minRingW + ((l.maxRingW - l.minRingW) * disk) / (l.n - 1);
}

/** ตำแหน่งวง (กึ่งกลางแนวนอน, ขอบบน) เมื่ออยู่ชั้น level ของเสา peg */
export function slotPoint(l: TowerLayout, peg: Peg, level: number): Pt {
  return { x: l.pegX[peg], y: l.groundY - (level + 1) * l.ringH };
}
