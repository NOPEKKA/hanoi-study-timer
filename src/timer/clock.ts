/**
 * นาฬิกาจับเวลาแบบ pure function — เวลาที่ผ่านไป = เวลาสะสม + (ตอนนี้ - เวลาที่เริ่มเดินรอบล่าสุด)
 * ไม่มีการบวกทีละเฟรม จึงไม่คลาดเคลื่อนแม้ rAF หยุดตอนแท็บถูกซ่อน
 */

export type RunStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface ClockState {
  status: RunStatus;
  /** เวลาที่ผ่านไปแล้วก่อนรอบที่กำลังเดินอยู่ (ms) */
  accumulatedMs: number;
  /** timestamp (performance.now) ที่เริ่มเดินรอบนี้ หรือ null ถ้าไม่ได้เดิน */
  runningSince: number | null;
}

export const IDLE_CLOCK: ClockState = { status: 'idle', accumulatedMs: 0, runningSince: null };

export function clockElapsed(c: ClockState, now: number): number {
  if (c.status === 'running' && c.runningSince !== null) {
    return c.accumulatedMs + Math.max(0, now - c.runningSince);
  }
  return c.accumulatedMs;
}

/** Start และ Resume — ถ้ากำลังเดินอยู่แล้วหรือจบแล้ว จะไม่เปลี่ยนอะไร (กดรัวได้) */
export function clockStart(c: ClockState, now: number): ClockState {
  if (c.status === 'running' || c.status === 'completed') return c;
  return { status: 'running', accumulatedMs: c.accumulatedMs, runningSince: now };
}

export function clockPause(c: ClockState, now: number): ClockState {
  if (c.status !== 'running') return c;
  return { status: 'paused', accumulatedMs: clockElapsed(c, now), runningSince: null };
}

export function clockComplete(atElapsedMs: number): ClockState {
  return { status: 'completed', accumulatedMs: atElapsedMs, runningSince: null };
}
