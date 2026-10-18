/**
 * บันทึกการตั้งค่าและเซสชันลง localStorage
 * - การตั้งค่า: โหลดอัตโนมัติทุกครั้งที่เปิด
 * - เซสชันที่ยังไม่จบ: เสนอปุ่ม "กู้คืน" หลังรีเฟรช ถ้าเซสชันกำลังเดินอยู่ตอนปิด
 *   เวลาที่ปิดไปจะถูกนับด้วย (เหมือนนาฬิกาจับเวลาจริง)
 * อ่าน/เขียนทุกครั้งห่อด้วย try/catch — ถ้าใช้ storage ไม่ได้ แอปยังทำงานปกติ แค่จำไม่ได้
 */
import {
  ENDLESS_MULTIPLIERS,
  MAX_RINGS,
  MIN_RINGS,
  TARGET_MAX_MINUTES,
  TARGET_MIN_MINUTES,
  TARGET_PRESETS_MIN,
  type Multiplier,
} from '../config';
import type { EndlessRun } from '../modes/endless';

export type Mode = 'endless' | 'target' | 'lifter';
export const MODES: readonly Mode[] = ['endless', 'target', 'lifter'];

export interface DurationChoice {
  /** นาทีของปุ่มลัด หรือ null = กำหนดเอง */
  preset: number | null;
  customH: number;
  customM: number;
}

export type ThemePref = 'system' | 'dark' | 'light';
export const THEME_PREFS: readonly ThemePref[] = ['system', 'dark', 'light'];

export interface Prefs {
  mode: Mode;
  endlessRings: number;
  multiplier: Multiplier;
  target: DurationChoice;
  lifter: DurationChoice;
  sound: boolean;
  theme: ThemePref;
}

export const DEFAULT_PREFS: Prefs = {
  mode: 'target',
  endlessRings: 8,
  multiplier: 1,
  target: { preset: 25, customH: 1, customM: 30 },
  lifter: { preset: 25, customH: 1, customM: 30 },
  sound: true,
  theme: 'system',
};

export function durationMinutes(c: DurationChoice): number {
  return c.preset ?? c.customH * 60 + c.customM;
}

export function isValidMinutes(min: number): boolean {
  return Number.isInteger(min) && min >= TARGET_MIN_MINUTES && min <= TARGET_MAX_MINUTES;
}

/** แปลงนาทีกลับเป็นตัวเลือก (ใช้ตอนกู้คืนเซสชัน) */
export function choiceFromMinutes(min: number): DurationChoice {
  if ((TARGET_PRESETS_MIN as readonly number[]).includes(min)) return { preset: min, customH: 1, customM: 30 };
  return { preset: null, customH: Math.floor(min / 60), customM: min % 60 };
}

export interface SavedSession {
  v: 1;
  mode: Mode;
  status: 'running' | 'paused';
  elapsedMs: number;
  /** Date.now() ตอนบันทึก */
  savedAt: number;
  endlessRings: number;
  targetMinutes: number;
  run: EndlessRun | null;
}

/** เวลาที่ผ่านไปเมื่อกู้คืน — ถ้ากำลังเดินอยู่ตอนบันทึก จะบวกเวลาที่ปิดไปด้วย */
export function restoredElapsedMs(s: SavedSession, nowEpochMs: number): number {
  return s.status === 'running' ? s.elapsedMs + Math.max(0, nowEpochMs - s.savedAt) : s.elapsedMs;
}

const PREFS_KEY = 'hanoi-study-timer:prefs:v1';
const SESSION_KEY = 'hanoi-study-timer:session:v1';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isInt = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;

function parseChoice(x: unknown, fallback: DurationChoice): DurationChoice {
  if (!isObj(x)) return fallback;
  const preset = x.preset === null ? null : (TARGET_PRESETS_MIN as readonly unknown[]).includes(x.preset) ? (x.preset as number) : fallback.preset;
  const customH = isInt(x.customH, 0, 12) ? x.customH : fallback.customH;
  const customM = isInt(x.customM, 0, 59) ? x.customM : fallback.customM;
  return { preset, customH, customM };
}

