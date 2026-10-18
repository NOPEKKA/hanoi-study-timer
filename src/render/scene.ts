/**
 * แปลงความคืบหน้าเป็นตำแหน่งวงแหวนในฉาก — ทุกอย่างคำนวณจากดัชนี Move ณ ขณะนั้น
 */
import { moveAt, towersAfter, type Peg } from '../hanoi/hanoi';
import type { Progress } from '../modes/progress';
import { ringWidth, slotPoint, type Pt, type TowerLayout } from './layout';
import { easeInOutSine, pointOnArc } from './motion';

export interface RingSprite {
  disk: number;
  /** กึ่งกลางแนวนอน */
  x: number;
  /** ขอบบน */
  y: number;
  w: number;
  h: number;
  moving: boolean;
}

export interface StackInfo {
  peg: Peg[];
  level: number[];
  heights: [number, number, number];
}

export function stackInfo(n: number, k: number): StackInfo {
  const towers = towersAfter(n, BigInt(k));
  const peg: Peg[] = new Array(n);
  const level: number[] = new Array(n);
  towers.forEach((tower, p) =>
    tower.forEach((disk, i) => {
      peg[disk] = p as Peg;
      level[disk] = i;
    }),
  );
  return { peg, level, heights: [towers[0].length, towers[1].length, towers[2].length] };
}

function sprite(l: TowerLayout, disk: number, pt: Pt, moving = false): RingSprite {
  return { disk, x: pt.x, y: pt.y, w: ringWidth(l, disk), h: l.ringH, moving };
}

function restingFromInfo(l: TowerLayout, s: StackInfo): RingSprite[] {
  const out: RingSprite[] = new Array(l.n);
  for (let d = 0; d < l.n; d++) out[d] = sprite(l, d, slotPoint(l, s.peg[d], s.level[d]));
  return out;
}

export function restingRings(l: TowerLayout, k: number): RingSprite[] {
  return restingFromInfo(l, stackInfo(l.n, k));
}

export interface MoveEndpoints {
  disk: number;
  fromPeg: Peg;
  toPeg: Peg;
  /** ตำแหน่งบนสุดของกองต้นทาง */
  from: Pt;
  /** ตำแหน่งที่จะวางบนยอดกองปลายทาง */
  to: Pt;
}

/** ต้นทาง/ปลายทางของ Move ที่ index โดยดูจากสถานะก่อน Move นั้น (s) */
export function moveEndpoints(l: TowerLayout, s: StackInfo, index: number): MoveEndpoints {
  const mv = moveAt(l.n, BigInt(index));
  return {
    disk: mv.disk,
    fromPeg: mv.from,
    toPeg: mv.to,
    from: slotPoint(l, mv.from, s.heights[mv.from] - 1),
    to: slotPoint(l, mv.to, s.heights[mv.to]),
  };
}

/** โหมดปกติ: วงที่กำลังย้ายเดินตามเส้นทางโค้ง วงอื่นอยู่กับที่ */
export function animatedRings(l: TowerLayout, p: Progress): RingSprite[] {
  if (p.done) return restingRings(l, p.total);
  const s = stackInfo(l.n, p.completed);
  const rings = restingFromInfo(l, s);
  if (p.active) {
    const e = moveEndpoints(l, s, p.active.index);
    const pt = pointOnArc(e.from, e.to, l.liftY, l.cornerR, easeInOutSine(p.active.t));
    rings[e.disk] = sprite(l, e.disk, pt, true);
  }
  return rings;
}
