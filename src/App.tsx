import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FAST_MAX_FPS, type Multiplier } from './config';
import {
  changeMultiplier,
  createEndlessRun,
  endlessAccelMsAt,
  endlessEndElapsedMs,
  endlessProgress,
  isFastMode,
  movesPerSecond,
  msPerMove,
  type EndlessRun,
} from './modes/endless';
import { progressPercent, type Progress } from './modes/progress';
import { LIFTER_CONFIG, planTarget, scheduleProgress, TARGET_CONFIG, type TargetPlan } from './modes/targetPlan';
import { FastRingAnimator } from './render/fastRings';
import { towerLayout } from './render/layout';
import { lifterFrame, type LifterPose } from './render/lifterPose';
import { animatedRings, stackInfo, type RingSprite } from './render/scene';
import { playChime, unlockAudio } from './timer/chime';
import {
  choiceFromMinutes,
  durationMinutes,
  isValidMinutes,
  restoredElapsedMs,
  store,
  type DurationChoice,
  type Mode,
  type Prefs,
  type SavedSession,
  type ThemePref,
} from './timer/persistence';
import { useTimer } from './timer/useTimer';
import { ConfirmDialog, RestoreBanner } from './ui/Dialogs';
import { formatClock, formatDuration, formatInt, formatPercent, formatTimeOfDay } from './ui/format';
import {
  Controls,
  FullscreenIcon,
  MODE_LABEL,
  ModeSwitch,
  PauseIcon,
  PlayIcon,
  ProgressPanel,
  StatusLine,
  ThemeSwitch,
} from './ui/Panels';
import { EndlessSettings, TargetSettings } from './ui/Settings';
import { sceneViewBox, TowerScene, type Hud } from './ui/TowerScene';
import { useFullscreen } from './ui/useFullscreen';
import { useTheme } from './ui/useTheme';

interface PendingConfirm {
  message: string;
  action: () => void;
}

interface Live {
  mode: Mode;
  plan: TargetPlan;
  prefs: Prefs;
  targetMinutes: number;
}

function planFor(mode: Mode, minutes: number): TargetPlan {
  return planTarget(minutes * 60_000, mode === 'lifter' ? LIFTER_CONFIG : TARGET_CONFIG);
}

