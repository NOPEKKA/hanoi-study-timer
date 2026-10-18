/**
 * ธีมมืด/สว่าง
 * - "ระบบ": ตามหน้าที่ฝังแอปอยู่ (data-theme) ถ้ามี ไม่งั้นตาม prefers-color-scheme ของเครื่อง
 * - "มืด"/"สว่าง": บังคับด้วย data-app-theme บน <html> (ไม่แตะ data-theme ของหน้าที่ฝังอยู่)
 * CSS อ่านแอตทริบิวต์เหล่านี้เอง ส่วนสีวงแหวน (คำนวณใน JS) ใช้ค่าที่ hook นี้คืนให้
 */
import { useEffect, useState } from 'react';
import type { Theme } from '../render/colors';
import type { ThemePref } from '../timer/persistence';

function systemTheme(): Theme {
  const host = document.documentElement.getAttribute('data-theme');
  if (host === 'dark' || host === 'light') return host;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme(pref: ThemePref): Theme {
  const [system, setSystem] = useState<Theme>(() => (typeof window === 'undefined' ? 'dark' : systemTheme()));

  useEffect(() => {
    const root = document.documentElement;
    if (pref === 'system') root.removeAttribute('data-app-theme');
    else root.setAttribute('data-app-theme', pref);
  }, [pref]);

  useEffect(() => {
    const update = () => setSystem(systemTheme());
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    mq?.addEventListener?.('change', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq?.removeEventListener?.('change', update);
      mo.disconnect();
    };
  }, []);

  return pref === 'system' ? system : pref;
}
