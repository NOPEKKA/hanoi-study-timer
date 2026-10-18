/** ฟังก์ชันการเคลื่อนที่ที่ใช้ร่วมกัน */
import type { Pt } from './layout';

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** นุ่ม ไม่กระชาก — ความเร็วเป็นศูนย์ที่ต้นและปลาย */
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * ความยาวแต่ละช่วงของเส้นทางวงแหวน: ยกตรง (up) → โค้ง (arc) → แนวนอน (across) → โค้ง (arc) → ลงตรง (down)
 */
export function arcSegments(from: Pt, to: Pt, liftY: number, radius: number) {
  const dx = to.x - from.x;
  const r = Math.max(0, Math.min(radius, from.y - liftY, to.y - liftY, Math.abs(dx) / 2));
  const up = Math.max(0, from.y - liftY - r);
  const arc = (Math.PI * r) / 2;
  const across = Math.max(0, Math.abs(dx) - 2 * r);
  const down = Math.max(0, to.y - liftY - r);
  return { r, up, arc, across, down, total: up + arc + across + arc + down };
}

/**
 * เส้นโค้ง monotone (Fritsch–Butland) ผ่านจุด (t[i], s[i]) — ความชันเป็นศูนย์ที่ต้นและปลาย
 * แต่ไม่หยุดที่จุดกลาง ใช้ทำให้วัตถุผ่านแต่ละจุดตามเวลาที่กำหนดโดยไม่ชะลอจนหยุด
 */
export function monotoneEase(t: number, ts: readonly number[], ss: readonly number[]): number {
  const n = ts.length;
  if (t <= ts[0]) return ss[0];
  if (t >= ts[n - 1]) return ss[n - 1];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ss[i + 1] - ss[i]) / (ts[i + 1] - ts[i]));
  const m: number[] = [0];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] > 0 && d[i] > 0 ? (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]) : 0);
  m.push(0);
  let i = 0;
  while (i < n - 2 && t > ts[i + 1]) i++;
  const h = ts[i + 1] - ts[i];
  const u = (t - ts[i]) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * ss[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ss[i + 1] + (u3 - u2) * h * m[i + 1]
  );
}

/**
 * จุดบนเส้นทางวงแหวน: ยกตรงขึ้นจนพ้นยอดเสา → โค้ง → เลื่อนแนวนอน → โค้ง → ลดลงตรงลงเสา
 * s = 0..1 ตามความยาวเส้นทาง (ความเร็วสม่ำเสมอตลอดทาง รวมช่วงโค้ง)
 */
export function pointOnArc(from: Pt, to: Pt, liftY: number, radius: number, s: number): Pt {
  const dx = to.x - from.x;
  const dir = dx < 0 ? -1 : 1;
  const { r, up, arc, across, total } = arcSegments(from, to, liftY, radius);
  if (total <= 0) return { ...to };
  let d = clamp01(s) * total;

  if (d <= up) return { x: from.x, y: from.y - d };
  d -= up;
  if (d <= arc) {
    const a = r > 0 ? d / r : 0;
    return { x: from.x + dir * r - dir * r * Math.cos(a), y: liftY + r - r * Math.sin(a) };
  }
  d -= arc;
  if (d <= across) return { x: from.x + dir * (r + d), y: liftY };
  d -= across;
  if (d <= arc) {
    const a = r > 0 ? d / r : 0;
    return { x: to.x - dir * r + dir * r * Math.sin(a), y: liftY + r - r * Math.cos(a) };
  }
  d -= arc;
  return { x: to.x, y: Math.min(to.y, liftY + r + d) };
}