/** เวลานาฬิกาปัจจุบันที่อัปเดตทุกวินาที (ใช้ตอนไม่ได้รัน เพื่อให้เวลาที่คาดว่าจะเสร็จเดินตาม) */
function useWallClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/** ขนาดของกล่องฉาก (ใช้ปรับขนาดตัวหนังสือในฉากบนจอเล็ก) */
function useBoxSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 960, h: 540 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize((s) => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** ซ่อนปุ่มบนฉากหลังไม่ได้ขยับเมาส์/แตะสักพัก (ใช้ตอนเต็มจอ) */
function useAutoHide(active: boolean, ref: RefObject<HTMLElement | null>): boolean {
  const [awake, setAwake] = useState(true);
  useEffect(() => {
    if (!active) {
      setAwake(true);
      return;
    }
    let timer = 0;
    const wake = () => {
      setAwake(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setAwake(false), 2500);
    };
    wake();
    const el = ref.current;
    el?.addEventListener('pointermove', wake);
    el?.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.clearTimeout(timer);
      el?.removeEventListener('pointermove', wake);
      el?.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [active, ref]);
  return awake;
}

export default function App() {
  const [prefs, setPrefs] = useState<Prefs>(() => store.loadPrefs());
  const [saved, setSaved] = useState<SavedSession | null>(() => store.loadSession());
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const theme = useTheme(prefs.theme);

  const runRef = useRef<EndlessRun>(createEndlessRun(prefs.endlessRings, prefs.multiplier));
  const [run, setRunState] = useState<EndlessRun>(runRef.current);
  const setRun = useCallback((r: EndlessRun) => {
    runRef.current = r;
    setRunState(r);
  }, []);
  /** เปลี่ยนทุกครั้งที่เริ่มเซสชันใหม่ ให้ภาพโหมดเร่งเริ่มจากสถานะจริง */
  const sessionRef = useRef(0);
  const [fastAnimator] = useState(() => new FastRingAnimator());

  const mode = prefs.mode;
  const choice = mode === 'lifter' ? prefs.lifter : prefs.target;
  const targetMinutes = durationMinutes(choice);
  const targetValid = isValidMinutes(targetMinutes);
  const plan = useMemo(() => planFor(mode, targetMinutes), [mode, targetMinutes]);

  // ค่าล่าสุดสำหรับ callback ของตัวจับเวลา (อ่านนอกรอบ render)
  const live = useRef<Live>({ mode, plan, prefs, targetMinutes });
  useLayoutEffect(() => {
    live.current = { mode, plan, prefs, targetMinutes };
  });
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const timer = useTimer({
    endElapsedMs: () => (live.current.mode === 'endless' ? endlessEndElapsedMs(runRef.current) : live.current.plan.totalMs),
    onComplete: (_end, lateMs) => {
      setCompletedAt(Date.now() - lateMs);
      if (live.current.prefs.sound && lateMs < 3000) playChime();
      if (!savedRef.current) store.clearSession();
    },
    nextFrameDelay: (e) => {
      const L = live.current;
      if (L.mode === 'endless') {
        const r = runRef.current;
        if (isFastMode(r.multiplier)) return 0;
        const p = endlessProgress(r, e);
        return p.rest ? Math.min(100, p.rest.untilMs) : 0;
      }
      const p = scheduleProgress(L.plan, e);
      // คนยกขยับตลอด (เดิน/โยกตัว) จึงวาดทุกเฟรม
      if (L.mode === 'lifter') return 0;
      return p.rest ? Math.min(100, p.rest.untilMs) : 0;
    },
  });
  const { clock, engine } = timer;
  const status = clock.status;
  const hasProgress = status === 'running' || status === 'paused';

  // ---------------------------------------------------------- persistence
  const persist = useCallback(() => {
    const c = engine.state;
    if (c.status !== 'running' && c.status !== 'paused') return;
    const L = live.current;
    store.saveSession({
      v: 1,
      mode: L.mode,
      status: c.status,
      elapsedMs: engine.elapsed(),
      savedAt: Date.now(),
      endlessRings: L.prefs.endlessRings,
      targetMinutes: isValidMinutes(L.targetMinutes) ? L.targetMinutes : 25,
      run: L.mode === 'endless' ? runRef.current : null,
    });
  }, [engine]);

  useEffect(() => {
    store.savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (status !== 'running') return;
    const id = window.setInterval(persist, 15_000);
    return () => window.clearInterval(id);
  }, [status, persist]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [persist]);

  // ---------------------------------------------------------- actions
  const clearStoredSession = () => {
    if (!savedRef.current) store.clearSession();
  };

  const resetTo = (next: Prefs) => {
    engine.reset();
    sessionRef.current++;
    setCompletedAt(null);
    setRun(createEndlessRun(next.endlessRings, next.multiplier));
    clearStoredSession();
  };

  /** เปลี่ยนการตั้งค่าที่ต้องรีเซ็ต — ถ้ามีความคืบหน้าอยู่ให้ถามก่อน */
  const applyPrefs = (patch: Partial<Prefs>, message: string) => {
    const action = () => {
      // อัปเดตแบบ functional — ไม่ทับค่าที่เพิ่งเปลี่ยนไปก่อนหน้า (เช่นธีม)
      setPrefs((p) => ({ ...p, ...patch }));
      resetTo({ ...live.current.prefs, ...patch });
    };
    if (hasProgress) setConfirm({ message, action });
    else action();
  };

  const onMode = (m: Mode) => applyPrefs({ mode: m }, `การเปลี่ยนไปโหมด "${MODE_LABEL[m]}" จะล้างเวลาและความคืบหน้าของเซสชันนี้`);
  const onRings = (n: number) => applyPrefs({ endlessRings: n }, `การเปลี่ยนเป็น ${n} วง จะล้างเวลาและความคืบหน้าของเซสชันนี้`);
  const onChoice = (c: DurationChoice) => {
    const min = durationMinutes(c);
    const label = isValidMinutes(min) ? formatDuration(min * 60_000) : 'เวลาใหม่';
    applyPrefs(mode === 'lifter' ? { lifter: c } : { target: c }, `การเปลี่ยนเป้าหมายเป็น ${label} จะล้างเวลาและความคืบหน้าของเซสชันนี้`);
  };

  const onMultiplier = (m: Multiplier) => {
    setPrefs((p) => ({ ...p, multiplier: m }));
    if (engine.state.status === 'idle') {
      setRun(createEndlessRun(prefs.endlessRings, m));
      return;
    }
    // เปลี่ยนระหว่างรัน: ยึดตำแหน่งปัจจุบันแล้วเดินต่อด้วยความเร็วใหม่ (ไม่รีเซ็ต)
    setRun(changeMultiplier(runRef.current, engine.elapsed(), m));
    engine.reschedule();
    timer.redraw();
    persist();
  };

  const canStart = mode === 'endless' || targetValid;
  const onStart = () => {
    if (!canStart) return;
    if (prefs.sound) unlockAudio();
    if (saved) setSaved(null);
    engine.start();
    persist();
  };
  const onPause = () => {
    engine.pause();
    persist();
  };
  const onResume = () => {
    if (prefs.sound) unlockAudio();
    engine.start();
    persist();
  };
  const onReset = () => resetTo(prefs);
  const togglePlay = () => {
    const s = engine.state.status;
    if (s === 'idle') onStart();
    else if (s === 'running') onPause();
    else if (s === 'paused') onResume();
  };

  const onToggleSound = () => {
    const next = !prefs.sound;
    if (next) unlockAudio();
    setPrefs((p) => ({ ...p, sound: next }));
  };
  const onTheme = (t: ThemePref) => setPrefs((p) => ({ ...p, theme: t }));

  const onRestore = () => {
    const s = saved;
    if (!s) return;
    if (prefs.sound) unlockAudio();
    const next: Prefs = {
      ...prefs,
      mode: s.mode,
      endlessRings: s.endlessRings,
      multiplier: (s.run?.multiplier as Multiplier | undefined) ?? prefs.multiplier,
      ...(s.mode === 'target' ? { target: choiceFromMinutes(s.targetMinutes) } : {}),
      ...(s.mode === 'lifter' ? { lifter: choiceFromMinutes(s.targetMinutes) } : {}),
    };
    const nextPlan = planFor(s.mode, s.targetMinutes);
    // ตัวจับเวลาอ่านเวลาจบจาก live ทันที จึงต้องอัปเดตก่อน restore
    live.current = { mode: s.mode, plan: nextPlan, prefs: next, targetMinutes: s.targetMinutes };
    sessionRef.current++;
    setPrefs((p) => ({ ...next, theme: p.theme, sound: p.sound }));
    setRun(s.run ?? createEndlessRun(s.endlessRings, next.multiplier));
    setCompletedAt(null);
    setSaved(null);
    savedRef.current = null;
    engine.restore(s.status, restoredElapsedMs(s, Date.now()));
    persist();
  };

  const onDiscard = () => {
    store.clearSession();
    setSaved(null);
  };

  // ---------------------------------------------------------- fullscreen + shortcuts
  const sceneRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(sceneRef);
  const uiAwake = useAutoHide(fs.active, sceneRef);
  const box = useBoxSize(sceneRef);

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || confirm) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('input, textarea, select, button, [role="radio"], [role="tab"]')) return;
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      fs.toggle();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------------------------------------------------------- scene
  const elapsed = timer.elapsedMs;
  const n = mode === 'endless' ? run.n : plan.n;
  const kind = mode === 'lifter' ? 'lifter' : 'plain';
  const layout = useMemo(() => towerLayout(kind, n), [kind, n]);

  let progress: Progress;
  let rings: RingSprite[];
  let pose: LifterPose | null = null;
  if (mode === 'endless') {
    progress = endlessProgress(run, elapsed);
    if (isFastMode(run.multiplier) && hasProgress && !progress.done) {
      const truth = stackInfo(n, progress.completed);
      rings = fastAnimator.frame(layout, truth, elapsed, msPerMove(run.multiplier), `${n}:${sessionRef.current}`);
    } else {
      fastAnimator.reset();
      rings = animatedRings(layout, progress);
    }
  } else {
    progress = scheduleProgress(plan, elapsed);
    if (mode === 'lifter') {
      const frame = lifterFrame(layout, progress, plan.restMs);
      rings = frame.rings;
      pose = frame.pose;
    } else {
      rings = animatedRings(layout, progress);
    }
  }
  // โหมดภาพเร่ง: วงแหวนเคลื่อนทุกเฟรม แต่ตัวเลขเปลี่ยนไม่เกิน FAST_MAX_FPS ครั้ง/วินาที
  const textStep = 1000 / FAST_MAX_FPS;
  const fastText = mode === 'endless' && isFastMode(run.multiplier) && status === 'running';
  const textElapsed = fastText ? Math.floor(elapsed / textStep) * textStep : elapsed;
  if (fastText) progress = endlessProgress(run, textElapsed);
  const percent = progressPercent(progress);

  // ---------------------------------------------------------- เวลาในฉาก
  const wallNow = useWallClock(status !== 'running');
  const nowEpoch = status === 'running' ? Date.now() : wallNow;
  const stateWord = status === 'paused' ? ' · หยุดชั่วคราว' : status === 'completed' ? ' · เสร็จแล้ว' : '';
  let hud: Hud;
  if (mode === 'endless') {
    hud = {
      label: `เวลาจริง${stateWord}`,
      big: formatClock(textElapsed),
      info: [`เวลาเร่ง ${formatClock(endlessAccelMsAt(run, textElapsed))}`, `${formatInt(movesPerSecond(run.multiplier))} ครั้ง/วิ`],
      progress: null,
    };
  } else {
    const remaining = Math.max(0, plan.totalMs - elapsed);
    const finish =
      status === 'completed' && completedAt !== null
        ? `เสร็จเมื่อ ${formatTimeOfDay(completedAt)} น.`
        : targetValid
          ? `คาดว่าเสร็จ ${formatTimeOfDay(nowEpoch + remaining)} น.`
          : 'ตั้งเวลา 1 นาที – 12 ชม.';
    hud = {
      label: `เวลาที่เหลือ${stateWord}`,
      big: targetValid ? formatClock(remaining, 'ceil') : '--:--:--',
      info: [`ผ่านไป ${formatClock(elapsed)}`, finish],
      progress: null,
    };
  }
  if (fs.active) {
    hud.info.push(`ย้ายแล้ว ${formatInt(progress.completed)}/${formatInt(progress.total)} · ${formatPercent(percent)}`);
    hud.progress = percent / 100;
  }

  // จอเล็ก: ขยายตัวหนังสือในฉากให้อ่านออก (ตัวเลขใหญ่ไม่ต่ำกว่า ~30px)
  const [, , vbW, vbH] = sceneViewBox(kind);
  const ppu = fs.active ? Math.min(box.w / vbW, box.h / vbH) : Math.min(box.w / vbW, (window.innerHeight * 0.54) / vbH);
  const hudScale = Math.min(2.4, Math.max(1, 0.7 / Math.max(ppu, 0.01)));

  const restoreSummary = saved
    ? `${MODE_LABEL[saved.mode]}${
        saved.mode === 'endless' ? ` · ${saved.endlessRings} วง` : ` · ${formatDuration(saved.targetMinutes * 60_000)}`
      } · ผ่านไป ${formatClock(restoredElapsedMs(saved, wallNow))}${
        saved.status === 'running' ? ' (เดินต่อระหว่างที่ปิดไป)' : ' (หยุดไว้)'
      }`
    : '';

  const sceneLabel = `หอคอยฮานอย ${n} วง ย้ายแล้ว ${progress.completed} จาก ${progress.total} ครั้ง · ${hud.label} ${hud.big}`;
  const overlayHidden = fs.active && !uiAwake;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>หอคอยฮานอย</h1>
          <span>จับเวลาอ่านหนังสือ</span>
        </div>
        <div className="top-actions">
          <ModeSwitch mode={mode} onChange={onMode} />
          <ThemeSwitch value={prefs.theme} onChange={onTheme} />
        </div>
      </header>

      {saved && <RestoreBanner summary={restoreSummary} onRestore={onRestore} onDiscard={onDiscard} />}

      <div
        ref={sceneRef}
        className={`scene${fs.active ? ' is-fullscreen' : ''}${overlayHidden ? ' is-idle' : ''}`}
        onDoubleClick={(e) => {
          if (!(e.target as Element).closest('button')) fs.toggle();
        }}
      >
        <TowerScene layout={layout} rings={rings} pose={pose} label={sceneLabel} theme={theme} hud={hud} hudScale={hudScale} />
        <div className={`scene-overlay${overlayHidden ? ' is-hidden' : ''}`}>
          {fs.active && status !== 'completed' && (
            <button
              type="button"
              className="ov-btn"
              onClick={togglePlay}
              disabled={status === 'idle' && !canStart}
              aria-label={status === 'running' ? 'หยุดชั่วคราว' : status === 'paused' ? 'ทำต่อ' : 'เริ่ม'}
              title={status === 'running' ? 'หยุดชั่วคราว (Space)' : 'เริ่ม/ทำต่อ (Space)'}
            >
              {status === 'running' ? <PauseIcon /> : <PlayIcon />}
            </button>
          )}
          <button
            type="button"
            className="ov-btn"
            onClick={fs.toggle}
            aria-label={fs.active ? 'ออกจากเต็มจอ' : 'เต็มจอ'}
            title={fs.active ? 'ออกจากเต็มจอ (F หรือ Esc)' : 'เต็มจอ (F)'}
          >
            <FullscreenIcon exit={fs.active} />
          </button>
        </div>
      </div>

      <ProgressPanel rings={n} completed={progress.completed} total={progress.total} percent={percent} />

      <div className="lower">
        {mode === 'endless' ? (
          <EndlessSettings
            rings={prefs.endlessRings}
            multiplier={prefs.multiplier}
            totalMoves={run.totalMoves}
            realDurationMs={(run.totalMoves * 1000) / movesPerSecond(prefs.multiplier)}
            onRings={onRings}
            onMultiplier={onMultiplier}
          />
        ) : (
          <TargetSettings choice={choice} plan={plan} lifter={mode === 'lifter'} revision={revision} onChoice={onChoice} />
        )}
        <div className="action-col">
          <Controls
            status={status}
            canStart={canStart}
            sound={prefs.sound}
            onStart={onStart}
            onPause={onPause}
            onResume={onResume}
            onReset={onReset}
            onToggleSound={onToggleSound}
          />
          <StatusLine status={status} completedAt={completedAt} />
          <p className="hint shortcuts">
            ปุ่มลัด: <kbd>Space</kbd> เริ่ม/หยุด · <kbd>F</kbd> เต็มจอ
          </p>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel="รีเซ็ตและเปลี่ยน"
          onConfirm={() => {
            confirm.action();
            setConfirm(null);
          }}
          onCancel={() => {
            setConfirm(null);
            setRevision((r) => r + 1);
          }}
        />
      )}
    </div>
  );
}
