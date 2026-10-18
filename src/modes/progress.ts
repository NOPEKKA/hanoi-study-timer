/**
 * ความคืบหน้าที่ทุกโหมดใช้ร่วมกัน — คำนวณจากเวลาที่ผ่านไปเสมอ ไม่ใช่จากจำนวนเฟรม
 *
 * ทุก Move แบ่งเป็น [ช่วงพัก][ช่วงแอนิเมชัน] — พักก่อนแล้วจึงขยับ
 * Move ที่ k จึงเสร็จพอดีที่ปลายช่วงของมัน และวงสุดท้ายวางลงตรงกับเวลาที่ครบ
 */

export interface ActiveMove {
  /** ดัชนี Move ที่กำลังเคลื่อน (นับจาก 1) */
  index: number;
  /** ความคืบหน้าของแอนิเมชัน 0..1 */
  t: number;
}

export interface Progress {
  /** จำนวน Move ที่เสร็จแล้ว */
  completed: number;
  total: number;
  active: ActiveMove | null;
  /** ช่วงพัก: ผ่านมาแล้วกี่ ms และอีกกี่ ms ถึงจะเริ่มขยับ (null ถ้าไม่ได้อยู่ในช่วงพัก) */
  rest: { sinceMs: number; untilMs: number } | null;
  done: boolean;
}

export function doneProgress(total: number): Progress {
  return { completed: total, total, active: null, rest: null, done: true };
}

/** แปลง "ช่วงที่ i และเวลาภายในช่วง" เป็น Progress */
export function slotProgress(
  completed: number,
  total: number,
  withinMs: number,
  restMs: number,
  animMs: number,
): Progress {
  if (withinMs >= restMs) {
    const t = animMs > 0 ? Math.min(1, (withinMs - restMs) / animMs) : 1;
    return { completed, total, active: { index: completed + 1, t }, rest: null, done: false };
  }
  return {
    completed,
    total,
    active: null,
    rest: { sinceMs: withinMs, untilMs: restMs - withinMs },
    done: false,
  };
}

export function progressPercent(p: Progress): number {
  if (p.total <= 0) return 0;
  return (p.completed / p.total) * 100;
}
