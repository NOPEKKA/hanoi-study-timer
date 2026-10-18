import { memo } from 'react';
import { PEG_NAMES } from '../hanoi/hanoi';
import { ringColor, type Theme } from '../render/colors';
import { LIFTER_FLOOR_Y, LIFTER_TABLE_Y, VIEW_H, VIEW_W, type Pt, type TowerLayout } from '../render/layout';
import { BODY, type LifterPose } from '../render/lifterPose';
import type { RingSprite } from '../render/scene';

/** ข้อมูลเวลาที่แสดงในฉาก */
export interface Hud {
  label: string;
  big: string;
  /** บรรทัดเล็กชิดขวา */
  info: string[];
  /** 0..1 แสดงแถบความคืบหน้าที่ขอบล่าง (null = ไม่แสดง) */
  progress: number | null;
}

interface Props {
  layout: TowerLayout;
  rings: RingSprite[];
  pose: LifterPose | null;
  label: string;
  theme: Theme;
  hud: Hud;
  /** ขยายตัวหนังสือในฉากเมื่อฉากเล็ก (มือถือ) — 1 = ปกติ */
  hudScale: number;
}

/** กรอบภาพของแต่ละฉาก: [x, y, กว้าง, สูง] — โหมดคนยกตัดเฉพาะโต๊ะและตัวละคร */
export function sceneViewBox(kind: TowerLayout['kind']): [number, number, number, number] {
  return kind === 'lifter' ? [150, 0, 700, VIEW_H] : [0, 0, VIEW_W, VIEW_H];
}

/** ความสูงแถบบนสุดของฉากที่เว้นไว้ให้นาฬิกา (วงแหวนที่ลอยอยู่ไม่ขึ้นมาถึง) */
export const HUD_BAND = 90;

export function TowerScene({ layout, rings, pose, label, theme, hud, hudScale }: Props) {
  const [bx, by, bw, bh] = sceneViewBox(layout.kind);
  // มือถือ: ขยายตัวหนังสือ และต่อพื้นที่ด้านบนให้แถบนาฬิกาสูงขึ้นตาม จะได้ไม่ทับวงแหวน
  const extra = (hudScale - 1) * HUD_BAND;
  const vb = { x: bx, y: by - extra, w: bw, h: bh + extra };
  // วงที่กำลังเคลื่อนวาดทีหลังสุด จะได้ลอยอยู่เหนือวงอื่น
  const ordered = rings.some((r) => r.moving) ? [...rings].sort((a, b) => Number(a.moving) - Number(b.moving)) : rings;
  return (
    <svg
      className="scene-svg"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      style={{ aspectRatio: `${vb.w} / ${vb.h}` }}
      role="img"
      aria-label={label}
    >
      <SceneDefs />
      <Backdrop kind={layout.kind} />
      {pose && <LifterBody pose={pose} />}
      {layout.kind === 'lifter' && <Table />}
      <Pegs layout={layout} />
      <g>
        {ordered.map((r) => (
          <Ring key={r.disk} ring={r} color={ringColor(r.disk, layout.n, theme)} />
        ))}
      </g>
      {pose && pose.frontHands > 0.001 && <Hands pose={pose} opacity={pose.frontHands} front />}
      <HudLayer hud={hud} vb={vb} scale={hudScale} />
    </svg>
  );
}

function HudLayer({ hud, vb, scale }: { hud: Hud; vb: { x: number; y: number; w: number; h: number }; scale: number }) {
  const right = vb.w / scale - 30;
  // ตัวเลขยาว (เช่นมีจำนวนวัน) ย่อลงให้ไม่ชนข้อความฝั่งขวา
  const bigSize = 50 * Math.min(1, 8.5 / Math.max(8, hud.big.length));
  return (
    <g aria-hidden="true">
      <g transform={`translate(${vb.x} ${vb.y}) scale(${scale})`}>
        <text className="hud-label" x={31} y={31}>
          {hud.label}
        </text>
        <text className="hud-big" x={29} y={78} style={{ fontSize: bigSize }}>
          {hud.big}
        </text>
        {hud.info.map((line, i) => (
          <text key={i} className="hud-info" x={right} y={33 + i * 23} textAnchor="end">
            {line}
          </text>
        ))}
      </g>
      {hud.progress !== null && (
        <g>
          <rect x={vb.x} y={vb.y + vb.h - 6} width={vb.w} height={6} className="hud-track" />
          <rect x={vb.x} y={vb.y + vb.h - 6} width={vb.w * Math.min(1, Math.max(0, hud.progress))} height={6} className="hud-fill" />
        </g>
      )}
    </g>
  );
}

