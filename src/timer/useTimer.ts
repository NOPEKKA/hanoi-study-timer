/**
 * React hook ห่อ TimerEngine: ใช้ performance.now() + requestAnimationFrame จริง
 * พร้อม Wake Lock และวาดเฟรมทันทีเมื่อแท็บกลับมาแสดง
 *
 * frameMs คือเวลาที่ผ่านไป ณ เฟรมล่าสุดที่วาด — อัตราการวาดกำหนดโดย nextFrameDelay
 * (0 = ทุกเฟรมตอนมีของเคลื่อนที่, มากกว่านั้นตอนนิ่ง เพื่อประหยัดแบต)
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clockElapsed, IDLE_CLOCK, type ClockState } from './clock';
import { TimerEngine, type EngineEnv } from './engine';
import { createWakeLock } from './wakeLock';

export interface UseTimerOptions {
  endElapsedMs(): number | null;
  onComplete(endElapsedMs: number, lateByMs: number): void;
  /** อีกกี่ ms (ของเวลาที่ผ่านไป) จึงต้องวาดเฟรมถัดไป */
  nextFrameDelay(elapsedMs: number): number;
}

const browserEnv: EngineEnv = {
  now: () => performance.now(),
  requestFrame: (cb) => window.requestAnimationFrame(() => cb()),
  cancelFrame: (id) => window.cancelAnimationFrame(id),
  setTimer: (cb, ms) => window.setTimeout(cb, ms),
  clearTimer: (id) => window.clearTimeout(id),
};

export function useTimer(opts: UseTimerOptions) {
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    optsRef.current = opts;
  });

  const [clock, setClock] = useState<ClockState>(IDLE_CLOCK);
  const [frameMs, setFrameMs] = useState(0);
  const nextRenderAt = useRef(-Infinity);

  const [engine] = useState(
    () =>
      new TimerEngine(browserEnv, {
        endElapsedMs: () => optsRef.current.endElapsedMs(),
        onFrame: (e) => {
          if (e < nextRenderAt.current) return;
          nextRenderAt.current = e + Math.max(0, optsRef.current.nextFrameDelay(e));
          setFrameMs(e);
        },
        onChange: (c) => {
          nextRenderAt.current = -Infinity;
          setClock(c);
          setFrameMs(clockElapsed(c, performance.now()));
        },
        onComplete: (end, late) => optsRef.current.onComplete(end, late),
      }),
  );
  const [wake] = useState(createWakeLock);

  useEffect(() => {
    wake.setWanted(clock.status === 'running');
  }, [clock.status, wake]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      nextRenderAt.current = -Infinity;
      engine.sync();
      wake.refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      engine.dispose();
      wake.setWanted(false);
    };
  }, [engine, wake]);

  /** บังคับวาดใหม่จากเวลาปัจจุบัน (เช่น หลังเปลี่ยนตัวคูณ) */
  const redraw = () => {
    nextRenderAt.current = -Infinity;
    setFrameMs(engine.elapsed());
  };

  const elapsedForRender = clock.status === 'running' ? frameMs : clock.accumulatedMs;
  return { clock, elapsedMs: elapsedForRender, engine, redraw };
}
