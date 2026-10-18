/**
 * ท่าทางคนยก (มองจากด้านหน้า ยืนหลังโต๊ะ) — คำนวณทุกข้อต่อด้วย IK สองท่อน
 *
 * มือจับขอบบนของวงแหวนสองข้างของแกนเสา ตำแหน่งวงมาจากขั้นตอนใน LIFTER_STEPS
 * สะโพกเคลื่อนตามวงแหวน 60% และไหล่ 80% ของระยะ ส่วนที่เหลือเป็นการเอื้อมและเอนตัว
 * ระยะเดินจึงสั้นและท่าทางไม่รีบ ถ้ามือเอื้อมไม่ถึงวงล่าง ๆ จะย่อเข่าลงเอง
 */
import { moveAt } from '../hanoi/hanoi';
import { lifterPhaseAt, lifterStepRange, type LifterPhase } from '../modes/lifter';
import type { Progress } from '../modes/progress';
import { LIFTER_FLOOR_Y, type Pt, type TowerLayout } from './layout';
import { arcSegments, clamp01, easeInOutSine, lerp, monotoneEase, pointOnArc, smoothstep } from './motion';
import { moveEndpoints, restingRings, stackInfo, type RingSprite } from './scene';

// สัดส่วนร่างกาย (หน่วย viewBox) — สูงราว 440
export const BODY = {
  thigh: 116,
  shin: 114,
  torso: 132,
  shoulderHalf: 50,
  hipHalf: 20,
  waistHalf: 32,
  upperArm: 96,
  forearm: 92,
  neck: 16,
  headR: 28,
  handR: 10,
  stance: 30,
  ankleH: 10,
  /** ระยะก้าวเท้าสูงสุดต่อรอบก้าว */
  stepMax: 140,
  stepLift: 12,
} as const;

const CENTER_X = 500;
const ANKLE_Y = LIFTER_FLOOR_Y - BODY.ankleH;
const STAND_HIP_Y = ANKLE_Y - (BODY.thigh + BODY.shin - 4);
const ARM = BODY.upperArm + BODY.forearm;
/** ย่อเข่าลงได้สูงสุด แล้วจึงก้มตัวไปข้างหน้า (ลำตัวดูสั้นลงเมื่อมองจากด้านหน้า) */
const MAX_CROUCH = 70;
const MAX_BEND = 48;
/** ระยะจากแกนเสาถึงกึ่งกลางมือแต่ละข้างตอนจับวง */
export function gripOffset(l: TowerLayout): number {
  return l.rodW / 2 + BODY.handR + 1;
}

/** ตำแหน่งสะโพกตอนทำงานกับเสาที่ x */
const homeX = (x: number) => CENTER_X + (x - CENTER_X) * 0.6;
const shoulderXFor = (x: number) => CENTER_X + (x - CENTER_X) * 0.8;

export interface LifterPose {
  headC: Pt;
  headR: number;
  neckA: Pt;
  neckB: Pt;
  shoulderL: Pt;
  shoulderR: Pt;
  elbowL: Pt;
  elbowR: Pt;
  handL: Pt;
  handR: Pt;
  hipC: Pt;
  hipL: Pt;
  hipR: Pt;
  waistL: Pt;
  waistR: Pt;
  kneeL: Pt;
  kneeR: Pt;
  ankleL: Pt;
  ankleR: Pt;
  torsoAngle: number;
  /** ความทึบของมือชุดหน้า (วาดทับวงแหวนตอนกำลังจับ) */
  frontHands: number;
  /** จุดที่มือควรอยู่ตอนจับวง (null = มือปล่อยข้างลำตัว) — ใช้ตรวจในเทสต์ */
  gripTargets: { l: Pt; r: Pt } | null;
}

export interface LifterFrame {
  rings: RingSprite[];
  pose: LifterPose;
  phase: LifterPhase | null;
  heldDisk: number | null;
}

/** มุม (เรเดียน) ที่ต้นแขนอยากห้อยลง: ลงล่างและกางออกเล็กน้อย */
const ARM_REST_OUT = (12 * Math.PI) / 180;

/** ลดระยะเมื่อใกล้เหยียดสุด (soft IK) — ข้อต่อไม่สะบัดตอนแขน/ขาเกือบตรง กระดูกยืดได้เล็กน้อยแทน */
function softReach(d: number, L: number): { dSoft: number; stretch: number } {
  const softStart = L * 0.9;
  if (d <= softStart) return { dSoft: d, stretch: 1 };
  const softLen = L - softStart;
  const dSoft = softStart + softLen * (1 - Math.exp(-(d - softStart) / softLen));
  return { dSoft, stretch: d / dSoft };
}