export function parsePrefs(raw: string | null): Prefs {
  let x: unknown;
  try {
    x = raw ? JSON.parse(raw) : null;
  } catch {
    x = null;
  }
  if (!isObj(x)) return DEFAULT_PREFS;
  return {
    mode: (MODES as readonly unknown[]).includes(x.mode) ? (x.mode as Mode) : DEFAULT_PREFS.mode,
    endlessRings: isInt(x.endlessRings, MIN_RINGS, MAX_RINGS) ? x.endlessRings : DEFAULT_PREFS.endlessRings,
    multiplier: (ENDLESS_MULTIPLIERS as readonly unknown[]).includes(x.multiplier)
      ? (x.multiplier as Multiplier)
      : DEFAULT_PREFS.multiplier,
    target: parseChoice(x.target, DEFAULT_PREFS.target),
    lifter: parseChoice(x.lifter, DEFAULT_PREFS.lifter),
    sound: typeof x.sound === 'boolean' ? x.sound : DEFAULT_PREFS.sound,
    theme: (THEME_PREFS as readonly unknown[]).includes(x.theme) ? (x.theme as ThemePref) : DEFAULT_PREFS.theme,
  };
}

function parseRun(x: unknown, rings: number): EndlessRun | null {
  if (!isObj(x)) return null;
  const total = 2 ** rings - 1;
  if (x.n !== rings || x.totalMoves !== total) return null;
  if (!(ENDLESS_MULTIPLIERS as readonly unknown[]).includes(x.multiplier)) return null;
  if (!isNum(x.anchorElapsedMs) || !isNum(x.anchorMoves) || !isNum(x.anchorAccelMs)) return null;
  if (x.anchorElapsedMs < 0 || x.anchorMoves < 0 || x.anchorMoves > total || x.anchorAccelMs < 0) return null;
  return {
    n: rings,
    totalMoves: total,
    multiplier: x.multiplier as number,
    anchorElapsedMs: x.anchorElapsedMs,
    anchorMoves: x.anchorMoves,
    anchorAccelMs: x.anchorAccelMs,
  };
}

export function parseSession(raw: string | null): SavedSession | null {
  let x: unknown;
  try {
    x = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (!isObj(x) || x.v !== 1) return null;
  if (!(MODES as readonly unknown[]).includes(x.mode)) return null;
  if (x.status !== 'running' && x.status !== 'paused') return null;
  if (!isNum(x.elapsedMs) || x.elapsedMs < 0 || !isNum(x.savedAt)) return null;
  if (!isInt(x.endlessRings, MIN_RINGS, MAX_RINGS)) return null;
  if (!isInt(x.targetMinutes, TARGET_MIN_MINUTES, TARGET_MAX_MINUTES)) return null;
  const mode = x.mode as Mode;
  const run = parseRun(x.run, x.endlessRings);
  if (mode === 'endless' && !run) return null;
  return {
    v: 1,
    mode,
    status: x.status,
    elapsedMs: x.elapsedMs,
    savedAt: x.savedAt,
    endlessRings: x.endlessRings,
    targetMinutes: x.targetMinutes,
    run: mode === 'endless' ? run : null,
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage เต็มหรือถูกบล็อก — ข้าม
  }
}

export const store = {
  loadPrefs: (): Prefs => parsePrefs(read(PREFS_KEY)),
  savePrefs: (p: Prefs): void => write(PREFS_KEY, JSON.stringify(p)),
  loadSession: (): SavedSession | null => parseSession(read(SESSION_KEY)),
  saveSession: (s: SavedSession): void => write(SESSION_KEY, JSON.stringify(s)),
  clearSession: (): void => write(SESSION_KEY, null),
};
