import { useEffect, useState } from 'react';
import {
  ENDLESS_MULTIPLIERS,
  MAX_RINGS,
  MIN_RINGS,
  TARGET_MAX_MINUTES,
  TARGET_MIN_MINUTES,
  TARGET_PRESETS_MIN,
  type Multiplier,
} from '../config';
import { lifterStepDurations } from '../modes/lifter';
import type { TargetPlan } from '../modes/targetPlan';
import { durationMinutes, isValidMinutes, type DurationChoice } from '../timer/persistence';
import { LIFTER_STEPS } from '../config';
import { formatDuration, formatInt, formatMinutesLabel, formatSeconds } from './format';

export function EndlessSettings({
  rings,
  multiplier,
  totalMoves,
  realDurationMs,
  onRings,
  onMultiplier,
}: {
  rings: number;
  multiplier: Multiplier;
  totalMoves: number;
  realDurationMs: number;
  onRings: (n: number) => void;
  onMultiplier: (m: Multiplier) => void;
}) {
  return (
    <section className="panel settings" aria-label="ตั้งค่าโหมดต่อเนื่อง">
      <div className="field">
        <span className="field-label" id="rings-label">
          จำนวนวงแหวน
        </span>
        <div className="stepper" role="group" aria-labelledby="rings-label">
          <button type="button" aria-label="ลดจำนวนวงแหวน" onClick={() => onRings(rings - 1)} disabled={rings <= MIN_RINGS}>
            −
          </button>
          <output aria-live="polite">{rings}</output>
          <button type="button" aria-label="เพิ่มจำนวนวงแหวน" onClick={() => onRings(rings + 1)} disabled={rings >= MAX_RINGS}>
            +
          </button>
        </div>
      </div>
      <div className="field">
        <span className="field-label" id="mult-label">
          ตัวคูณความเร็ว
        </span>
        <div className="chips" role="group" aria-labelledby="mult-label">
          {ENDLESS_MULTIPLIERS.map((m) => (
            <button
              key={m}
              type="button"
              className={m === multiplier ? 'chip active' : 'chip'}
              aria-pressed={m === multiplier}
              onClick={() => onMultiplier(m)}
            >
              {formatInt(m)}x
            </button>
          ))}
        </div>
      </div>
      <p className="hint">
        ทั้งหมด {formatInt(totalMoves)} ครั้ง · ที่ความเร็วนี้ใช้เวลาจริง {formatDuration(realDurationMs)}
      </p>
    </section>
  );
}

export function TargetSettings({
  choice,
  plan,
  lifter,
  revision,
  onChoice,
}: {
  choice: DurationChoice;
  plan: TargetPlan;
  lifter: boolean;
  /** เปลี่ยนค่านี้เพื่อล้างค่าที่พิมพ์ค้างไว้ (เช่น หลังกดยกเลิกการยืนยัน) */
  revision: number;
  onChoice: (c: DurationChoice) => void;
}) {
  const minutes = durationMinutes(choice);
  const valid = isValidMinutes(minutes);
  const [draftH, setDraftH] = useState(String(choice.customH));
  const [draftM, setDraftM] = useState(String(choice.customM));
  useEffect(() => {
    setDraftH(String(choice.customH));
    setDraftM(String(choice.customM));
  }, [choice.customH, choice.customM, revision]);

  const commitCustom = () => {
    const h = clampInt(draftH, 0, 12);
    const m = clampInt(draftM, 0, 59);
    if (h === choice.customH && m === choice.customM && choice.preset === null) return;
    onChoice({ preset: null, customH: h, customM: m });
  };

  return (
    <section className="panel settings" aria-label={lifter ? 'ตั้งค่าโหมดคนยก' : 'ตั้งค่าโหมดตั้งเวลา'}>
      <div className="field">
        <span className="field-label" id="target-label">
          เวลาเป้าหมาย
        </span>
        <div className="chips" role="group" aria-labelledby="target-label">
          {TARGET_PRESETS_MIN.map((p) => (
            <button
              key={p}
              type="button"
              className={choice.preset === p ? 'chip active' : 'chip'}
              aria-pressed={choice.preset === p}
              onClick={() => choice.preset !== p && onChoice({ ...choice, preset: p })}
            >
              {formatMinutesLabel(p)}
            </button>
          ))}
          <button
            type="button"
            className={choice.preset === null ? 'chip active' : 'chip'}
            aria-pressed={choice.preset === null}
            onClick={() => choice.preset !== null && onChoice({ ...choice, preset: null })}
          >
            กำหนดเอง
          </button>
        </div>
      </div>

      {choice.preset === null && (
        <form
          className="custom-time"
          onSubmit={(e) => {
            e.preventDefault();
            commitCustom();
          }}
        >
          <label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={12}
              value={draftH}
              onChange={(e) => setDraftH(e.target.value)}
              onBlur={commitCustom}
              aria-label="ชั่วโมง"
            />
            <span>ชม.</span>
          </label>
          <label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={draftM}
              onChange={(e) => setDraftM(e.target.value)}
              onBlur={commitCustom}
              aria-label="นาที"
            />
            <span>นาที</span>
          </label>
          <button type="submit" className="btn small">
            ตั้งเวลา
          </button>
        </form>
      )}

      {!valid ? (
        <p className="warn" role="alert">
          เวลาต้องอยู่ระหว่าง {formatMinutesLabel(TARGET_MIN_MINUTES)} ถึง {formatMinutesLabel(TARGET_MAX_MINUTES)}
        </p>
      ) : (
        <PlanSummary plan={plan} lifter={lifter} />
      )}
    </section>
  );
}

function PlanSummary({ plan, lifter }: { plan: TargetPlan; lifter: boolean }) {
  return (
    <div className="plan">
      <dl className="plan-grid">
        <div>
          <dt>จำนวนวงแหวน</dt>
          <dd>{plan.n} วง</dd>
        </div>
        <div>
          <dt>ทั้งหมด</dt>
          <dd>{formatInt(plan.totalMoves)} ครั้ง</dd>
        </div>
        <div>
          <dt>เวลาต่อครั้ง</dt>
          <dd>
            {formatSeconds(plan.slotMs)}
            <small>
              {' '}
              (ย้าย {formatSeconds(plan.animMs)} + พัก {formatSeconds(plan.restMs)})
            </small>
          </dd>
        </div>
        <div>
          <dt>เป้าหมาย</dt>
          <dd>{formatDuration(plan.targetMs)}</dd>
        </div>
      </dl>
      {lifter && (
        <p className="hint steps">
          {lifterStepDurations(plan.animMs)
            .map((s, i) => `${LIFTER_STEPS[i].label} ${(s.ms / 1000).toFixed(1)}`)
            .join(' · ')}{' '}
          วิ
        </p>
      )}
      {!plan.feasible && (
        <p className="warn" role="alert">
          เวลาเป้าหมายสั้นกว่าการย้าย 1 ครั้ง — ทำได้จริงเร็วที่สุด {formatSeconds(plan.totalMs)} ไม่ตรงกับเป้าหมาย
        </p>
      )}
      {plan.stretched && (
        <p className="hint">
          เวลาพักยาวเกิน 6 วินาที จึงยืดแอนิเมชันเป็น {formatSeconds(plan.animMs)}
          {plan.restOverCap ? ' (ยืดเต็มที่แล้ว เวลาพักที่เหลือยังเกิน 6 วินาที)' : ''}
        </p>
      )}
    </div>
  );
}

function clampInt(raw: string, lo: number, hi: number): number {
  const v = Math.floor(Number(raw));
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}