/**
 * แขนแบบมองจากด้านหน้า: ต้นแขนอยากห้อยลงข้างลำตัว ถ้ายังเอื้อมถึงมือได้ ปลายแขนจะชี้มาทางผู้ชม
 * (ดูสั้นลง เหมือนถือถาด) ถ้าเอื้อมไม่ถึงจึงหมุนต้นแขนเท่าที่จำเป็น — ศอกเปลี่ยนตำแหน่งต่อเนื่องเสมอ
 */
function solveArm(root: Pt, target: Pt, a: number, b: number, outward: -1 | 1): { joint: Pt; end: Pt } {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const L = a + b;
  const d = Math.min(L * 1.04, dist);
  const end = { x: root.x + (dx / dist) * d, y: root.y + (dy / dist) * d };
  const base = Math.atan2(dy, dx);
  const { dSoft, stretch } = softReach(d, L);
  // ช่วงมุมของต้นแขนที่ปลายแขน (ยาว b) ยังเอื้อมถึงมือ: base ± A
  const A = dSoft + a <= b ? Math.PI : Math.acos(Math.min(1, Math.max(-1, (a * a + dSoft * dSoft - b * b) / (2 * a * dSoft))));
  const pref = Math.PI / 2 - outward * ARM_REST_OUT;
  const delta = Math.atan2(Math.sin(pref - base), Math.cos(pref - base));
  const phi = Math.abs(delta) <= A ? pref : base + Math.sign(delta) * A;
  const sa = a * stretch;
  return { joint: { x: root.x + sa * Math.cos(phi), y: root.y + sa * Math.sin(phi) }, end };
}

/** ขา: เข่างอมาทางผู้ชม (อยู่บนแนวสะโพก–ข้อเท้า) และกางออกเล็กน้อยตามความลึกของการย่อ */
function solveLeg(hip: Pt, ankle: Pt, a: number, b: number, outward: -1 | 1): { joint: Pt; end: Pt } {
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const L = a + b;
  const d = Math.min(L * 1.04, dist);
  const end = { x: hip.x + (dx / dist) * d, y: hip.y + (dy / dist) * d };
  const f = a / L;
  const out = outward * Math.max(0, L - d) * 0.32;
  return { joint: { x: hip.x + dx * (d / dist) * f + out, y: hip.y + dy * (d / dist) * f }, end };
}

/** เท้าตอนก้าวข้าง: เท้านำออกก่อน แล้วเท้าตามชิดเข้ามา ทีละรอบไม่เกิน stepMax */
function steppingFeet(h0: number, h1: number, e: number): { l: Pt; r: Pt } {
  const dist = h1 - h0;
  const planted = (hx: number) => ({
    l: { x: hx - BODY.stance, y: ANKLE_Y },
    r: { x: hx + BODY.stance, y: ANKLE_Y },
  });
  if (Math.abs(dist) < 1) return planted(h1);
  const dir = dist > 0 ? 1 : -1;
  const cycles = Math.max(1, Math.ceil(Math.abs(dist) / BODY.stepMax));
  const ee = clamp01(e) * cycles;
  const i = Math.min(cycles - 1, Math.floor(ee));
  const v = ee - i;
  const b0 = h0 + (dist * i) / cycles;
  const b1 = h0 + (dist * (i + 1)) / cycles;
  const foot = (side: number, a: number, b: number) => {
    const w = smoothstep(a, b, v);
    const lift = v > a && v < b ? Math.sin(Math.PI * ((v - a) / (b - a))) * BODY.stepLift : 0;
    return { x: lerp(b0, b1, w) + side * BODY.stance, y: ANKLE_Y - lift };
  };
  const lead = foot(dir, 0, 0.5);
  const trail = foot(-dir, 0.5, 1);
  return dir > 0 ? { l: trail, r: lead } : { l: lead, r: trail };
}

interface BodyPlan {
  hipX: number;
  shoulderX: number;
  dip: number;
  feet: { l: Pt; r: Pt };
  /** 0 = มือปล่อย, 1 = มือจับวง */
  handBlend: number;
  frontHands: number;
  breath: number;
}