const Ring = memo(
  function Ring({ ring, color }: { ring: RingSprite; color: string }) {
    const gap = Math.min(2, ring.h * 0.12);
    const h = ring.h - gap;
    return (
      <g transform={`translate(${(ring.x - ring.w / 2).toFixed(2)} ${(ring.y + gap / 2).toFixed(2)})`}>
        <rect width={ring.w} height={h} rx={h / 2} fill={color} />
        <rect width={ring.w} height={h} rx={h / 2} fill="url(#ringShade)" />
      </g>
    );
  },
  (a, b) =>
    a.color === b.color && a.ring.x === b.ring.x && a.ring.y === b.ring.y && a.ring.w === b.ring.w && a.ring.h === b.ring.h,
);

/** สีผนัง/พื้นมาจากตัวแปร CSS ของธีม (--wall-*, --desk-*) */
const SceneDefs = memo(function SceneDefs() {
  return (
    <defs>
      <radialGradient id="bgGlow" gradientUnits="userSpaceOnUse" cx="500" cy="100" r="760">
        <stop offset="0" style={{ stopColor: 'var(--wall-1)' }} />
        <stop offset="0.55" style={{ stopColor: 'var(--wall-2)' }} />
        <stop offset="1" style={{ stopColor: 'var(--wall-3)' }} />
      </radialGradient>
      <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--desk-1)' }} />
        <stop offset="1" style={{ stopColor: 'var(--desk-2)' }} />
      </linearGradient>
      <linearGradient id="rodWood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#6e4527" />
        <stop offset="0.45" stopColor="#b17d4b" />
        <stop offset="0.7" stopColor="#9a6a3e" />
        <stop offset="1" stopColor="#5f3b21" />
      </linearGradient>
      <linearGradient id="baseWood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a8733f" />
        <stop offset="0.25" stopColor="#8d5e33" />
        <stop offset="1" stopColor="#5e3c22" />
      </linearGradient>
      <linearGradient id="tableWood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6b4529" />
        <stop offset="1" stopColor="#3e2716" />
      </linearGradient>
      <linearGradient id="ringShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
        <stop offset="0.32" stopColor="#fff" stopOpacity="0.06" />
        <stop offset="0.62" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.3" />
      </linearGradient>
      <radialGradient id="softShadow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#000" style={{ stopOpacity: 'var(--shadow-a)' }} />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
});

/** พื้นหลังยื่นเลยกรอบ viewBox — ตอนกล่องกว้าง/สูงกว่าสัดส่วนฉากจะไม่เห็นแถบว่าง */
const BLEED = 1000;

const Backdrop = memo(function Backdrop({ kind }: { kind: TowerLayout['kind'] }) {
  const floorY = kind === 'plain' ? 494 : LIFTER_FLOOR_Y;
  return (
    <g>
      <rect x={-BLEED} y={-BLEED} width={VIEW_W + BLEED * 2} height={VIEW_H + BLEED * 2} fill="url(#bgGlow)" />
      <rect x={-BLEED} y={floorY} width={VIEW_W + BLEED * 2} height={VIEW_H - floorY + BLEED} fill="url(#desk)" />
      <line x1={-BLEED} x2={VIEW_W + BLEED} y1={floorY + 0.5} y2={floorY + 0.5} className="desk-line" />
      {kind === 'plain' ? (
        <ellipse cx={500} cy={500} rx={470} ry={16} fill="url(#softShadow)" />
      ) : (
        <ellipse cx={500} cy={LIFTER_FLOOR_Y + 4} rx={330} ry={12} fill="url(#softShadow)" />
      )}
    </g>
  );
});

const Table = memo(function Table() {
  const top = LIFTER_TABLE_Y;
  return (
    <g>
      <rect x={210} y={top + 20} width={22} height={LIFTER_FLOOR_Y - top - 20} rx={3} fill="#3b2516" />
      <rect x={768} y={top + 20} width={22} height={LIFTER_FLOOR_Y - top - 20} rx={3} fill="#3b2516" />
      <rect x={232} y={top + 20} width={536} height={12} fill="#2f1d11" />
      <rect x={186} y={top} width={628} height={22} rx={4} fill="url(#tableWood)" />
      <line x1={190} x2={810} y1={top + 1} y2={top + 1} stroke="#8a5d38" strokeOpacity={0.55} />
    </g>
  );
});

