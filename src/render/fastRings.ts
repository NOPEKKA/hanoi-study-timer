/**
 * โหมดภาพเร่ง (≥ 10x): วาดทุก Move ไม่ทันแล้ว แต่ต้องดู "เร็ว" ไม่ใช่ "วาป"
 *
 * แต่ละวงบินไปยังตำแหน่งจริงของมัน ณ ตอนออกบิน ตามเส้นทางปกติ (ยก–ข้าม–ลง)
 * พอลงจอดแล้วตำแหน่งจริงเปลี่ยนไปอีก ก็ออกบินต่อทันที — วงเล็กที่สลับถี่จึงบินวนไปมาเร็ว ๆ
 * ส่วนวงใหญ่บินช้าและนิ่ง วงไม่เคยหายหรือโผล่ขึ้นมาเฉย ๆ
 *
 * ภาพตามหลังสถานะจริงไม่เกินเวลาบิน 1 รอบ ส่วนตัวเลข Move ยังคำนวณจากเวลาจริงทุก Move
 */
import { FAST_FLIGHT_MAX_MS, FAST_FLIGHT_MIN_MS, FAST_FLIGHT_PERIOD_FRACTION } from '../config';
import type { Peg } from '../hanoi/hanoi';
import { ringWidth, slotPoint, type Pt, type TowerLayout } from './layout';
import { easeInOutSine, pointOnArc } from './motion';
import type { RingSprite, StackInfo } from './scene';

interface Flight {
  from: Pt;
  to: Pt;
  start: number;
  dur: number;
}

interface RingState {
  peg: Peg;
  level: number;
  flight: Flight | null;
  /** ปลายทางของเที่ยวบินปัจจุบัน */
  destPeg: Peg;
  destLevel: number;
}

/** เวลาบินของวง d: 80% ของช่วงห่างระหว่าง Move ของวงนั้น จำกัดไว้ในช่วงที่ตายังตามทัน */
export function flightMs(disk: number, msPerMove: number): number {
  const period = 2 ** (disk + 1) * msPerMove;
  return Math.min(FAST_FLIGHT_MAX_MS, Math.max(FAST_FLIGHT_MIN_MS, period * FAST_FLIGHT_PERIOD_FRACTION));
}

export class FastRingAnimator {
  private key = '';
  private lastE = -Infinity;
  private rings: RingState[] = [];

  reset(): void {
    this.key = '';
    this.lastE = -Infinity;
    this.rings = [];
  }

  /**
   * truth = สถานะจริง ณ เวลา e (ms ของเวลาที่ผ่านไป), key = เปลี่ยนเมื่อเริ่มเซสชันใหม่/เปลี่ยนจำนวนวง
   */
  frame(l: TowerLayout, truth: StackInfo, e: number, msPerMove: number, key: string): RingSprite[] {
    if (key !== this.key || e < this.lastE || this.rings.length !== l.n) {
      this.key = key;
      this.rings = truth.peg.map((peg, d) => ({ peg, level: truth.level[d], flight: null, destPeg: peg, destLevel: truth.level[d] }));
    }
    this.lastE = e;

    const out: RingSprite[] = new Array(l.n);
    for (let d = 0; d < l.n; d++) {
      const r = this.rings[d];
      if (r.flight && e >= r.flight.start + r.flight.dur) {
        r.peg = r.destPeg;
        r.level = r.destLevel;
        r.flight = null;
      }
      if (!r.flight && (r.peg !== truth.peg[d] || r.level !== truth.level[d])) {
        r.destPeg = truth.peg[d];
        r.destLevel = truth.level[d];
        r.flight = {
          from: slotPoint(l, r.peg, r.level),
          to: slotPoint(l, r.destPeg, r.destLevel),
          start: e,
          dur: flightMs(d, msPerMove),
        };
      }
      const w = ringWidth(l, d);
      if (r.flight) {
        const f = r.flight;
        const pt = pointOnArc(f.from, f.to, l.liftY, l.cornerR, easeInOutSine((e - f.start) / f.dur));
        out[d] = { disk: d, x: pt.x, y: pt.y, w, h: l.ringH, moving: true };
      } else {
        const pt = slotPoint(l, r.peg, r.level);
        out[d] = { disk: d, x: pt.x, y: pt.y, w, h: l.ringH, moving: false };
      }
    }
    return out;
  }
}
