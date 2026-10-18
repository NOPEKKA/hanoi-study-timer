/**
 * ตัวขับเวลา: นาฬิกา + rAF loop เดียว + timeout สำหรับตอนจบ
 *
 * - loop มีได้ทีละหนึ่งเสมอ (กด Start/Resume รัว ๆ ก็ไม่ซ้อน)
 * - ตอนจบตรวจทั้งในเฟรมและด้วย setTimeout เผื่อแท็บถูกซ่อน (rAF หยุด แต่ timeout ยังทำงาน)
 * - ตอนจบจะบันทึกเวลาที่ผ่านไปเป็นค่าที่คำนวณได้พอดี ไม่ใช่เวลาที่ตรวจเจอ
 * - ไม่ผูกกับ DOM: ส่ง environment เข้ามา จึงทดสอบด้วยนาฬิกาปลอมได้
 */
import { clockComplete, clockElapsed, clockPause, clockStart, IDLE_CLOCK, type ClockState } from './clock';

export interface EngineEnv {
  now(): number;
  requestFrame(cb: () => void): number;
  cancelFrame(id: number): void;
  setTimer(cb: () => void, ms: number): number;
  clearTimer(id: number): void;
}

export interface EngineHooks {
  /** เวลาที่ผ่านไป (ms) ที่เซสชันจะจบ หรือ null ถ้ายังไม่รู้ */
  endElapsedMs(): number | null;
  onFrame(elapsedMs: number): void;
  onChange(clock: ClockState): void;
  /** lateByMs = ตรวจเจอช้ากว่าเวลาจบจริงกี่ ms (เช่นตอนแท็บถูกซ่อน) */
  onComplete(endElapsedMs: number, lateByMs: number): void;
}

/** setTimeout รับค่าได้ไม่เกิน 2^31-1 ms */
const MAX_TIMEOUT_MS = 2_147_483_647;

export class TimerEngine {
  private clock: ClockState = IDLE_CLOCK;
  private frameId: number | null = null;
  private timerId: number | null = null;
  private readonly env: EngineEnv;
  private readonly hooks: EngineHooks;

  constructor(env: EngineEnv, hooks: EngineHooks) {
    this.env = env;
    this.hooks = hooks;
  }

  get state(): ClockState {
    return this.clock;
  }

  /** จำนวน loop/timeout ที่ค้างอยู่ — ใช้ในเทสต์ */
  get pending(): { frames: number; timers: number } {
    return { frames: this.frameId === null ? 0 : 1, timers: this.timerId === null ? 0 : 1 };
  }

  elapsed(): number {
    return clockElapsed(this.clock, this.env.now());
  }

  /** Start และ Resume ใช้คำสั่งเดียวกัน */
  start(): void {
    if (this.clock.status === 'running' || this.clock.status === 'completed') return;
    this.set(clockStart(this.clock, this.env.now()));
    if (this.checkComplete()) return;
    this.ensureLoop();
    this.scheduleCompletion();
  }

  pause(): void {
    if (this.clock.status !== 'running') return;
    this.stopAsync();
    this.set(clockPause(this.clock, this.env.now()));
  }

  reset(): void {
    this.stopAsync();
    this.set(IDLE_CLOCK);
  }

  /** กู้คืนเซสชันที่เวลาผ่านไป elapsedMs */
  restore(status: 'running' | 'paused', elapsedMs: number): void {
    this.stopAsync();
    this.clock = { status: 'paused', accumulatedMs: Math.max(0, elapsedMs), runningSince: null };
    if (status === 'running') {
      this.start();
    } else if (!this.checkComplete()) {
      this.hooks.onChange(this.clock);
    }
  }

  /** เรียกเมื่อเวลาจบเปลี่ยน (เช่น เปลี่ยนตัวคูณ) */
  reschedule(): void {
    if (this.clock.status !== 'running') return;
    if (this.checkComplete()) return;
    this.scheduleCompletion();
  }

  /** เรียกเมื่อแท็บกลับมาแสดง — วาดเฟรมทันทีจากเวลาจริง */
  sync(): void {
    if (this.clock.status !== 'running') return;
    if (this.checkComplete()) return;
    this.hooks.onFrame(this.elapsed());
    this.ensureLoop();
  }

  dispose(): void {
    this.stopAsync();
  }

  private set(next: ClockState): void {
    if (next === this.clock) return;
    this.clock = next;
    this.hooks.onChange(next);
  }

  private ensureLoop(): void {
    if (this.frameId !== null) return;
    this.frameId = this.env.requestFrame(this.tick);
  }

  private readonly tick = (): void => {
    this.frameId = null;
    if (this.clock.status !== 'running') return;
    if (this.checkComplete()) return;
    this.hooks.onFrame(this.elapsed());
    if (this.clock.status === 'running') this.ensureLoop();
  };

  private checkComplete(): boolean {
    if (this.clock.status !== 'running') return false;
    const end = this.hooks.endElapsedMs();
    if (end === null) return false;
    const e = this.elapsed();
    if (e < end) return false;
    this.stopAsync();
    this.set(clockComplete(end));
    this.hooks.onComplete(end, e - end);
    return true;
  }

  private scheduleCompletion(): void {
    if (this.timerId !== null) {
      this.env.clearTimer(this.timerId);
      this.timerId = null;
    }
    const end = this.hooks.endElapsedMs();
    if (end === null || this.clock.status !== 'running') return;
    const wait = Math.min(MAX_TIMEOUT_MS, Math.max(0, end - this.elapsed()) + 1);
    this.timerId = this.env.setTimer(() => {
      this.timerId = null;
      if (!this.checkComplete()) this.scheduleCompletion();
    }, wait);
  }

  private stopAsync(): void {
    if (this.frameId !== null) {
      this.env.cancelFrame(this.frameId);
      this.frameId = null;
    }
    if (this.timerId !== null) {
      this.env.clearTimer(this.timerId);
      this.timerId = null;
    }
  }
}