const Pegs = memo(function Pegs({ layout }: { layout: TowerLayout }) {
  const { base, pegX, pegTop, groundY, rodW, kind } = layout;
  const labelY = kind === 'plain' ? base.y + base.h + 30 : LIFTER_TABLE_Y + 16;
  return (
    <g>
      {pegX.map((x) => (
        <rect
          key={x}
          x={x - rodW / 2}
          y={pegTop}
          width={rodW}
          height={groundY - pegTop + 2}
          rx={rodW / 2}
          fill="url(#rodWood)"
        />
      ))}
      <rect x={base.x0} y={base.y} width={base.x1 - base.x0} height={base.h} rx={6} fill="url(#baseWood)" />
      <g stroke="#4a2f1a" strokeOpacity={0.35} strokeWidth={1.2} fill="none">
        <path d={`M${base.x0 + 30} ${base.y + base.h * 0.45} C ${base.x0 + 200} ${base.y + base.h * 0.3}, ${base.x0 + 340} ${base.y + base.h * 0.65}, ${base.x0 + 520} ${base.y + base.h * 0.5}`} />
        <path d={`M${base.x1 - 40} ${base.y + base.h * 0.7} C ${base.x1 - 200} ${base.y + base.h * 0.55}, ${base.x1 - 330} ${base.y + base.h * 0.85}, ${base.x1 - 480} ${base.y + base.h * 0.68}`} />
      </g>
      <line x1={base.x0 + 6} x2={base.x1 - 6} y1={base.y + 1} y2={base.y + 1} stroke="#e0b07a" strokeOpacity={0.35} />
      {pegX.map((x, i) => (
        <text key={`l${x}`} className={kind === 'plain' ? 'peg-label' : 'peg-label small'} x={x} y={labelY}>
          {PEG_NAMES[i]}
        </text>
      ))}
    </g>
  );
});

// ---------------------------------------------------------------- คนยก

const SKIN = '#d3a27b';
const SHIRT = '#5f7c6d';
const SHIRT_DARK = '#4f6a5c';
const PANTS = '#3a2e29';
const HAIR = '#5c3b26';
const SHOE = '#1a130f';

const f = (n: number) => n.toFixed(1);
const line = (...pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ');

function LifterBody({ pose }: { pose: LifterPose }) {
  const deg = (pose.torsoAngle * 180) / Math.PI;
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* ขา */}
      <path d={line(pose.hipL, pose.kneeL, pose.ankleL)} stroke={PANTS} strokeWidth={27} fill="none" />
      <path d={line(pose.hipR, pose.kneeR, pose.ankleR)} stroke={PANTS} strokeWidth={27} fill="none" />
      <ellipse cx={pose.ankleL.x - 7} cy={pose.ankleL.y + 4} rx={18} ry={8} fill={SHOE} />
      <ellipse cx={pose.ankleR.x + 7} cy={pose.ankleR.y + 4} rx={18} ry={8} fill={SHOE} />
      {/* สะโพก */}
      <path d={`${line(pose.waistL, pose.waistR, pose.hipR, pose.hipL)} Z`} fill={PANTS} stroke={PANTS} strokeWidth={22} />
      {/* ลำตัว */}
      <path
        d={`${line(pose.shoulderL, pose.shoulderR, pose.waistR, pose.waistL)} Z`}
        fill={SHIRT}
        stroke={SHIRT}
        strokeWidth={24}
      />
      <path d={line(pose.waistL, pose.waistR)} stroke={SHIRT_DARK} strokeWidth={8} />
      {/* คอและศีรษะ */}
      <path d={line(pose.neckA, pose.neckB)} stroke={SKIN} strokeWidth={18} />
      <g transform={`translate(${f(pose.headC.x)} ${f(pose.headC.y)}) rotate(${deg.toFixed(2)})`}>
        <circle r={pose.headR} fill={SKIN} />
        <path d="M -28.6 -1 A 28.6 28.6 0 0 1 28.6 -1 C 19 -13 -19 -13 -28.6 -1 Z" fill={HAIR} />
      </g>
      {/* แขน: ต้นแขนเป็นแขนเสื้อ ปลายแขนเป็นผิว */}
      <path d={line(pose.shoulderL, pose.elbowL)} stroke={SHIRT} strokeWidth={21} />
      <path d={line(pose.shoulderR, pose.elbowR)} stroke={SHIRT} strokeWidth={21} />
      <path d={line(pose.elbowL, pose.handL)} stroke={SKIN} strokeWidth={15} />
      <path d={line(pose.elbowR, pose.handR)} stroke={SKIN} strokeWidth={15} />
      <Hands pose={pose} opacity={1} front={false} />
    </g>
  );
}

function Hands({ pose, opacity, front }: { pose: LifterPose; opacity: number; front: boolean }) {
  const r = BODY.handR;
  return (
    <g opacity={opacity}>
      {[pose.handL, pose.handR].map((h, i) => (
        <circle
          key={i}
          cx={f(h.x)}
          cy={f(h.y)}
          r={r}
          fill={SKIN}
          stroke={front ? 'rgba(40,24,14,0.35)' : 'none'}
          strokeWidth={1.5}
        />
      ))}
    </g>
  );
}
