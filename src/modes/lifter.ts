/**
 * โหมด 3: Human Lifter — แบ่งแอนิเมชัน 1 Move เป็นขั้นตอนตาม LIFTER_STEPS
 * ถ้าแผนยืดแอนิเมชัน ทุกขั้นตอนจะช้าลงในสัดส่วนเท่ากัน (ไม่มีขั้นไหนถูกเร่ง)
 */
import { LIFTER_ANIM_MS, LIFTER_STEPS, type LifterStepKey } from '../config';

export interface LifterPhase {
  step: LifterStepKey;
  index: number;
  /** ความคืบหน้าภายในขั้นตอน 0..1 */
  u: number;
}

const BOUNDS = (() => {
  let acc = 0;
  return LIFTER_STEPS.map((s) => {
    const start = acc / LIFTER_ANIM_MS;
    acc += s.ms;
    return { key: s.key, start, end: acc / LIFTER_ANIM_MS };
  });
})();

/** ขั้นตอนและความคืบหน้าภายในขั้นตอน จากความคืบหน้าของทั้ง Move (t = 0..1) */
export function lifterPhaseAt(t: number): LifterPhase {
  const tt = Math.min(1, Math.max(0, t));
  for (let i = 0; i < BOUNDS.length; i++) {
    const b = BOUNDS[i];
    if (tt < b.end || i === BOUNDS.length - 1) {
      return { step: b.key, index: i, u: Math.min(1, Math.max(0, (tt - b.start) / (b.end - b.start))) };
    }
  }
  return { step: 'recover', index: BOUNDS.length - 1, u: 1 };
}

/** ระยะเวลาจริงของแต่ละขั้นเมื่อแอนิเมชันทั้ง Move ยาว animMs */
export function lifterStepDurations(animMs: number): { key: LifterStepKey; ms: number }[] {
  const scale = animMs / LIFTER_ANIM_MS;
  return LIFTER_STEPS.map((s) => ({ key: s.key, ms: s.ms * scale }));
}

/** ช่วง t (0..1) ของขั้นตอนหนึ่ง */
export function lifterStepRange(step: LifterStepKey): { start: number; end: number } {
  const b = BOUNDS.find((x) => x.key === step)!;
  return { start: b.start, end: b.end };
}
