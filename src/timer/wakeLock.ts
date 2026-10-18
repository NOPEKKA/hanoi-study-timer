/**
 * Screen Wake Lock — กันหน้าจอดับขณะ Running
 * เบราว์เซอร์ที่ไม่รองรับ หรือขอไม่สำเร็จ จะข้ามไปเงียบ ๆ
 * เบราว์เซอร์ปล่อย lock เองเมื่อแท็บถูกซ่อน จึงขอใหม่เมื่อแท็บกลับมา
 */
export interface WakeLockController {
  setWanted(wanted: boolean): void;
  /** เรียกเมื่อแท็บกลับมาแสดง */
  refresh(): void;
}

export function createWakeLock(): WakeLockController {
  let sentinel: WakeLockSentinel | null = null;
  let wanted = false;
  let pending = false;

  async function acquire(): Promise<void> {
    if (!wanted || sentinel || pending) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    pending = true;
    try {
      const s = await navigator.wakeLock.request('screen');
      if (!wanted) {
        void s.release().catch(() => {});
      } else {
        sentinel = s;
        s.addEventListener('release', () => {
          if (sentinel === s) sentinel = null;
        });
      }
    } catch {
      // ไม่รองรับ / ถูกปฏิเสธ / แบตต่ำ — ข้ามเงียบ ๆ
    } finally {
      pending = false;
    }
  }

  return {
    setWanted(next) {
      wanted = next;
      if (next) {
        void acquire();
      } else if (sentinel) {
        const s = sentinel;
        sentinel = null;
        void s.release().catch(() => {});
      }
    },
    refresh() {
      void acquire();
    },
  };
}
