import { memo, type ReactNode } from 'react';
import type { RunStatus } from '../timer/clock';
import type { Mode, ThemePref } from '../timer/persistence';
import { formatInt, formatPercent, formatTimeOfDay } from './format';

export const MODE_LABEL: Record<Mode, string> = {
  endless: 'ต่อเนื่อง',
  target: 'ตั้งเวลา',
  lifter: 'คนยก',
};

export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="mode-switch" role="tablist" aria-label="เลือกโหมด">
      {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={m === mode}
          className={m === mode ? 'active' : ''}
          onClick={() => m !== mode && onChange(m)}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePref; label: string; icon: ReactNode }[] = [
  {
    value: 'system',
    label: 'ตามระบบ',
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'มืด',
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: 'light',
    label: 'สว่าง',
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="8" cy="8" r="3" fill="currentColor" />
        <path
          d="M8 1.2v1.9M8 12.9v1.9M1.2 8h1.9M12.9 8h1.9M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M3.2 12.8l1.3-1.3M11.5 4.5l1.3-1.3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function ThemeSwitch({ value, onChange }: { value: ThemePref; onChange: (t: ThemePref) => void }) {
  return (
    <div className="theme-switch" role="radiogroup" aria-label="ธีมสี">
      {THEME_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.label}
          title={o.label}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

export function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
      <path
        d={
          exit
            ? 'M6 2.5V6H2.5M10 2.5V6h3.5M6 13.5V10H2.5M10 13.5V10h3.5'
            : 'M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10'
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const ProgressPanel = memo(function ProgressPanel({
  rings,
  completed,
  total,
  percent,
}: {
  rings: number;
  completed: number;
  total: number;
  percent: number;
}) {
  return (
    <section className="panel progress-panel" aria-label="ความคืบหน้า">
      <div className="stat-row">
        <Stat label="วงแหวน" value={formatInt(rings)} />
        <Stat
          label="ย้ายแล้ว"
          value={
            <>
              {formatInt(completed)}
              <span className="of"> / {formatInt(total)}</span>
            </>
          }
        />
        <Stat label="ความคืบหน้า" value={formatPercent(percent)} />
      </div>
      <div
        className="bar"
        role="progressbar"
        aria-label="ความคืบหน้า"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent * 100) / 100}
      >
        <div className="bar-fill" style={{ transform: `scaleX(${Math.min(1, percent / 100)})` }} />
      </div>
    </section>
  );
});

export function Controls({
  status,
  canStart,
  sound,
  onStart,
  onPause,
  onResume,
  onReset,
  onToggleSound,
}: {
  status: RunStatus;
  canStart: boolean;
  sound: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onToggleSound: () => void;
}) {
  return (
    <div className="controls">
      <div className="control-buttons">
        {status === 'idle' && (
          <button type="button" className="btn primary" onClick={onStart} disabled={!canStart}>
            <PlayIcon /> เริ่ม
          </button>
        )}
        {status === 'running' && (
          <button type="button" className="btn" onClick={onPause}>
            <PauseIcon /> หยุดชั่วคราว
          </button>
        )}
        {status === 'paused' && (
          <button type="button" className="btn primary" onClick={onResume}>
            <PlayIcon /> ทำต่อ
          </button>
        )}
        <button
          type="button"
          className={status === 'completed' ? 'btn primary' : 'btn ghost'}
          onClick={onReset}
          disabled={status === 'idle'}
        >
          <ResetIcon /> รีเซ็ต
        </button>
      </div>
      <label className="switch">
        <input type="checkbox" checked={sound} onChange={onToggleSound} />
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span>เสียงแจ้งเมื่อเสร็จ</span>
      </label>
    </div>
  );
}

const STATUS_TEXT: Record<RunStatus, string> = {
  idle: 'พร้อมเริ่ม',
  running: 'กำลังทำงาน',
  paused: 'หยุดชั่วคราว',
  completed: 'เสร็จแล้ว',
};

export function StatusLine({ status, completedAt }: { status: RunStatus; completedAt: number | null }) {
  return (
    <p className={`status status-${status}`} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      {STATUS_TEXT[status]}
      {status === 'completed' && completedAt !== null && (
        <span className="status-sub"> เมื่อ {formatTimeOfDay(completedAt)} น.</span>
      )}
    </p>
  );
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
    </svg>
  );
}
export function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="3.5" y="2.8" width="3" height="10.4" rx="1" fill="currentColor" />
      <rect x="9.5" y="2.8" width="3" height="10.4" rx="1" fill="currentColor" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3.2 2.6v2.6h2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