function buildPose(plan: BodyPlan, grip: { l: Pt; r: Pt } | null): LifterPose {
  const { feet } = plan;
  // สะโพก: เริ่มจากท่ายืน + ย่อ แล้วลดลงถ้าขาเอื้อมถึงเท้าไม่พอ
  let hipY = STAND_HIP_Y + plan.dip;
  const legLen = BODY.thigh + BODY.shin - 0.5;
  const fitLeg = (hipJointX: number, ankle: Pt) => {
    const dx = ankle.x - hipJointX;
    const reach = Math.sqrt(Math.max(0, legLen * legLen - dx * dx));
    hipY = Math.max(hipY, ankle.y - reach);
  };
  fitLeg(plan.hipX - BODY.hipHalf, feet.l);
  fitLeg(plan.hipX + BODY.hipHalf, feet.r);

  const lean = Math.asin(Math.max(-0.45, Math.min(0.45, (plan.shoulderX - plan.hipX) / BODY.torso)));
  const up = { x: Math.sin(lean), y: -Math.cos(lean) };
  const across = { x: Math.cos(lean), y: Math.sin(lean) };

  const shouldersAt = (hy: number, torso: number) => {
    const c = { x: plan.hipX + up.x * torso, y: hy + up.y * torso - plan.breath };
    return {
      c,
      l: { x: c.x - across.x * BODY.shoulderHalf, y: c.y - across.y * BODY.shoulderHalf },
      r: { x: c.x + across.x * BODY.shoulderHalf, y: c.y + across.y * BODY.shoulderHalf },
    };
  };

  let sh = shouldersAt(hipY, BODY.torso);
  // แขนห้อยสบาย ๆ ข้างลำตัว (soft IK ทำให้ศอกงอนิดหน่อยเอง)
  const relaxed = (s: Pt, side: -1 | 1) => ({ x: s.x + side * 16, y: s.y + ARM - 10 });
  const targetFor = (s: Pt, side: -1 | 1, g: Pt | undefined) =>
    g ? { x: lerp(relaxed(s, side).x, g.x, plan.handBlend), y: lerp(relaxed(s, side).y, g.y, plan.handBlend) } : relaxed(s, side);

  // มือเอื้อมไม่ถึงเป้า: ย่อเข่าก่อน แล้วค่อยก้มตัว
  if (grip) {
    const need = (s: Pt, t: Pt) => {
      const dx = Math.abs(t.x - s.x);
      const r = ARM * 0.93;
      if (dx >= r) return 0;
      return Math.max(0, t.y - s.y - Math.sqrt(r * r - dx * dx));
    };
    const tl = targetFor(sh.l, -1, grip.l);
    const tr = targetFor(sh.r, 1, grip.r);
    // นับเฉพาะส่วนที่เกินท่าแขนห้อยปกติ ท่าตอนปล่อยมือจึงตรงกับท่ายืนพักพอดี
    const baseline = need(sh.r, relaxed(sh.r, 1));
    const total = Math.max(0, Math.max(need(sh.l, tl), need(sh.r, tr)) - baseline);
    if (total > 0) {
      const squat = Math.min(MAX_CROUCH, total);
      const bend = Math.min(MAX_BEND, total - squat);
      hipY += squat;
      sh = shouldersAt(hipY, BODY.torso - bend);
    }
  }

  const armL = solveArm(sh.l, targetFor(sh.l, -1, grip?.l), BODY.upperArm, BODY.forearm, -1);
  const armR = solveArm(sh.r, targetFor(sh.r, 1, grip?.r), BODY.upperArm, BODY.forearm, 1);

  const hipL = { x: plan.hipX - BODY.hipHalf, y: hipY };
  const hipR = { x: plan.hipX + BODY.hipHalf, y: hipY };
  const legL = solveLeg(hipL, feet.l, BODY.thigh, BODY.shin, -1);
  const legR = solveLeg(hipR, feet.r, BODY.thigh, BODY.shin, 1);

  const neckA = { x: sh.c.x + up.x * 2, y: sh.c.y + up.y * 2 };
  const neckB = { x: sh.c.x + up.x * BODY.neck, y: sh.c.y + up.y * BODY.neck };
  const headC = { x: sh.c.x + up.x * (BODY.neck + BODY.headR - 2), y: sh.c.y + up.y * (BODY.neck + BODY.headR - 2) };

  return {
    headC,
    headR: BODY.headR,
    neckA,
    neckB,
    shoulderL: sh.l,
    shoulderR: sh.r,
    elbowL: armL.joint,
    elbowR: armR.joint,
    handL: armL.end,
    handR: armR.end,
    hipC: { x: plan.hipX, y: hipY },
    hipL,
    hipR,
    waistL: { x: plan.hipX - BODY.waistHalf, y: hipY + 6 },
    waistR: { x: plan.hipX + BODY.waistHalf, y: hipY + 6 },
    kneeL: legL.joint,
    kneeR: legR.joint,
    ankleL: legL.end,
    ankleR: legR.end,
    torsoAngle: lean,
    frontHands: plan.frontHands,
    gripTargets: grip && plan.handBlend >= 1 ? grip : null,
  };
}

