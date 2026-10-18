import { describe, expect, it } from 'vitest';
import { createEndlessRun } from '../modes/endless';
import { choiceFromMinutes, DEFAULT_PREFS, parsePrefs, parseSession, restoredElapsedMs, type SavedSession } from './persistence';

const base: SavedSession = {
  v: 1,
  mode: 'target',
  status: 'running',
  elapsedMs: 60_000,
  savedAt: 1_700_000_000_000,
  endlessRings: 8,
  targetMinutes: 45,
  run: null,
};

describe('บันทึก/กู้คืนเซสชัน', () => {
  it('เซสชันที่เดินอยู่: นับเวลาที่ปิดไปด้วย', () => {
    expect(restoredElapsedMs(base, base.savedAt + 90_000)).toBe(150_000);
  });

  it('เซสชันที่หยุดไว้: ไม่นับเวลาที่ปิดไป', () => {
    expect(restoredElapsedMs({ ...base, status: 'paused' }, base.savedAt + 90_000)).toBe(60_000);
  });

  it('อ่านกลับได้ครบ และปฏิเสธข้อมูลเสีย', () => {
    expect(parseSession(JSON.stringify(base))).toEqual(base);
    const endless = { ...base, mode: 'endless', run: createEndlessRun(8, 50) };
    expect(parseSession(JSON.stringify(endless))?.run?.multiplier).toBe(50);
    expect(parseSession(null)).toBeNull();
    expect(parseSession('{bad json')).toBeNull();
    expect(parseSession(JSON.stringify({ ...base, status: 'completed' }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...base, targetMinutes: 0 }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...base, mode: 'endless', run: null }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...endless, run: { ...endless.run, n: 9 } }))).toBeNull();
  });

  it('การตั้งค่าเสียใช้ค่าตั้งต้น', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"endlessRings": 99, "multiplier": 3, "mode": "x"}')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"theme": "light"}').theme).toBe('light');
    expect(parsePrefs('{"theme": "purple"}').theme).toBe('system');
    expect(parsePrefs('{"endlessRings": 12, "multiplier": 1000, "mode": "endless"}')).toMatchObject({
      endlessRings: 12,
      multiplier: 1000,
      mode: 'endless',
    });
  });

  it('แปลงนาทีกลับเป็นตัวเลือก', () => {
    expect(choiceFromMinutes(45)).toMatchObject({ preset: 45 });
    expect(choiceFromMinutes(95)).toEqual({ preset: null, customH: 1, customM: 35 });
  });
});
