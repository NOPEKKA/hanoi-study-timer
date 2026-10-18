/**
 * สีวงแหวน: ไล่เฉดใน OKLCH ที่ความสว่างและความสดเท่ากันทุกวง
 * จึงสดแต่ไม่มีวงไหนแสบตากว่าวงอื่น — แปลงเป็น hex เองเพื่อให้ใช้ได้ทุกเบราว์เซอร์
 */

export function oklchToHex(L: number, C: number, hueDeg: number): string {
  const h = (hueDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    '#' +
    rgb
      .map((x) => {
        const c = Math.min(1, Math.max(0, x));
        const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(v * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

const cache = new Map<string, string>();

export type Theme = 'dark' | 'light';

/**
 * วงใหญ่สุดเป็นสีส้มอิฐ ไล่ผ่านเหลือง เขียว ฟ้า ม่วง ถึงชมพูที่วงเล็กสุด
 * ธีมสว่างใช้สีเข้มขึ้นเล็กน้อย จะได้ไม่จางไปกับผนังสีครีม
 */
export function ringColor(disk: number, n: number, theme: Theme = 'dark'): string {
  const key = `${disk}/${n}/${theme}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = n <= 1 ? 0 : (n - 1 - disk) / (n - 1);
  const color = theme === 'dark' ? oklchToHex(0.74, 0.12, 32 + t * 310) : oklchToHex(0.67, 0.135, 32 + t * 310);
  cache.set(key, color);
  return color;
}
