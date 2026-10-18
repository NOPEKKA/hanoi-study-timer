/** การแสดงผลตัวเลขและเวลาเป็นภาษาไทย */

const pad = (n: number) => String(n).padStart(2, '0');

/** ms → "HH:MM:SS" (มี "N วัน" นำหน้าถ้าเกิน 24 ชม.) — round: 'floor' สำหรับเวลาที่ผ่านไป, 'ceil' สำหรับเวลาที่เหลือ */
export function formatClock(ms: number, round: 'floor' | 'ceil' = 'floor'): string {
  const totalSec = Math.max(0, round === 'ceil' ? Math.ceil(ms / 1000 - 1e-9) : Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days > 0 ? `${days.toLocaleString('th-TH')} วัน ${hms}` : hms;
}

/** ระยะเวลาแบบคำ เช่น "45 นาที", "1 ชม. 30 นาที", "12 วัน 3 ชม." */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec} วินาที`;
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days.toLocaleString('th-TH')} วัน`);
  if (h) parts.push(`${h} ชม.`);
  if (m && days === 0) parts.push(`${m} นาที`);
  if (s && days === 0 && h === 0) parts.push(`${s} วินาที`);
  return parts.join(' ') || '0 วินาที';
}

export function formatSeconds(ms: number, digits = 2): string {
  return `${(ms / 1000).toFixed(digits)} วิ`;
}

export function formatInt(n: number | bigint): string {
  return n.toLocaleString('th-TH');
}

export function formatPercent(p: number): string {
  if (p >= 100) return '100%';
  return `${(Math.floor(p * 100) / 100).toFixed(2)}%`;
}

export function formatTimeOfDay(epochMs: number, withSeconds = true): string {
  const d = new Date(epochMs);
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base;
}

/** "25 นาที", "1 ชั่วโมง", "2 ชม. 30 นาที" สำหรับปุ่มและป้าย */
export function formatMinutesLabel(min: number): string {
  if (min < 60) return `${min} นาที`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h} ชั่วโมง`;
  return `${h} ชม. ${m} นาที`;
}
