/**
 * ค่าคงที่ทั้งหมดของแอป — ปรับได้ที่ไฟล์นี้ที่เดียว
 * เวลาทุกค่าเป็นมิลลิวินาที (ms) ยกเว้นที่ระบุไว้
 */

export const MIN_RINGS = 3;
export const MAX_RINGS = 20;

// ---------------------------------------------------------------- Endless
export const ENDLESS_MULTIPLIERS = [1, 2, 5, 10, 50, 100, 1000] as const;
export type Multiplier = (typeof ENDLESS_MULTIPLIERS)[number];

/** วินาทีต่อ 1 Move ที่ตัวคูณ 1x */
export const ENDLESS_SECONDS_PER_MOVE_AT_1X = 1;
/** สัดส่วนของช่วงเวลา 1 Move ที่วงแหวนเคลื่อนที่ (ส่วนที่เหลือคือช่วงนิ่งก่อนวงถัดไปขยับ) */
export const ENDLESS_ANIM_FRACTION = 0.8;
/** เกินกว่านี้ (Move/วินาที) จะไม่วาดแอนิเมชันทุก Move แต่แสดงภาพแบบสุ่มตัวอย่าง */
export const MAX_ANIMATED_MOVES_PER_SEC = 8;
/**
 * โหมดภาพเร่ง: ทุกวงบินไปตำแหน่งจริงของมัน เวลาบิน = 80% ของช่วงห่างระหว่าง Move ของวงนั้น
 * แต่ไม่สั้นกว่า/ยาวกว่าค่าด้านล่าง (วงเล็กบินเร็ว วงใหญ่บินช้า)
 */
export const FAST_FLIGHT_PERIOD_FRACTION = 0.8;
export const FAST_FLIGHT_MIN_MS = 220;
export const FAST_FLIGHT_MAX_MS = 480;
/** โหมดภาพเร่ง: ตัวเลขบนจอเปลี่ยนไม่เกินกี่ครั้งต่อวินาที (วงแหวนยังเคลื่อนตามอัตราเฟรมของจอเพื่อให้ลื่น) */
export const FAST_MAX_FPS = 30;

// ---------------------------------------------------------- Target / Lifter
/** เวลาแอนิเมชันตั้งต้นต่อ Move ในโหมดตั้งเวลา */
export const TARGET_ANIM_MS = 1200;
/** ยืดแอนิเมชันได้สูงสุดเท่านี้ เมื่อเวลาพักยาวเกิน MAX_REST_MS */
export const TARGET_MAX_ANIM_MS = 2500;
/** เวลาพักต่อ Move ที่ยาวเกินกว่านี้จะเริ่มยืดแอนิเมชันแทน */
export const MAX_REST_MS = 6000;

/** ขั้นตอนของคนยก — เร็วขึ้น 20% จากสเปกเดิม (4.5 วิ → 3.6 วิ) ตามที่ผู้ใช้ขอ */
export const LIFTER_STEPS = [
  { key: 'reach', label: 'เดิน/เอื้อม', ms: 640 },
  { key: 'grip', label: 'หยิบ', ms: 400 },
  { key: 'lift', label: 'ยกขึ้น', ms: 560 },
  { key: 'carry', label: 'ขนไป', ms: 960 },
  { key: 'place', label: 'วางลง', ms: 560 },
  { key: 'recover', label: 'กลับท่ายืน', ms: 480 },
] as const;
export type LifterStepKey = (typeof LIFTER_STEPS)[number]['key'];

/** เวลาแอนิเมชันรวมต่อ Move ของคนยก (3.6 วินาที) */
export const LIFTER_ANIM_MS = LIFTER_STEPS.reduce((sum, s) => sum + s.ms, 0);
/** ยืดได้ในสัดส่วนเดียวกับโหมดตั้งเวลา (2.5 / 1.2) — ยืดให้ช้าลงเท่านั้น ไม่มีการเร่ง */
export const LIFTER_MAX_ANIM_MS = Math.round((LIFTER_ANIM_MS * TARGET_MAX_ANIM_MS) / TARGET_ANIM_MS);

export const TARGET_PRESETS_MIN = [25, 45, 60, 120, 180] as const;
export const TARGET_MIN_MINUTES = 1;
export const TARGET_MAX_MINUTES = 12 * 60;
