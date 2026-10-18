/**
 * โหมดเต็มหน้าจอของพื้นที่แอนิเมชัน
 * ใช้ Fullscreen API ถ้าเบราว์เซอร์อนุญาต ไม่งั้น (iPhone, หน้าที่ฝังแบบไม่ให้เต็มจอ) จะขยายเต็มหน้าต่างแทน
 * ออกด้วยปุ่ม, Esc หรือปุ่ม F
 */
import { useCallback, useEffect, useState, type RefObject } from 'react';

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const doc = document as FsDocument;
    const onChange = () => {
      const el = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setNative(!!el && el === ref.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [ref]);

  useEffect(() => {
    if (!fallback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFallback(false);
    };
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('fs-lock');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('fs-lock');
    };
  }, [fallback]);

  const enter = useCallback(async () => {
    const el = ref.current as FsElement | null;
    if (!el) return;
    try {
      if (document.fullscreenEnabled && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' });
        return;
      }
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        return;
      }
    } catch {
      // ถูกปฏิเสธ — ใช้แบบเต็มหน้าต่างแทน
    }
    setFallback(true);
  }, [ref]);

  const exit = useCallback(() => {
    const doc = document as FsDocument;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      const leave = doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
      void Promise.resolve(leave?.()).catch(() => {});
    }
    setFallback(false);
  }, []);

  const active = native || fallback;
  const toggle = useCallback(() => (active ? exit() : void enter()), [active, enter, exit]);
  return { active, enter, exit, toggle };
}