const LIFT = lifterStepRange('lift');
const CARRY = lifterStepRange('carry');
const PLACE = lifterStepRange('place');

/**
 * ตำแหน่งวงแหวนที่กำลังถูกยก — ยก ขน วาง เป็นเส้นทางเดียวที่มีมุมโค้ง
 * วงผ่านจุดเปลี่ยนขั้นตอนตรงเวลา (ยกเสร็จ = กลางโค้งแรก, ขนเสร็จ = กลางโค้งที่สอง) โดยไม่หยุดกลางทาง
 */
function heldRingPoint(l: TowerLayout, from: Pt, to: Pt, ph: LifterPhase, t: number): Pt {
  if (ph.step === 'reach' || ph.step === 'grip') return from;
  if (ph.step === 'recover') return to;
  const seg = arcSegments(from, to, l.liftY, l.cornerR);
  if (seg.total <= 0) return to;
  const s1 = (seg.up + seg.arc / 2) / seg.total;
  const s2 = (seg.up + seg.arc + seg.across + seg.arc / 2) / seg.total;
  const w0 = LIFT.start;
  const w = PLACE.end - w0;
  const sArc = monotoneEase((t - w0) / w, [0, (LIFT.end - w0) / w, (CARRY.end - w0) / w, 1], [0, s1, s2, 1]);
  return pointOnArc(from, to, l.liftY, l.cornerR, sArc);
}

/** หายใจเบา ๆ ตอนยืนพัก — ค่อย ๆ เริ่ม จึงไม่กระตุกตอนเปลี่ยนจากท่ายก */
function breathing(sinceMs: number): number {
  return Math.sin((2 * Math.PI * sinceMs) / 4200) * 1.3 * smoothstep(0, 900, sinceMs);
}

/**
 * ระหว่างพัก: เดินไปยังเสาที่จะหยิบต่อด้วยความเร็วเดินปกติทันที (ไม่ยืดให้ช้าเต็มช่วงพัก)
 * ถึงแล้วยืนรอข้างวงพร้อมโยกตัวเบา ๆ ถ้าช่วงพักสั้นเกินจะเดินถึง ก็เดินเท่าที่ทัน แล้วเดินต่อในขั้นเดิน/เอื้อม
 */
const WALK_SPEED = 330; // หน่วยต่อวินาที (ราว 0.35 วิ ต่อเสาที่ติดกัน)

function restWalk(restHip: number, srcX: number, restMs: number, sinceMs: number) {
  const home = homeX(srcX);
  const fullMs = (Math.abs(home - restHip) / WALK_SPEED) * 1000;
  const walkMs = Math.min(restMs, fullMs);
  const amount = fullMs > 0 ? walkMs / fullMs : 1;
  const endHip = lerp(restHip, home, amount);
  const endLean = (shoulderXFor(srcX) - home) * 0.4 * amount;
  const e = walkMs > 0 ? easeInOutSine(sinceMs / walkMs) : 1;
  // ยืนรอ: โยกน้ำหนักเบา ๆ แล้วนิ่งลงก่อนเริ่มเอื้อม ท่าตอนจบพักจึงต่อกับขั้นถัดไปพอดี
  const waited = Math.max(0, sinceMs - walkMs);
  const settle = smoothstep(0, 500, waited) * smoothstep(0, 350, restMs - sinceMs);
  const sway = Math.sin((2 * Math.PI * waited) / 2400) * 4 * settle;
  const hipX = lerp(restHip, endHip, e) + sway;
  return {
    hipX,
    shoulderX: hipX + endLean * e - sway * 0.4,
    feet: steppingFeet(restHip, endHip, e),
    endHip,
    endShoulder: endHip + endLean,
    breathFade: smoothstep(0, 350, restMs - sinceMs),
  };
}

/**
 * ท่าคนยก ณ ความคืบหน้า p
 * restMs = เวลาพักต่อ Move ของแผน (ใช้คำนวณว่าระหว่างพักจะขยับเข้าหาเสาถัดไปได้แค่ไหน)
 */
export function lifterFrame(l: TowerLayout, p: Progress, restMs = 0): LifterFrame {
  const n = l.n;
  const k = p.completed;
  const lastDest = k > 0 ? moveAt(n, BigInt(k)).to : null;
  const restHip = lastDest === null ? CENTER_X : homeX(l.pegX[lastDest]);
  const planted = (hx: number) => ({
    l: { x: hx - BODY.stance, y: ANKLE_Y },
    r: { x: hx + BODY.stance, y: ANKLE_Y },
  });

  if (p.done || !p.active) {
    const rings = restingRings(l, p.done ? p.total : k);
    let hipX = restHip;
    let shoulderX = restHip;
    let feet = planted(restHip);
    let breath = p.rest ? breathing(p.rest.sinceMs) : 0;
    if (!p.done && p.rest && k < p.total) {
      const next = moveAt(n, BigInt(k + 1));
      const d = restWalk(restHip, l.pegX[next.from], restMs, p.rest.sinceMs);
      hipX = d.hipX;
      shoulderX = d.shoulderX;
      feet = d.feet;
      breath *= d.breathFade;
    }
    const pose = buildPose({ hipX, shoulderX, dip: 0, feet, handBlend: 0, frontHands: 0, breath }, null);
    return { rings, pose, phase: null, heldDisk: null };
  }

  const s = stackInfo(n, k);
  const ends = moveEndpoints(l, s, p.active.index);
  const ph = lifterPhaseAt(p.active.t);
  const ring = heldRingPoint(l, ends.from, ends.to, ph, p.active.t);
  const srcX = l.pegX[ends.fromPeg];
  const dstX = l.pegX[ends.toPeg];
  const e = easeInOutSine(ph.u);
  const h0 = homeX(srcX);
  const h1 = homeX(dstX);

  let plan: BodyPlan;
  switch (ph.step) {
    case 'reach': {
      const startPose = restWalk(restHip, srcX, restMs, restMs);
      plan = {
        hipX: lerp(startPose.endHip, h0, e),
        shoulderX: lerp(startPose.endShoulder, shoulderXFor(srcX), e),
        dip: 0,
        feet: steppingFeet(startPose.endHip, h0, e),
        handBlend: smoothstep(0.1, 1, ph.u),
        frontHands: smoothstep(0.82, 1, ph.u),
        breath: 0,
      };
      break;
    }
    case 'grip':
      plan = {
        hipX: h0,
        shoulderX: shoulderXFor(srcX),
        dip: Math.sin(Math.PI * ph.u) * 7,
        feet: planted(h0),
        handBlend: 1,
        frontHands: 1,
        breath: 0,
      };
      break;
    case 'lift':
    case 'carry':
    case 'place': {
      // ตัวเคลื่อนตามวงแหวนตลอดช่วงยก–ขน–วาง จึงไม่มีจังหวะหยุดตรงรอยต่อ
      const hipX = homeX(ring.x);
      const dip = ph.step === 'lift' ? Math.sin(Math.PI * ph.u) * 3 : ph.step === 'place' ? Math.sin(Math.PI * ph.u) * 5 : 0;
      plan = {
        hipX,
        shoulderX: shoulderXFor(ring.x),
        dip,
        feet: steppingFeet(h0, h1, clamp01((hipX - h0) / (h1 - h0))),
        handBlend: 1,
        frontHands: 1,
        breath: 0,
      };
      break;
    }
    case 'recover':
      plan = {
        hipX: h1,
        shoulderX: lerp(shoulderXFor(dstX), h1, e),
        dip: 0,
        feet: planted(h1),
        handBlend: 1 - smoothstep(0, 0.9, ph.u),
        frontHands: 1 - smoothstep(0, 0.18, ph.u),
        breath: 0,
      };
      break;
  }

  const g = gripOffset(l);
  const grip = { l: { x: ring.x - g, y: ring.y + 3 }, r: { x: ring.x + g, y: ring.y + 3 } };
  const pose = buildPose(plan, grip);

  const rings = restingRings(l, k);
  rings[ends.disk] = { ...rings[ends.disk], x: ring.x, y: ring.y, moving: ph.step !== 'reach' && ph.step !== 'recover' };
  return { rings, pose, phase: ph, heldDisk: ends.disk };
}
