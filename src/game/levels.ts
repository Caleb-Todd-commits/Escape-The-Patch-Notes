import type { PatchModifier } from "../shared/run";
import type { Rect } from "./physics";

export type PlatformKind = "solid" | "crumbling" | "async" | "moving" | "conveyor";
export type GravityMode = "down" | "right";
export type ChapterId = "patch_train" | "production_floor";
export type ChallengeType =
  | "bug_report"
  | "all_coins"
  | "par_time"
  | "no_sensor"
  | "no_rollback"
  | "no_double_jump"
  | "first_exit"
  | "master";

export interface Platform extends Rect {
  id: string;
  kind: PlatformKind;
  breakAfter?: number;
  on?: number;
  off?: number;
  phase?: number;
  moveRange?: number;
  moveSpeed?: number;
  conveyorSpeed?: number;
}

export interface Coin {
  id: string;
  x: number;
  y: number;
  r: number;
  value: number;
}

export interface Spike extends Rect {
  id: string;
  vx?: number;
  vy?: number;
}

export interface RollbackToken {
  id: string;
  x: number;
  y: number;
  r: number;
  seconds: number;
}

export interface BugReport {
  id: string;
  x: number;
  y: number;
  r: number;
  title: string;
}

export interface ExitPad extends Rect {
  id: string;
}

export interface LevelChallenge {
  type: ChallengeType;
  label: string;
  parTime?: number;
}

export interface TimedHazardRect extends Rect {
  id: string;
  on?: number;
  off?: number;
  phase?: number;
  warning?: number;
}

export interface TrackHazard extends Rect {
  id: string;
  axis: "x" | "y";
  range: number;
  speed: number;
  phase?: number;
}

export interface SweepLaser extends TrackHazard {
  on?: number;
  off?: number;
  warning?: number;
}

export interface TeslaArc {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness?: number;
  on?: number;
  off?: number;
  phase?: number;
  warning?: number;
}

export interface SecuritySensor extends Rect {
  id: string;
  duration?: number;
}

export interface PlasmaVent extends Rect {
  id: string;
  direction: "up" | "down" | "left" | "right";
  length: number;
  on?: number;
  off?: number;
  phase?: number;
  warning?: number;
}

export interface JumpPad extends Rect {
  id: string;
  force: number;
}

export interface LockdownDoor extends Rect {
  id: string;
  requiredCoins?: number;
  opensAfter?: number;
  linkedToLockdown?: boolean;
}

export interface LevelDefinition {
  id: number;
  patchId: number;
  title: string;
  chapter?: ChapterId;
  modifier: PatchModifier;
  gravity: GravityMode;
  start: Rect;
  exit: Rect & {
    fee?: number;
    pads?: ExitPad[];
  };
  platforms: Platform[];
  coins: Coin[];
  spikes: Spike[];
  tokens?: RollbackToken[];
  bugReport?: BugReport;
  gates?: Rect[];
  challenge?: LevelChallenge;
  laserGates?: TimedHazardRect[];
  sweepLasers?: SweepLaser[];
  razors?: TrackHazard[];
  crushers?: TrackHazard[];
  teslaArcs?: TeslaArc[];
  sensors?: SecuritySensor[];
  plasmaVents?: PlasmaVent[];
  jumpPads?: JumpPad[];
  doors?: LockdownDoor[];
  bounds: Rect;
  background: string;
  wind?: number;
}

const ground = (id: string, y = 500, w = 960): Platform => ({
  id,
  kind: "solid",
  x: 0,
  y,
  w,
  h: 40,
});

const platform = (id: string, x: number, y: number, w: number, h = 22): Platform => ({
  id,
  kind: "solid",
  x,
  y,
  w,
  h,
});

const crumble = (id: string, x: number, y: number, w: number, h = 22, breakAfter = 1.05): Platform => ({
  id,
  kind: "crumbling",
  x,
  y,
  w,
  h,
  breakAfter,
});

const asyncPlatform = (
  id: string,
  x: number,
  y: number,
  w: number,
  h = 22,
  phase = 0,
): Platform => ({
  id,
  kind: "async",
  x,
  y,
  w,
  h,
  phase,
  on: 1.55,
  off: 0.75,
});

const coin = (id: string, x: number, y: number, value = 1): Coin => ({ id, x, y, r: 9, value });
const spike = (id: string, x: number, y: number, w = 32, h = 30): Spike => ({ id, x, y, w, h });
const token = (id: string, x: number, y: number, seconds = 4.4): RollbackToken => ({ id, x, y, r: 12, seconds });
const report = (id: string, x: number, y: number, title: string): BugReport => ({ id, x, y, r: 12, title });
const conveyor = (id: string, x: number, y: number, w: number, speed = 115, h = 22): Platform => ({
  id,
  kind: "conveyor",
  x,
  y,
  w,
  h,
  conveyorSpeed: speed,
});
const laserGate = (id: string, x: number, y: number, w: number, h: number, phase = 0): TimedHazardRect => ({
  id,
  x,
  y,
  w,
  h,
  phase,
  on: 1.15,
  off: 1.05,
  warning: 0.42,
});
const sweepLaser = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  axis: "x" | "y",
  range: number,
  speed = 0.3,
  phase = 0,
): SweepLaser => ({ id, x, y, w, h, axis, range, speed, phase, on: 1.8, off: 0.55, warning: 0.35 });
const razor = (
  id: string,
  x: number,
  y: number,
  size = 34,
  axis: "x" | "y" = "x",
  range = 90,
  speed = 0.36,
  phase = 0,
): TrackHazard => ({ id, x, y, w: size, h: size, axis, range, speed, phase });
const crusher = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  axis: "x" | "y",
  range: number,
  speed = 0.42,
  phase = 0,
): TrackHazard => ({ id, x, y, w, h, axis, range, speed, phase });
const tesla = (id: string, x1: number, y1: number, x2: number, y2: number, phase = 0): TeslaArc => ({
  id,
  x1,
  y1,
  x2,
  y2,
  phase,
  thickness: 18,
  on: 1.3,
  off: 0.95,
  warning: 0.35,
});
const sensor = (id: string, x: number, y: number, w: number, h: number, duration = 3): SecuritySensor => ({
  id,
  x,
  y,
  w,
  h,
  duration,
});
const vent = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  direction: PlasmaVent["direction"],
  length: number,
  phase = 0,
): PlasmaVent => ({ id, x, y, w, h, direction, length, phase, on: 0.95, off: 1.15, warning: 0.42 });
const jumpPad = (id: string, x: number, y: number, w = 56, h = 16, force = 720): JumpPad => ({
  id,
  x,
  y,
  w,
  h,
  force,
});
const door = (id: string, x: number, y: number, w: number, h: number, options: Omit<LockdownDoor, "id" | "x" | "y" | "w" | "h"> = {}): LockdownDoor => ({
  id,
  x,
  y,
  w,
  h,
  ...options,
});

export const WORLD: Rect = { x: 0, y: 0, w: 960, h: 540 };
export const WORLD_WIDE: Rect = { x: 0, y: 0, w: 1920, h: 540 };
export const WORLD_TALL: Rect = { x: 0, y: 0, w: 960, h: 1100 };
export const WORLD_WIDE_MED: Rect = { x: 0, y: 0, w: 1440, h: 540 };

const moving = (
  id: string, x: number, y: number, w: number,
  range = 80, speed = 0.45, phase = 0
): Platform => ({
  id, kind: "moving", x, y, w, h: 22, phase,
  moveRange: range, moveSpeed: speed,
});

export const levels: LevelDefinition[] = [
  {
    id: 1,
    patchId: 1,
    title: "Patch 1.0",
    modifier: "base",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 438, w: 38, h: 62 },
    platforms: [
      ground("l1-ground"),
      platform("l1-a", 196, 450, 130),
      platform("l1-b", 420, 360, 150),
      platform("l1-c", 674, 412, 110),
    ],
    coins: [coin("l1-c1", 240, 416), coin("l1-c2", 480, 326), coin("l1-c3", 720, 380)],
    spikes: [spike("l1-s1", 390, 470), spike("l1-s2", 808, 470)],
    bugReport: report("l1-bug", 532, 326, "Optimism leaks through title screen"),
    bounds: WORLD,
    background: "#111a3a",
  },
  {
    id: 2,
    patchId: 2,
    title: "Patch 1.1",
    modifier: "jump_nerf",
    gravity: "down",
    start: { x: 50, y: 458, w: 28, h: 34 },
    exit: { x: 866, y: 338, w: 38, h: 62 },
    platforms: [
      ground("l2-ground"),
      platform("l2-a", 156, 428, 126),
      platform("l2-b", 324, 392, 116),
      platform("l2-c", 506, 360, 116),
      platform("l2-d", 730, 400, 170),
    ],
    coins: [coin("l2-c1", 190, 394), coin("l2-c2", 360, 360), coin("l2-c3", 556, 328)],
    spikes: [spike("l2-s1", 282, 470), spike("l2-s2", 660, 470), spike("l2-s3", 770, 370, 28, 28)],
    bugReport: report("l2-bug", 846, 368, "Balance pass suspected of skipping legs"),
    bounds: WORLD,
    background: "#182642",
  },
  {
    id: 3,
    patchId: 3,
    title: "Patch 1.2",
    modifier: "coin_spike_magnet",
    gravity: "down",
    start: { x: 50, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 438, w: 38, h: 62 },
    platforms: [
      ground("l3-ground"),
      platform("l3-a", 168, 424, 118),
      platform("l3-b", 372, 384, 138),
      platform("l3-c", 604, 342, 122),
    ],
    coins: [coin("l3-c1", 210, 392), coin("l3-c2", 430, 352), coin("l3-c3", 658, 310), coin("l3-c4", 824, 470)],
    spikes: [spike("l3-s1", 320, 470), spike("l3-s2", 544, 470), spike("l3-s3", 764, 470)],
    bugReport: report("l3-bug", 690, 306, "Coins filed hazard paperwork"),
    bounds: WORLD,
    background: "#1b2045",
  },
  {
    id: 4,
    patchId: 4,
    title: "Patch 1.3",
    modifier: "rotated_gravity",
    gravity: "right",
    start: { x: 52, y: 140, w: 28, h: 34 },
    exit: { x: 806, y: 444, w: 62, h: 38 },
    platforms: [
      platform("l4-wall", 878, 0, 44, 540),
      platform("l4-roof", 0, 0, 960, 28),
      platform("l4-floor", 0, 512, 960, 28),
      platform("l4-a", 726, 92, 32, 124),
      platform("l4-b", 606, 300, 32, 150),
      platform("l4-c", 420, 112, 32, 142),
      platform("l4-d", 246, 296, 32, 126),
    ],
    coins: [coin("l4-c1", 690, 156), coin("l4-c2", 560, 376), coin("l4-c3", 380, 178), coin("l4-c4", 220, 356)],
    spikes: [spike("l4-s1", 848, 236, 30, 32), spike("l4-s2", 848, 362, 30, 32)],
    bugReport: report("l4-bug", 492, 188, "World axis marked deprecated"),
    bounds: WORLD,
    background: "#102e3b",
  },
  {
    id: 5,
    patchId: 5,
    title: "Patch 1.4",
    modifier: "crumbling_platforms",
    gravity: "down",
    start: { x: 50, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 224, w: 38, h: 62 },
    platforms: [
      ground("l5-ground"),
      crumble("l5-a", 170, 428, 118),
      crumble("l5-b", 352, 384, 112),
      crumble("l5-c", 528, 336, 112),
      crumble("l5-d", 704, 288, 128),
    ],
    coins: [coin("l5-c1", 214, 396), coin("l5-c2", 394, 352), coin("l5-c3", 570, 304), coin("l5-c4", 762, 256)],
    spikes: [spike("l5-s1", 306, 470), spike("l5-s2", 664, 470)],
    bugReport: report("l5-bug", 760, 250, "Platform trust budget exceeded"),
    bounds: WORLD,
    background: "#21233f",
  },
  {
    id: 6,
    patchId: 6,
    title: "Patch 1.5",
    modifier: "exit_fee",
    gravity: "down",
    start: { x: 50, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 438, w: 38, h: 62, fee: 4 },
    platforms: [
      ground("l6-ground"),
      platform("l6-a", 150, 420, 120),
      platform("l6-b", 318, 360, 120),
      platform("l6-c", 520, 408, 126),
      platform("l6-d", 696, 350, 116),
    ],
    coins: [
      coin("l6-c1", 190, 388),
      coin("l6-c2", 358, 328),
      coin("l6-c3", 560, 376),
      coin("l6-c4", 738, 318),
      coin("l6-c5", 820, 470),
      coin("l6-c6", 118, 470),
    ],
    spikes: [spike("l6-s1", 276, 470), spike("l6-s2", 466, 470), spike("l6-s3", 646, 470)],
    bugReport: report("l6-bug", 760, 318, "Exit toll not disclosed in patch notes"),
    bounds: WORLD,
    background: "#1c2c37",
  },
  {
    id: 7,
    patchId: 7,
    title: "Patch 1.6",
    modifier: "slippery_floor",
    gravity: "down",
    start: { x: 50, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 298, w: 38, h: 62 },
    platforms: [
      ground("l7-ground"),
      platform("l7-a", 148, 434, 120),
      platform("l7-b", 332, 390, 110),
      platform("l7-c", 516, 434, 110),
      platform("l7-d", 680, 352, 130),
    ],
    coins: [coin("l7-c1", 196, 400), coin("l7-c2", 382, 356), coin("l7-c3", 564, 400), coin("l7-c4", 736, 318)],
    spikes: [spike("l7-s1", 290, 470), spike("l7-s2", 456, 470), spike("l7-s3", 630, 470), spike("l7-s4", 826, 470)],
    bugReport: report("l7-bug", 382, 358, "Stop button converted to suggestion"),
    bounds: WORLD,
    background: "#123546",
  },
  {
    id: 8,
    patchId: 8,
    title: "Patch 1.7",
    modifier: "async_platforms",
    gravity: "down",
    start: { x: 50, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 268, w: 38, h: 62 },
    platforms: [
      ground("l8-ground"),
      asyncPlatform("l8-a", 152, 426, 118, 22, 0),
      asyncPlatform("l8-b", 334, 384, 116, 22, 0.75),
      asyncPlatform("l8-c", 514, 342, 116, 22, 1.35),
      asyncPlatform("l8-d", 700, 306, 128, 22, 0.3),
    ],
    coins: [coin("l8-c1", 196, 394), coin("l8-c2", 382, 352), coin("l8-c3", 562, 310), coin("l8-c4", 760, 274)],
    spikes: [spike("l8-s1", 286, 470), spike("l8-s2", 466, 470), spike("l8-s3", 646, 470)],
    bugReport: report("l8-bug", 746, 272, "Platform promise resolved offscreen"),
    bounds: WORLD,
    background: "#252044",
  },
  {
    id: 9,
    patchId: 9,
    title: "Patch 1.8",
    modifier: "rollback_token",
    gravity: "down",
    start: { x: 50, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 438, w: 38, h: 62 },
    platforms: [
      ground("l9-ground"),
      platform("l9-a", 158, 418, 112),
      platform("l9-b", 356, 372, 112),
      platform("l9-c", 562, 418, 112),
      platform("l9-d", 748, 374, 112),
    ],
    coins: [coin("l9-c1", 208, 386), coin("l9-c2", 406, 340), coin("l9-c3", 612, 386), coin("l9-c4", 800, 342)],
    spikes: [spike("l9-s1", 300, 470), spike("l9-s2", 690, 470)],
    tokens: [token("l9-r1", 124, 390), token("l9-r2", 520, 390)],
    gates: [
      { x: 486, y: 314, w: 30, h: 186 },
      { x: 842, y: 314, w: 30, h: 186 },
    ],
    bugReport: report("l9-bug", 614, 386, "Rollback button has trust issues"),
    bounds: WORLD,
    background: "#301d42",
  },
  {
    id: 10,
    patchId: 10,
    title: "Patch 1.9",
    modifier: "moving_exit",
    gravity: "down",
    start: { x: 50, y: 458, w: 28, h: 34 },
    exit: {
      x: 836,
      y: 438,
      w: 38,
      h: 62,
      pads: [
        { id: "l10-p1", x: 836, y: 438, w: 38, h: 62 },
        { id: "l10-p2", x: 610, y: 314, w: 38, h: 62 },
        { id: "l10-p3", x: 848, y: 206, w: 38, h: 62 },
      ],
    },
    platforms: [
      ground("l10-ground"),
      platform("l10-a", 160, 422, 126),
      platform("l10-b", 340, 370, 122),
      platform("l10-c", 570, 376, 128),
      platform("l10-d", 778, 268, 130),
      platform("l10-e", 720, 470, 90),
    ],
    coins: [coin("l10-c1", 212, 390), coin("l10-c2", 394, 338), coin("l10-c3", 626, 344), coin("l10-c4", 836, 236)],
    spikes: [spike("l10-s1", 306, 470), spike("l10-s2", 508, 470), spike("l10-s3", 732, 470)],
    bugReport: report("l10-bug", 858, 236, "Exit mobility exceeds roadmap"),
    bounds: WORLD,
    background: "#173047",
  },
  {
    id: 11,
    patchId: 11,
    title: "Patch 2.0",
    modifier: "finale_combo",
    gravity: "down",
    start: { x: 50, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 184, w: 38, h: 62, fee: 6 },
    platforms: [
      ground("lf-ground"),
      crumble("lf-a", 142, 430, 112, 22, 1),
      asyncPlatform("lf-b", 310, 382, 120, 22, 0.1),
      crumble("lf-c", 500, 340, 112, 22, 1),
      asyncPlatform("lf-d", 666, 292, 118, 22, 0.75),
      crumble("lf-e", 810, 246, 116, 22, 1),
    ],
    coins: [
      coin("lf-c1", 188, 398),
      coin("lf-c2", 358, 350),
      coin("lf-c3", 548, 308),
      coin("lf-c4", 714, 260),
      coin("lf-c5", 852, 214),
      coin("lf-c6", 830, 470),
      coin("lf-c7", 118, 470),
    ],
    spikes: [spike("lf-s1", 280, 470), spike("lf-s2", 462, 470), spike("lf-s3", 622, 470), spike("lf-s4", 790, 470)],
    tokens: [token("lf-r1", 454, 316, 4.2)],
    gates: [{ x: 744, y: 320, w: 28, h: 180 }],
    bugReport: report("lf-bug", 858, 214, "Stable release includes all previous incidents"),
    bounds: WORLD,
    background: "#331a34",
  },

  // ── Post-2.0 content ──────────────────────────────────────────────────────

  {
    id: 12,
    patchId: 12,
    title: "Patch 2.1",
    modifier: "wide_world",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 430, w: 38, h: 62 },
    platforms: [
      { id: "l12-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      platform("l12-a", 200, 452, 130),
      platform("l12-b", 430, 394, 140),
      platform("l12-c", 680, 444, 110),
      platform("l12-d", 880, 386, 150),
      platform("l12-e", 1100, 438, 130),
      platform("l12-f", 1320, 386, 140),
      platform("l12-g", 1556, 432, 120),
      platform("l12-h", 1726, 382, 130),
    ],
    coins: [
      coin("l12-c1", 258, 418), coin("l12-c2", 498, 360),
      coin("l12-c3", 732, 410), coin("l12-c4", 954, 352),
      coin("l12-c5", 1162, 404), coin("l12-c6", 1388, 352),
    ],
    spikes: [
      spike("l12-s1", 364, 470), spike("l12-s2", 624, 470),
      spike("l12-s3", 1042, 470), spike("l12-s4", 1474, 470),
      spike("l12-s5", 1656, 470),
    ],
    bugReport: report("l12-bug", 954, 352, "Map boundaries exceeded roadmap"),
    bounds: WORLD_WIDE,
    background: "#111d3a",
  },

  {
    id: 13,
    patchId: 13,
    title: "Patch 2.2",
    modifier: "tall_world",
    gravity: "down",
    start: { x: 54, y: 1016, w: 28, h: 34 },
    exit: { x: 340, y: 100, w: 38, h: 62 },
    platforms: [
      { id: "l13-ground", kind: "solid", x: 0, y: 1060, w: 960, h: 40 },
      platform("l13-01",  60, 1010, 120),
      platform("l13-02", 300,  945, 120),
      platform("l13-03", 540,  880, 120),
      platform("l13-04", 780,  815, 120),
      platform("l13-05", 540,  750, 120),
      platform("l13-06", 300,  685, 120),
      platform("l13-07",  60,  620, 120),
      platform("l13-08", 300,  555, 120),
      platform("l13-09", 540,  490, 120),
      platform("l13-10", 780,  425, 120),
      platform("l13-11", 540,  360, 120),
      platform("l13-12", 300,  295, 120),
      platform("l13-13",  60,  230, 120),
      platform("l13-14", 300,  165, 120),
    ],
    coins: [
      coin("l13-c1", 110, 976), coin("l13-c2", 826, 781),
      coin("l13-c3", 346, 651), coin("l13-c4", 826, 391),
      coin("l13-c5", 346, 261),
    ],
    spikes: [
      spike("l13-s1", 220, 1050), spike("l13-s2", 690, 910),
      spike("l13-s3", 450, 840), spike("l13-s4", 690, 490),
    ],
    bugReport: report("l13-bug", 826, 391, "Vertical scope creep detected"),
    bounds: WORLD_TALL,
    background: "#152830",
  },

  {
    id: 14,
    patchId: 14,
    title: "Patch 2.3",
    modifier: "moving_platforms_h",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1378, y: 318, w: 38, h: 62 },
    platforms: [
      { id: "l14-ground", kind: "solid", x: 0, y: 500, w: 1440, h: 40 },
      platform("l14-base", 150, 452, 120),
      moving("l14-m1", 380, 402, 100, 72, 0.42),
      platform("l14-rest1", 570, 390, 110),
      moving("l14-m2", 766, 354, 100, 84, 0.50, 0.8),
      moving("l14-m3", 968, 400, 100, 66, 0.56, 1.6),
      platform("l14-rest2", 1138, 378, 110),
      moving("l14-m4", 1304, 342, 100, 78, 0.48, 0.4),
    ],
    coins: [
      coin("l14-c1", 208, 418), coin("l14-c2", 618, 356),
      coin("l14-c3", 1186, 344), coin("l14-c4", 1286, 308),
    ],
    spikes: [
      spike("l14-s1", 488, 470), spike("l14-s2", 876, 470),
      spike("l14-s3", 1072, 470),
    ],
    bugReport: report("l14-bug", 1186, 344, "Platforms dequeued during transit"),
    bounds: WORLD_WIDE_MED,
    background: "#1e2245",
  },

  {
    id: 15,
    patchId: 15,
    title: "Patch 2.4",
    modifier: "headwind",
    gravity: "down",
    wind: -1110,
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 318, w: 38, h: 62 },
    platforms: [
      ground("l15-ground"),
      platform("l15-a", 160, 450, 130),
      platform("l15-b", 390, 398, 130),
      platform("l15-c", 630, 452, 110),
      platform("l15-d", 738, 394, 130),
    ],
    coins: [
      coin("l15-c1", 218, 416), coin("l15-c2", 450, 364),
      coin("l15-c3", 796, 360), coin("l15-c4", 118, 470),
    ],
    spikes: [
      spike("l15-s1", 320, 470), spike("l15-s2", 544, 470),
      spike("l15-s3", 694, 470), spike("l15-s4", 848, 470),
    ],
    bugReport: report("l15-bug", 450, 364, "Wind resistance removed for throughput"),
    bounds: WORLD,
    background: "#2a1a2e",
  },

  {
    id: 16,
    patchId: 16,
    title: "Patch 2.5",
    modifier: "base",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 258, w: 38, h: 62 },
    platforms: [
      ground("l16-ground"),
      platform("l16-a", 142, 442, 118),
      platform("l16-b", 300, 398, 122),
      platform("l16-c", 496, 348, 120),
      platform("l16-d", 690, 292, 150),
      platform("l16-e", 770, 400, 94),
    ],
    coins: [
      coin("l16-c1", 194, 408), coin("l16-c2", 354, 364),
      coin("l16-c3", 548, 314), coin("l16-c4", 748, 258),
    ],
    spikes: [spike("l16-s1", 270, 470), spike("l16-s2", 446, 470), spike("l16-s3", 632, 470), spike("l16-s4", 840, 470)],
    bugReport: report("l16-bug", 748, 260, "Support ticket became load-bearing"),
    bounds: WORLD,
    background: "#14264a",
  },

  {
    id: 17,
    patchId: 17,
    title: "Patch 2.6",
    modifier: "jump_nerf",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 318, w: 38, h: 62 },
    platforms: [
      ground("l17-ground"),
      platform("l17-a", 150, 438, 118),
      platform("l17-b", 330, 408, 122),
      platform("l17-c", 526, 380, 118),
      platform("l17-d", 724, 352, 150),
    ],
    coins: [
      coin("l17-c1", 204, 404), coin("l17-c2", 386, 374),
      coin("l17-c3", 580, 346), coin("l17-c4", 804, 318),
    ],
    spikes: [spike("l17-s1", 294, 470), spike("l17-s2", 480, 470), spike("l17-s3", 682, 470)],
    bugReport: report("l17-bug", 796, 320, "Second jump nerf marked consistent"),
    bounds: WORLD,
    background: "#1c2c44",
  },

  {
    id: 18,
    patchId: 18,
    title: "Patch 2.7",
    modifier: "coin_spike_magnet",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 438, w: 38, h: 62 },
    platforms: [
      ground("l18-ground"),
      platform("l18-a", 162, 426, 120),
      platform("l18-b", 350, 394, 120),
      platform("l18-c", 546, 358, 122),
      platform("l18-d", 724, 410, 120),
    ],
    coins: [
      coin("l18-c1", 214, 392), coin("l18-c2", 406, 360),
      coin("l18-c3", 604, 324), coin("l18-c4", 774, 376),
      coin("l18-c5", 846, 470),
    ],
    spikes: [spike("l18-s1", 308, 470), spike("l18-s2", 504, 470), spike("l18-s3", 690, 470)],
    bugReport: report("l18-bug", 596, 326, "Analytics notified the hazards"),
    bounds: WORLD,
    background: "#201d46",
  },

  {
    id: 19,
    patchId: 19,
    title: "Patch 2.8",
    modifier: "async_platforms",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 238, w: 38, h: 62 },
    platforms: [
      ground("l19-ground"),
      asyncPlatform("l19-a", 142, 426, 116, 22, 0.2),
      asyncPlatform("l19-b", 316, 388, 116, 22, 0.9),
      platform("l19-rest", 496, 356, 110),
      asyncPlatform("l19-c", 650, 306, 116, 22, 1.4),
      asyncPlatform("l19-d", 776, 274, 120, 22, 0.35),
    ],
    coins: [
      coin("l19-c1", 194, 394), coin("l19-c2", 366, 354),
      coin("l19-c3", 548, 322), coin("l19-c4", 704, 272),
    ],
    spikes: [spike("l19-s1", 284, 470), spike("l19-s2", 464, 470), spike("l19-s3", 624, 470)],
    bugReport: report("l19-bug", 724, 274, "Standup delayed platform delivery"),
    bounds: WORLD,
    background: "#262147",
  },

  {
    id: 20,
    patchId: 20,
    title: "Patch 2.9",
    modifier: "moving_exit",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: {
      x: 840,
      y: 438,
      w: 38,
      h: 62,
      pads: [
        { id: "l20-p1", x: 840, y: 438, w: 38, h: 62 },
        { id: "l20-p2", x: 604, y: 332, w: 38, h: 62 },
        { id: "l20-p3", x: 828, y: 234, w: 38, h: 62 },
      ],
    },
    platforms: [
      ground("l20-ground"),
      platform("l20-a", 148, 426, 120),
      platform("l20-b", 328, 382, 120),
      platform("l20-c", 566, 394, 120),
      platform("l20-d", 762, 266, 130),
      platform("l20-e", 752, 452, 94),
    ],
    coins: [
      coin("l20-c1", 204, 392), coin("l20-c2", 384, 348),
      coin("l20-c3", 620, 360), coin("l20-c4", 842, 232),
    ],
    spikes: [spike("l20-s1", 292, 470), spike("l20-s2", 500, 470), spike("l20-s3", 704, 470)],
    bugReport: report("l20-bug", 840, 234, "Exit load balancer failed predictably"),
    bounds: WORLD,
    background: "#14324b",
  },

  {
    id: 21,
    patchId: 21,
    title: "Patch 3.0",
    modifier: "wide_world",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 292, w: 38, h: 62 },
    platforms: [
      { id: "l21-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      platform("l21-a", 170, 448, 126),
      platform("l21-b", 410, 402, 130),
      platform("l21-c", 650, 450, 120),
      platform("l21-d", 880, 396, 140),
      platform("l21-e", 1100, 372, 150),
      platform("l21-f", 1320, 426, 126),
      platform("l21-g", 1548, 366, 130),
      platform("l21-h", 1776, 326, 130),
    ],
    coins: [
      coin("l21-c1", 226, 414), coin("l21-c2", 472, 368),
      coin("l21-c3", 710, 416), coin("l21-c4", 950, 362),
      coin("l21-c5", 1166, 336), coin("l21-c6", 1380, 392),
      coin("l21-c7", 1608, 332),
    ],
    spikes: [
      spike("l21-s1", 330, 470), spike("l21-s2", 586, 470),
      spike("l21-s3", 812, 470), spike("l21-s4", 1042, 470),
      spike("l21-s5", 1492, 470), spike("l21-s6", 1710, 470),
    ],
    bugReport: report("l21-bug", 1166, 336, "Enterprise width exceeded estimate"),
    bounds: WORLD_WIDE,
    background: "#101f3f",
  },

  {
    id: 22,
    patchId: 22,
    title: "Patch 3.1",
    modifier: "tall_world",
    gravity: "down",
    start: { x: 54, y: 1016, w: 28, h: 34 },
    exit: { x: 340, y: 100, w: 38, h: 62 },
    platforms: [
      { id: "l22-ground", kind: "solid", x: 0, y: 1060, w: 960, h: 40 },
      platform("l22-01",  60, 1010, 120),
      platform("l22-02", 300,  945, 120),
      platform("l22-03", 540,  880, 120),
      platform("l22-04", 780,  815, 120),
      platform("l22-05", 540,  750, 120),
      platform("l22-06", 300,  685, 120),
      platform("l22-07",  60,  620, 120),
      platform("l22-08", 300,  555, 120),
      platform("l22-09", 540,  490, 120),
      platform("l22-10", 780,  425, 120),
      platform("l22-11", 540,  360, 120),
      platform("l22-12", 300,  295, 120),
      platform("l22-13",  60,  230, 120),
      platform("l22-14", 300,  165, 120),
    ],
    coins: [
      coin("l22-c1", 110, 976), coin("l22-c2", 826, 781),
      coin("l22-c3", 346, 651), coin("l22-c4", 826, 391),
      coin("l22-c5", 214, 706), coin("l22-c6", 826, 391),
      coin("l22-c7", 346, 261),
    ],
    spikes: [
      spike("l22-s1", 220, 1050), spike("l22-s2", 690, 910),
      spike("l22-s3", 450, 718), spike("l22-s4", 690, 456),
      spike("l22-s5", 450, 328),
    ],
    bugReport: report("l22-bug", 826, 391, "Org chart climb required"),
    bounds: WORLD_TALL,
    background: "#162d36",
  },

  {
    id: 23,
    patchId: 23,
    title: "Patch 3.2",
    modifier: "crumbling_platforms",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1376, y: 296, w: 38, h: 62 },
    platforms: [
      { id: "l23-ground", kind: "solid", x: 0, y: 500, w: 1440, h: 40 },
      crumble("l23-a", 150, 438, 118, 22, 1.15),
      crumble("l23-b", 330, 402, 112, 22, 1.1),
      platform("l23-rest1", 500, 392, 106),
      crumble("l23-c", 668, 356, 112, 22, 1.05),
      crumble("l23-d", 840, 402, 112, 22, 1.05),
      crumble("l23-e", 960, 340, 120, 22, 1.05),
      platform("l23-rest2", 1168, 384, 118),
      crumble("l23-f", 1300, 334, 120, 22, 1.1),
    ],
    coins: [
      coin("l23-c1", 204, 404), coin("l23-c2", 382, 368),
      coin("l23-c3", 556, 358), coin("l23-c4", 722, 322),
      coin("l23-c5", 1020, 306), coin("l23-c6", 1224, 350),
    ],
    spikes: [
      spike("l23-s1", 452, 470), spike("l23-s2", 618, 470),
      spike("l23-s3", 806, 470), spike("l23-s4", 1110, 470),
      spike("l23-s5", 1290, 470),
    ],
    bugReport: report("l23-bug", 1020, 306, "Platform budget expired mid-route"),
    bounds: WORLD_WIDE_MED,
    background: "#2b243f",
  },

  {
    id: 24,
    patchId: 24,
    title: "Patch 3.3",
    modifier: "moving_platforms_h",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1378, y: 284, w: 38, h: 62 },
    platforms: [
      { id: "l24-ground", kind: "solid", x: 0, y: 500, w: 1440, h: 40 },
      platform("l24-base", 148, 452, 120),
      moving("l24-m1", 338, 410, 102, 88, 0.45, 0.1),
      moving("l24-m2", 556, 374, 102, 72, 0.52, 0.8),
      platform("l24-rest1", 766, 382, 112),
      moving("l24-m3", 956, 346, 102, 84, 0.48, 1.5),
      platform("l24-rest2", 1190, 346, 126),
      moving("l24-m4", 1298, 316, 102, 70, 0.54, 0.5),
    ],
    coins: [
      coin("l24-c1", 206, 418), coin("l24-c2", 810, 348),
      coin("l24-c3", 1248, 312), coin("l24-c4", 1328, 282),
    ],
    spikes: [
      spike("l24-s1", 466, 470), spike("l24-s2", 704, 470),
      spike("l24-s3", 1112, 470), spike("l24-s4", 1284, 470),
    ],
    bugReport: report("l24-bug", 1248, 312, "Ledge sprint velocity disputed"),
    bounds: WORLD_WIDE_MED,
    background: "#242044",
  },

  {
    id: 25,
    patchId: 25,
    title: "Patch 3.4",
    modifier: "headwind",
    gravity: "down",
    wind: -960,
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 438, w: 38, h: 62 },
    platforms: [
      ground("l25-ground"),
      platform("l25-a", 150, 444, 120),
      platform("l25-b", 342, 414, 120),
      platform("l25-c", 532, 444, 122),
      platform("l25-d", 700, 390, 126),
    ],
    coins: [
      coin("l25-c1", 204, 410), coin("l25-c2", 398, 380),
      coin("l25-c3", 592, 410), coin("l25-c4", 736, 356),
      coin("l25-c5", 842, 470),
    ],
    spikes: [spike("l25-s1", 292, 470), spike("l25-s2", 488, 470), spike("l25-s3", 666, 470), spike("l25-s4", 814, 470)],
    bugReport: report("l25-bug", 736, 356, "Wind tunnel test never ended"),
    bounds: WORLD,
    background: "#2b1e32",
  },

  {
    id: 26,
    patchId: 26,
    title: "Patch 3.5",
    modifier: "rollback_token",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 318, w: 38, h: 62 },
    platforms: [
      ground("l26-ground"),
      platform("l26-a", 156, 430, 116),
      platform("l26-b", 346, 382, 116),
      platform("l26-c", 520, 430, 116),
      platform("l26-d", 650, 400, 126),
      platform("l26-e", 790, 352, 116),
    ],
    coins: [
      coin("l26-c1", 206, 396), coin("l26-c2", 396, 348),
      coin("l26-c3", 570, 396), coin("l26-c4", 704, 366),
      coin("l26-c5", 842, 318),
    ],
    spikes: [spike("l26-s1", 300, 470), spike("l26-s2", 486, 470), spike("l26-s3", 760, 470)],
    tokens: [token("l26-r1", 118, 402, 4.6), token("l26-r2", 606, 392, 4.4)],
    gates: [
      { x: 304, y: 314, w: 28, h: 186 },
      { x: 808, y: 294, w: 28, h: 206 },
    ],
    bugReport: report("l26-bug", 704, 366, "Rollback token asked for trust"),
    bounds: WORLD,
    background: "#302047",
  },

  {
    id: 27,
    patchId: 27,
    title: "Patch 3.6",
    modifier: "exit_fee",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 438, w: 38, h: 62, fee: 5 },
    platforms: [
      ground("l27-ground"),
      platform("l27-a", 146, 428, 118),
      platform("l27-b", 318, 372, 118),
      platform("l27-c", 520, 414, 118),
      platform("l27-d", 700, 350, 126),
    ],
    coins: [
      coin("l27-c1", 118, 470), coin("l27-c2", 200, 394),
      coin("l27-c3", 374, 338), coin("l27-c4", 574, 380),
      coin("l27-c5", 742, 316), coin("l27-c6", 820, 470),
      coin("l27-c7", 858, 470),
    ],
    spikes: [spike("l27-s1", 286, 470), spike("l27-s2", 468, 470), spike("l27-s3", 650, 470)],
    bugReport: report("l27-bug", 742, 316, "Premium routing billed the door"),
    bounds: WORLD,
    background: "#20313b",
  },

  {
    id: 28,
    patchId: 28,
    title: "Patch 3.7",
    modifier: "rotated_gravity",
    gravity: "right",
    start: { x: 52, y: 140, w: 28, h: 34 },
    exit: { x: 808, y: 420, w: 62, h: 38 },
    platforms: [
      platform("l28-wall", 878, 0, 44, 540),
      platform("l28-roof", 0, 0, 960, 28),
      platform("l28-floor", 0, 512, 960, 28),
      platform("l28-a", 742, 76, 32, 132),
      platform("l28-b", 604, 292, 32, 144),
      platform("l28-c", 432, 96, 32, 150),
      platform("l28-d", 252, 300, 32, 136),
      platform("l28-e", 150, 118, 32, 126),
    ],
    coins: [
      coin("l28-c1", 700, 140), coin("l28-c2", 562, 360),
      coin("l28-c3", 392, 174), coin("l28-c4", 214, 360),
      coin("l28-c5", 138, 178),
    ],
    spikes: [spike("l28-s1", 848, 222, 30, 32), spike("l28-s2", 848, 346, 30, 32), spike("l28-s3", 848, 468, 30, 32)],
    bugReport: report("l28-bug", 610, 330, "Axis migration repeated itself"),
    bounds: WORLD,
    background: "#10313f",
  },

  {
    id: 29,
    patchId: 29,
    title: "Patch 3.8",
    modifier: "slippery_floor",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 258, w: 38, h: 62 },
    platforms: [
      ground("l29-ground"),
      platform("l29-a", 148, 434, 110),
      platform("l29-b", 318, 382, 90),
      platform("l29-c", 486, 434, 90),
      platform("l29-d", 648, 376, 90),
      platform("l29-e", 800, 322, 116),
    ],
    coins: [
      coin("l29-c1", 194, 400), coin("l29-c2", 356, 348),
      coin("l29-c3", 530, 400), coin("l29-c4", 690, 342),
      coin("l29-c5", 852, 288),
    ],
    spikes: [
      spike("l29-s1", 274, 470), spike("l29-s2", 428, 470),
      spike("l29-s3", 596, 470), spike("l29-s4", 762, 470),
    ],
    bugReport: report("l29-bug", 530, 400, "Stopping deferred to next sprint"),
    bounds: WORLD,
    background: "#12364a",
  },

  {
    id: 30,
    patchId: 30,
    title: "Patch 3.9",
    modifier: "finale_combo",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1378, y: 206, w: 38, h: 62, fee: 7 },
    platforms: [
      { id: "l30-ground", kind: "solid", x: 0, y: 500, w: 1440, h: 40 },
      crumble("l30-a", 142, 430, 112, 22, 1.05),
      asyncPlatform("l30-b", 310, 390, 120, 22, 0.1),
      crumble("l30-c", 500, 350, 112, 22, 1.05),
      asyncPlatform("l30-d", 666, 310, 118, 22, 0.75),
      crumble("l30-e", 850, 352, 116, 22, 1.05),
      asyncPlatform("l30-f", 1030, 316, 130, 22, 0.3),
      crumble("l30-g", 1230, 282, 130, 22, 1.05),
    ],
    coins: [
      coin("l30-c1", 188, 398), coin("l30-c2", 358, 356),
      coin("l30-c3", 548, 316), coin("l30-c4", 716, 276),
      coin("l30-c5", 904, 318), coin("l30-c6", 1088, 282),
      coin("l30-c7", 1288, 250), coin("l30-c8", 830, 470),
      coin("l30-c9", 118, 470),
    ],
    spikes: [
      spike("l30-s1", 278, 470), spike("l30-s2", 458, 470),
      spike("l30-s3", 622, 470), spike("l30-s4", 802, 470),
      spike("l30-s5", 990, 470), spike("l30-s6", 1190, 470),
    ],
    tokens: [token("l30-r1", 454, 326, 4.2), token("l30-r2", 1010, 288, 4.0)],
    gates: [
      { x: 744, y: 322, w: 28, h: 178 },
      { x: 1186, y: 304, w: 28, h: 196 },
    ],
    bugReport: report("l30-bug", 1288, 250, "Final final stability incident"),
    bounds: WORLD_WIDE_MED,
    background: "#351a38",
  },

  {
    id: 31,
    patchId: 31,
    title: "Patch 4.0",
    chapter: "production_floor",
    modifier: "production_intro",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 296, w: 38, h: 62 },
    challenge: { type: "all_coins", label: "Collect every neon coin before shipping." },
    platforms: [
      ground("l31-ground"),
      conveyor("l31-belt1", 128, 442, 190, 112),
      platform("l31-a", 354, 406, 120),
      conveyor("l31-belt2", 530, 374, 190, -104),
      platform("l31-c", 792, 360, 126),
    ],
    coins: [
      coin("l31-c1", 190, 408), coin("l31-c2", 268, 408),
      coin("l31-c3", 410, 372), coin("l31-c4", 604, 340),
      coin("l31-c5", 842, 326),
    ],
    spikes: [spike("l31-s1", 330, 470), spike("l31-s2", 742, 470)],
    bugReport: report("l31-bug", 604, 340, "Production conveyors created opinions"),
    bounds: WORLD,
    background: "#071b24",
  },

  {
    id: 32,
    patchId: 32,
    title: "Patch 4.1",
    chapter: "production_floor",
    modifier: "security_lasers",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 224, w: 38, h: 62 },
    challenge: { type: "no_sensor", label: "Ship without crossing a security scanner." },
    platforms: [
      ground("l32-ground"),
      platform("l32-a", 132, 430, 120),
      platform("l32-b", 316, 382, 122),
      platform("l32-c", 520, 334, 122),
      platform("l32-d", 730, 286, 160),
    ],
    coins: [
      coin("l32-c1", 184, 396), coin("l32-c2", 372, 348),
      coin("l32-c3", 578, 300), coin("l32-c4", 810, 252),
    ],
    spikes: [spike("l32-s1", 276, 470), spike("l32-s2", 676, 470)],
    laserGates: [
      laserGate("l32-lg1", 274, 302, 24, 198, 0.1),
      laserGate("l32-lg2", 484, 252, 24, 248, 0.9),
      laserGate("l32-lg3", 690, 216, 24, 284, 1.6),
    ],
    sensors: [sensor("l32-scan1", 338, 300, 92, 82, 2.2)],
    bugReport: report("l32-bug", 578, 300, "Security beams blinked politely"),
    bounds: WORLD,
    background: "#081d2f",
  },

  {
    id: 33,
    patchId: 33,
    title: "Patch 4.2",
    chapter: "production_floor",
    modifier: "double_jump_unlock",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 872, y: 158, w: 38, h: 62 },
    challenge: { type: "par_time", label: "Finish before the air-control audit expires.", parTime: 38 },
    platforms: [
      ground("l33-ground"),
      platform("l33-a", 150, 430, 120),
      platform("l33-b", 350, 356, 126),
      platform("l33-c", 580, 274, 126),
      platform("l33-d", 780, 220, 130),
    ],
    coins: [
      coin("l33-c1", 206, 396), coin("l33-c2", 410, 322),
      coin("l33-c3", 642, 240), coin("l33-c4", 842, 186),
    ],
    spikes: [spike("l33-s1", 296, 470), spike("l33-s2", 526, 470), spike("l33-s3", 738, 470)],
    jumpPads: [jumpPad("l33-jp1", 244, 484), jumpPad("l33-jp2", 494, 484), jumpPad("l33-jp3", 720, 484)],
    bugReport: report("l33-bug", 642, 240, "Air-control approval memo bounced"),
    bounds: WORLD,
    background: "#091f2a",
  },

  {
    id: 34,
    patchId: 34,
    title: "Patch 4.3",
    chapter: "production_floor",
    modifier: "razor_rails",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1376, y: 268, w: 38, h: 62 },
    challenge: { type: "all_coins", label: "Collect every coin while dodging razor rails." },
    platforms: [
      { id: "l34-ground", kind: "solid", x: 0, y: 500, w: 1440, h: 40 },
      platform("l34-a", 148, 434, 112),
      platform("l34-b", 342, 386, 112),
      platform("l34-c", 556, 342, 112),
      platform("l34-d", 776, 390, 112),
      platform("l34-e", 1002, 334, 112),
      platform("l34-f", 1230, 302, 160),
    ],
    coins: [
      coin("l34-c1", 204, 400), coin("l34-c2", 398, 352),
      coin("l34-c3", 612, 308), coin("l34-c4", 832, 356),
      coin("l34-c5", 1058, 300), coin("l34-c6", 1294, 268),
    ],
    spikes: [spike("l34-s1", 286, 470), spike("l34-s2", 514, 470), spike("l34-s3", 928, 470), spike("l34-s4", 1182, 470)],
    razors: [
      razor("l34-rz1", 468, 412, 34, "y", 58, 0.46, 0.4),
      razor("l34-rz2", 706, 350, 34, "x", 86, 0.38, 1.1),
      razor("l34-rz3", 1140, 328, 38, "y", 72, 0.42, 2.0),
    ],
    bugReport: report("l34-bug", 1058, 300, "Indexer returned sharp results"),
    bounds: WORLD_WIDE_MED,
    background: "#071720",
  },

  {
    id: 35,
    patchId: 35,
    title: "Patch 4.4",
    chapter: "production_floor",
    modifier: "sweep_lasers",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: {
      x: 844,
      y: 438,
      w: 38,
      h: 62,
      pads: [
        { id: "l35-p1", x: 844, y: 438, w: 38, h: 62 },
        { id: "l35-p2", x: 638, y: 318, w: 38, h: 62 },
        { id: "l35-p3", x: 864, y: 210, w: 38, h: 62 },
      ],
    },
    challenge: { type: "first_exit", label: "Reach the first active exit before it relocates." },
    platforms: [
      ground("l35-ground"),
      platform("l35-a", 134, 432, 120),
      platform("l35-b", 314, 384, 120),
      platform("l35-c", 554, 352, 120),
      platform("l35-d", 748, 244, 156),
      platform("l35-e", 772, 452, 110),
    ],
    coins: [
      coin("l35-c1", 190, 398), coin("l35-c2", 370, 350),
      coin("l35-c3", 614, 318), coin("l35-c4", 840, 210),
    ],
    spikes: [spike("l35-s1", 280, 470), spike("l35-s2", 500, 470), spike("l35-s3", 704, 470)],
    sweepLasers: [
      sweepLaser("l35-sw1", 410, 252, 210, 14, "y", 86, 0.32, 0.2),
      sweepLaser("l35-sw2", 680, 168, 14, 232, "x", 78, 0.36, 1.4),
    ],
    bugReport: report("l35-bug", 614, 318, "Load balancer disliked fixed doors"),
    bounds: WORLD,
    background: "#08182d",
  },

  {
    id: 36,
    patchId: 36,
    title: "Patch 4.5",
    chapter: "production_floor",
    modifier: "crusher_panels",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 254, w: 38, h: 62 },
    challenge: { type: "par_time", label: "Clear compression under par time.", parTime: 44 },
    platforms: [
      ground("l36-ground"),
      platform("l36-a", 134, 430, 116),
      platform("l36-b", 306, 382, 118),
      platform("l36-c", 500, 424, 116),
      platform("l36-d", 690, 356, 118),
      platform("l36-e", 812, 318, 116),
    ],
    coins: [
      coin("l36-c1", 190, 396), coin("l36-c2", 362, 348),
      coin("l36-c3", 556, 390), coin("l36-c4", 748, 322),
      coin("l36-c5", 866, 284),
    ],
    spikes: [spike("l36-s1", 268, 470), spike("l36-s2", 462, 470), spike("l36-s3", 650, 470)],
    crushers: [
      crusher("l36-cr1", 272, 220, 46, 112, "y", 90, 0.42, 0.2),
      crusher("l36-cr2", 632, 210, 52, 126, "y", 104, 0.44, 1.2),
      crusher("l36-cr3", 814, 196, 48, 112, "y", 82, 0.48, 2.1),
    ],
    bugReport: report("l36-bug", 748, 322, "Compression panel overachieved"),
    bounds: WORLD,
    background: "#101522",
  },

  {
    id: 37,
    patchId: 37,
    title: "Patch 4.6",
    chapter: "production_floor",
    modifier: "tesla_arcs",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 226, w: 38, h: 62 },
    challenge: { type: "no_rollback", label: "Ship without using a rollback token." },
    platforms: [
      ground("l37-ground"),
      platform("l37-a", 142, 430, 116),
      platform("l37-b", 322, 374, 116),
      platform("l37-c", 518, 330, 116),
      platform("l37-d", 706, 286, 116),
      platform("l37-e", 824, 286, 108),
    ],
    coins: [
      coin("l37-c1", 196, 396), coin("l37-c2", 378, 340),
      coin("l37-c3", 574, 296), coin("l37-c4", 760, 252),
    ],
    spikes: [spike("l37-s1", 282, 470), spike("l37-s2", 676, 470)],
    tokens: [token("l37-r1", 284, 392, 3.8), token("l37-r2", 662, 300, 3.6)],
    teslaArcs: [
      tesla("l37-t1", 288, 318, 288, 500, 0.1),
      tesla("l37-t2", 474, 264, 474, 500, 0.9),
      tesla("l37-t3", 660, 224, 660, 500, 1.7),
    ],
    bugReport: report("l37-bug", 574, 296, "Merge conflict gained voltage"),
    bounds: WORLD,
    background: "#11142b",
  },

  {
    id: 38,
    patchId: 38,
    title: "Patch 4.7",
    chapter: "production_floor",
    modifier: "security_sensors",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1378, y: 266, w: 38, h: 62 },
    challenge: { type: "no_sensor", label: "Reach the exit without triggering lockdown." },
    platforms: [
      { id: "l38-ground", kind: "solid", x: 0, y: 500, w: 1440, h: 40 },
      platform("l38-a", 150, 432, 116),
      platform("l38-b", 338, 382, 116),
      platform("l38-c", 552, 334, 116),
      platform("l38-d", 774, 382, 116),
      platform("l38-e", 1002, 330, 116),
      platform("l38-f", 1238, 302, 150),
    ],
    coins: [
      coin("l38-c1", 206, 398), coin("l38-c2", 394, 348),
      coin("l38-c3", 608, 300), coin("l38-c4", 830, 348),
      coin("l38-c5", 1060, 296), coin("l38-c6", 1300, 268),
    ],
    spikes: [spike("l38-s1", 288, 470), spike("l38-s2", 704, 470), spike("l38-s3", 1180, 470)],
    sensors: [
      sensor("l38-sn1", 464, 294, 96, 112, 3),
      sensor("l38-sn2", 900, 288, 110, 116, 3),
    ],
    doors: [
      door("l38-d1", 690, 342, 34, 158, { linkedToLockdown: true }),
      door("l38-d2", 1162, 318, 34, 182, { linkedToLockdown: true }),
    ],
    laserGates: [laserGate("l38-lg1", 1162, 318, 34, 182, 0.55)],
    bugReport: report("l38-bug", 1060, 296, "Observability watched too hard"),
    bounds: WORLD_WIDE_MED,
    background: "#061b2b",
  },

  {
    id: 39,
    patchId: 39,
    title: "Patch 4.8",
    chapter: "production_floor",
    modifier: "plasma_vents",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1376, y: 214, w: 38, h: 62 },
    challenge: { type: "all_coins", label: "Collect every coin while the cooling system vents." },
    platforms: [
      { id: "l39-ground", kind: "solid", x: 0, y: 500, w: 1440, h: 40 },
      asyncPlatform("l39-a", 146, 432, 116, 22, 0.1),
      platform("l39-rest1", 330, 386, 116),
      asyncPlatform("l39-b", 538, 342, 116, 22, 0.9),
      platform("l39-rest2", 740, 392, 116),
      asyncPlatform("l39-c", 966, 326, 116, 22, 1.6),
      platform("l39-d", 1226, 278, 160),
    ],
    coins: [
      coin("l39-c1", 202, 398), coin("l39-c2", 388, 352),
      coin("l39-c3", 594, 308), coin("l39-c4", 800, 358),
      coin("l39-c5", 1024, 292), coin("l39-c6", 1300, 244),
    ],
    spikes: [spike("l39-s1", 280, 470), spike("l39-s2", 500, 470), spike("l39-s3", 900, 470), spike("l39-s4", 1188, 470)],
    plasmaVents: [
      vent("l39-v1", 300, 492, 62, 8, "up", 154, 0.2),
      vent("l39-v2", 670, 492, 62, 8, "up", 176, 1.0),
      vent("l39-v3", 1118, 492, 62, 8, "up", 190, 1.8),
    ],
    bugReport: report("l39-bug", 1024, 292, "Cooling fix ran very hot"),
    bounds: WORLD_WIDE_MED,
    background: "#081724",
  },

  {
    id: 40,
    patchId: 40,
    title: "Patch 4.9",
    chapter: "production_floor",
    modifier: "production_finale",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1378, y: 182, w: 38, h: 62, fee: 6 },
    challenge: { type: "master", label: "Master patch: all coins and under par.", parTime: 76 },
    platforms: [
      { id: "l40-ground", kind: "solid", x: 0, y: 500, w: 1440, h: 40 },
      conveyor("l40-belt1", 130, 444, 178, 114),
      platform("l40-a", 354, 398, 112),
      platform("l40-b", 544, 344, 112),
      conveyor("l40-belt2", 742, 392, 164, -108),
      platform("l40-c", 980, 326, 116),
      platform("l40-d", 1228, 244, 160),
    ],
    coins: [
      coin("l40-c1", 196, 410), coin("l40-c2", 410, 364),
      coin("l40-c3", 600, 310), coin("l40-c4", 814, 358),
      coin("l40-c5", 1038, 292), coin("l40-c6", 1298, 210),
      coin("l40-c7", 866, 470), coin("l40-c8", 118, 470),
    ],
    spikes: [spike("l40-s1", 318, 470), spike("l40-s2", 708, 470), spike("l40-s3", 1186, 470)],
    laserGates: [laserGate("l40-lg1", 486, 252, 24, 248, 0.25)],
    sweepLasers: [sweepLaser("l40-sw1", 880, 226, 190, 14, "y", 96, 0.34, 0.8)],
    razors: [razor("l40-rz1", 656, 372, 36, "x", 82, 0.42, 1.5), razor("l40-rz2", 1128, 298, 38, "y", 70, 0.46, 2.2)],
    crushers: [crusher("l40-cr1", 1194, 134, 54, 118, "y", 92, 0.46, 0.6)],
    plasmaVents: [vent("l40-v1", 920, 492, 62, 8, "up", 176, 1.3)],
    jumpPads: [jumpPad("l40-jp1", 308, 484, 54, 16, 700), jumpPad("l40-jp2", 910, 484, 54, 16, 700)],
    bugReport: report("l40-bug", 1298, 210, "Release candidate remained unstable"),
    bounds: WORLD_WIDE_MED,
    background: "#0a1424",
  },

  // ── Chapter 2 continuation: Patches 5.0–5.14 ─────────────────────────────

  {
    id: 41,
    patchId: 41,
    title: "Patch 5.0",
    chapter: "production_floor",
    modifier: "security_lasers",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 242, w: 38, h: 62 },
    challenge: { type: "all_coins", label: "Collect every coin past the laser grid." },
    platforms: [
      { id: "l41-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      platform("l41-a", 150, 440, 120),
      platform("l41-b", 390, 396, 120),
      platform("l41-c", 650, 350, 120),
      platform("l41-d", 920, 394, 120),
      platform("l41-e", 1180, 348, 120),
      platform("l41-f", 1440, 302, 120),
      platform("l41-g", 1700, 270, 160),
    ],
    coins: [
      coin("l41-c1", 208, 406), coin("l41-c2", 450, 362),
      coin("l41-c3", 710, 316), coin("l41-c4", 978, 360),
      coin("l41-c5", 1238, 314), coin("l41-c6", 1778, 236),
    ],
    spikes: [
      spike("l41-s1", 308, 470), spike("l41-s2", 566, 470),
      spike("l41-s3", 834, 470), spike("l41-s4", 1098, 470),
      spike("l41-s5", 1362, 470), spike("l41-s6", 1618, 470),
    ],
    laserGates: [
      laserGate("l41-lg1", 348, 308, 24, 192, 0.0),
      laserGate("l41-lg2", 610, 264, 24, 236, 0.8),
      laserGate("l41-lg3", 876, 312, 24, 188, 1.5),
      laserGate("l41-lg4", 1134, 260, 24, 240, 0.4),
      laserGate("l41-lg5", 1400, 218, 24, 282, 1.1),
    ],
    bugReport: report("l41-bug", 1238, 314, "Laser density flagged as feature"),
    bounds: WORLD_WIDE,
    background: "#071820",
  },

  {
    id: 42,
    patchId: 42,
    title: "Patch 5.1",
    chapter: "production_floor",
    modifier: "razor_rails",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 184, w: 38, h: 62 },
    challenge: { type: "par_time", label: "Clear the razor maze under par.", parTime: 42 },
    platforms: [
      ground("l42-ground"),
      platform("l42-a", 136, 430, 112),
      platform("l42-b", 316, 374, 112),
      platform("l42-c", 492, 316, 112),
      platform("l42-d", 672, 260, 112),
      platform("l42-e", 766, 220, 130),
    ],
    coins: [
      coin("l42-c1", 192, 396), coin("l42-c2", 372, 340),
      coin("l42-c3", 548, 282), coin("l42-c4", 728, 226),
      coin("l42-c5", 840, 186),
    ],
    spikes: [spike("l42-s1", 268, 470), spike("l42-s2", 450, 470), spike("l42-s3", 628, 470), spike("l42-s4", 820, 470)],
    razors: [
      razor("l42-rz1", 238, 336, 34, "x", 74, 0.50, 0.0),
      razor("l42-rz2", 426, 278, 34, "y", 66, 0.54, 0.7),
      razor("l42-rz3", 608, 224, 34, "x", 78, 0.48, 1.4),
      razor("l42-rz4", 748, 164, 34, "y", 56, 0.52, 2.0),
    ],
    bugReport: report("l42-bug", 548, 282, "Indexer performance exceeded spec"),
    bounds: WORLD,
    background: "#091620",
  },

  {
    id: 43,
    patchId: 43,
    title: "Patch 5.2",
    chapter: "production_floor",
    modifier: "sweep_lasers",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 204, w: 38, h: 62 },
    challenge: { type: "no_rollback", label: "Navigate the sweep grid without rollback." },
    platforms: [
      { id: "l43-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      platform("l43-a", 148, 440, 120),
      platform("l43-b", 420, 394, 120),
      platform("l43-c", 730, 344, 120),
      platform("l43-d", 1000, 300, 120),
      platform("l43-e", 1300, 256, 120),
      platform("l43-f", 1610, 224, 240),
    ],
    coins: [
      coin("l43-c1", 208, 406), coin("l43-c2", 480, 360),
      coin("l43-c3", 790, 310), coin("l43-c4", 1060, 266),
      coin("l43-c5", 1360, 222), coin("l43-c6", 1730, 190),
    ],
    spikes: [
      spike("l43-s1", 314, 470), spike("l43-s2", 592, 470),
      spike("l43-s3", 876, 470), spike("l43-s4", 1164, 470),
      spike("l43-s5", 1484, 470),
    ],
    sweepLasers: [
      sweepLaser("l43-sw1", 318, 310, 14, 190, "x", 100, 0.30, 0.0),
      sweepLaser("l43-sw2", 596, 266, 250, 14, "y", 88, 0.34, 0.9),
      sweepLaser("l43-sw3", 882, 222, 14, 200, "x", 90, 0.32, 1.8),
      sweepLaser("l43-sw4", 1484, 188, 220, 14, "y", 72, 0.36, 0.5),
    ],
    tokens: [token("l43-r1", 118, 412, 3.6)],
    bugReport: report("l43-bug", 1060, 266, "Sweep laser covered all edge cases"),
    bounds: WORLD_WIDE,
    background: "#07182c",
  },

  {
    id: 44,
    patchId: 44,
    title: "Patch 5.3",
    chapter: "production_floor",
    modifier: "crusher_panels",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 230, w: 38, h: 62 },
    challenge: { type: "all_coins", label: "Collect every coin under the compression gauntlet." },
    platforms: [
      { id: "l44-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      platform("l44-a", 148, 432, 116),
      platform("l44-b", 388, 384, 116),
      platform("l44-c", 640, 432, 116),
      platform("l44-d", 900, 380, 116),
      platform("l44-e", 1150, 334, 116),
      platform("l44-f", 1420, 286, 116),
      platform("l44-g", 1680, 262, 190),
    ],
    coins: [
      coin("l44-c1", 204, 398), coin("l44-c2", 444, 350),
      coin("l44-c3", 696, 398), coin("l44-c4", 956, 346),
      coin("l44-c5", 1206, 300), coin("l44-c6", 1476, 252),
      coin("l44-c7", 1772, 228),
    ],
    spikes: [
      spike("l44-s1", 308, 470), spike("l44-s2", 558, 470),
      spike("l44-s3", 818, 470), spike("l44-s4", 1068, 470),
      spike("l44-s5", 1330, 470), spike("l44-s6", 1598, 470),
    ],
    crushers: [
      crusher("l44-cr1", 320, 220, 50, 120, "y", 100, 0.42, 0.0),
      crusher("l44-cr2", 570, 200, 50, 140, "y", 118, 0.44, 0.8),
      crusher("l44-cr3", 832, 210, 50, 130, "y", 110, 0.40, 1.6),
      crusher("l44-cr4", 1082, 200, 50, 140, "y", 120, 0.46, 0.3),
      crusher("l44-cr5", 1344, 190, 50, 152, "y", 130, 0.44, 1.2),
    ],
    bugReport: report("l44-bug", 956, 346, "Compression target exceeded memory"),
    bounds: WORLD_WIDE,
    background: "#0e1322",
  },

  {
    id: 45,
    patchId: 45,
    title: "Patch 5.4",
    chapter: "production_floor",
    modifier: "tesla_arcs",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 178, w: 38, h: 62 },
    challenge: { type: "par_time", label: "Arc through under 40 seconds.", parTime: 40 },
    platforms: [
      ground("l45-ground"),
      platform("l45-a", 136, 428, 116),
      platform("l45-b", 318, 370, 116),
      platform("l45-c", 500, 308, 116),
      platform("l45-d", 680, 254, 116),
      platform("l45-e", 776, 212, 136),
    ],
    coins: [
      coin("l45-c1", 192, 394), coin("l45-c2", 374, 336),
      coin("l45-c3", 556, 274), coin("l45-c4", 736, 220),
      coin("l45-c5", 844, 178),
    ],
    spikes: [spike("l45-s1", 272, 470), spike("l45-s2", 462, 470), spike("l45-s3", 638, 470), spike("l45-s4", 828, 470)],
    teslaArcs: [
      tesla("l45-t1", 248, 316, 248, 500, 0.0),
      tesla("l45-t2", 430, 256, 430, 500, 0.75),
      tesla("l45-t3", 610, 200, 610, 500, 1.50),
      tesla("l45-t4", 758, 146, 758, 500, 0.35),
    ],
    tokens: [token("l45-r1", 466, 326, 3.4)],
    bugReport: report("l45-bug", 556, 274, "Arc grounded in production"),
    bounds: WORLD,
    background: "#0f1228",
  },

  {
    id: 46,
    patchId: 46,
    title: "Patch 5.5",
    chapter: "production_floor",
    modifier: "security_sensors",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 226, w: 38, h: 62 },
    challenge: { type: "no_sensor", label: "Ghost through security. Zero trips." },
    platforms: [
      ground("l46-ground"),
      platform("l46-a", 134, 430, 116),
      platform("l46-b", 310, 374, 116),
      platform("l46-c", 500, 322, 116),
      platform("l46-d", 688, 266, 116),
      platform("l46-e", 786, 240, 136),
    ],
    coins: [
      coin("l46-c1", 190, 396), coin("l46-c2", 366, 340),
      coin("l46-c3", 556, 288), coin("l46-c4", 742, 232),
      coin("l46-c5", 854, 192),
    ],
    spikes: [spike("l46-s1", 266, 470), spike("l46-s2", 456, 470), spike("l46-s3", 644, 470), spike("l46-s4", 826, 470)],
    sensors: [
      sensor("l46-sn1", 266, 294, 82, 96, 4),
      sensor("l46-sn2", 454, 242, 82, 80, 4),
      sensor("l46-sn3", 642, 188, 82, 88, 4),
    ],
    doors: [
      door("l46-d1", 428, 288, 30, 212, { linkedToLockdown: true }),
      door("l46-d2", 614, 234, 30, 266, { linkedToLockdown: true }),
      door("l46-d3", 802, 188, 30, 312, { linkedToLockdown: true }),
    ],
    bugReport: report("l46-bug", 556, 288, "Security cleared itself first"),
    bounds: WORLD,
    background: "#071b2a",
  },

  {
    id: 47,
    patchId: 47,
    title: "Patch 5.6",
    chapter: "production_floor",
    modifier: "plasma_vents",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 198, w: 38, h: 62 },
    challenge: { type: "all_coins", label: "Collect everything between the vent pulses." },
    platforms: [
      ground("l47-ground"),
      platform("l47-a", 134, 428, 112),
      platform("l47-b", 316, 370, 112),
      platform("l47-c", 508, 314, 112),
      platform("l47-d", 696, 260, 112),
      platform("l47-e", 792, 218, 130),
    ],
    coins: [
      coin("l47-c1", 190, 394), coin("l47-c2", 372, 336),
      coin("l47-c3", 564, 280), coin("l47-c4", 750, 226),
      coin("l47-c5", 858, 184),
    ],
    spikes: [spike("l47-s1", 274, 470), spike("l47-s2", 462, 470), spike("l47-s3", 648, 470), spike("l47-s4", 832, 470)],
    plasmaVents: [
      vent("l47-v1", 244, 492, 62, 8, "up", 200, 0.0),
      vent("l47-v2", 432, 492, 62, 8, "up", 220, 0.75),
      vent("l47-v3", 616, 492, 62, 8, "up", 240, 1.5),
      vent("l47-v4", 798, 492, 62, 8, "up", 260, 0.4),
    ],
    bugReport: report("l47-bug", 564, 280, "Cooling system still optimistic"),
    bounds: WORLD,
    background: "#081724",
  },

  {
    id: 48,
    patchId: 48,
    title: "Patch 5.7",
    chapter: "production_floor",
    modifier: "razor_rails",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 198, w: 38, h: 62 },
    challenge: { type: "master", label: "Master patch: all coins, under par.", parTime: 70 },
    platforms: [
      { id: "l48-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      platform("l48-a", 148, 434, 114),
      platform("l48-b", 400, 384, 114),
      platform("l48-c", 660, 330, 114),
      platform("l48-d", 940, 380, 114),
      platform("l48-e", 1210, 326, 114),
      platform("l48-f", 1490, 278, 114),
      platform("l48-g", 1706, 236, 190),
    ],
    coins: [
      coin("l48-c1", 204, 400), coin("l48-c2", 456, 350),
      coin("l48-c3", 716, 296), coin("l48-c4", 996, 346),
      coin("l48-c5", 1266, 292), coin("l48-c6", 1546, 244),
      coin("l48-c7", 1800, 202),
    ],
    spikes: [
      spike("l48-s1", 312, 470), spike("l48-s2", 572, 470),
      spike("l48-s3", 852, 470), spike("l48-s4", 1124, 470),
      spike("l48-s5", 1400, 470), spike("l48-s6", 1652, 470),
    ],
    razors: [
      razor("l48-rz1", 328, 362, 36, "y", 68, 0.50, 0.0),
      razor("l48-rz2", 582, 308, 36, "x", 92, 0.46, 0.8),
      razor("l48-rz3", 862, 346, 36, "y", 72, 0.52, 1.6),
      razor("l48-rz4", 1134, 292, 36, "x", 86, 0.48, 0.3),
      razor("l48-rz5", 1408, 244, 36, "y", 64, 0.54, 1.2),
    ],
    bugReport: report("l48-bug", 1266, 292, "Razor throughput doubled unilaterally"),
    bounds: WORLD_WIDE,
    background: "#081520",
  },

  {
    id: 49,
    patchId: 49,
    title: "Patch 5.8",
    chapter: "production_floor",
    modifier: "production_finale",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 178, w: 38, h: 62, fee: 5 },
    challenge: { type: "master", label: "Master patch: all coins and under par.", parTime: 58 },
    platforms: [
      ground("l49-ground"),
      conveyor("l49-belt1", 132, 442, 168, 110),
      platform("l49-a", 336, 394, 112),
      platform("l49-b", 520, 336, 112),
      conveyor("l49-belt2", 694, 384, 152, -106),
      platform("l49-c", 892, 258, 120),
    ],
    coins: [
      coin("l49-c1", 194, 408), coin("l49-c2", 390, 360),
      coin("l49-c3", 576, 302), coin("l49-c4", 754, 350),
      coin("l49-c5", 950, 224), coin("l49-c6", 852, 470),
      coin("l49-c7", 118, 470),
    ],
    spikes: [spike("l49-s1", 312, 470), spike("l49-s2", 664, 470)],
    laserGates: [laserGate("l49-lg1", 456, 252, 24, 248, 0.2)],
    sweepLasers: [sweepLaser("l49-sw1", 700, 196, 170, 14, "y", 84, 0.36, 1.0)],
    razors: [razor("l49-rz1", 618, 362, 36, "x", 74, 0.44, 0.6)],
    crushers: [crusher("l49-cr1", 870, 140, 50, 118, "y", 96, 0.46, 1.8)],
    jumpPads: [jumpPad("l49-jp1", 296, 484, 54, 16, 700)],
    bugReport: report("l49-bug", 576, 302, "Pre-finale confidence was premature"),
    bounds: WORLD,
    background: "#0a1322",
  },

  {
    id: 50,
    patchId: 50,
    title: "Patch 5.9",
    chapter: "production_floor",
    modifier: "production_finale",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 172, w: 38, h: 62, fee: 7 },
    challenge: { type: "master", label: "Master patch: all coins and under par.", parTime: 86 },
    platforms: [
      { id: "l50-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      conveyor("l50-belt1", 128, 442, 178, 112),
      platform("l50-a", 352, 396, 116),
      asyncPlatform("l50-b", 548, 346, 116, 22, 0.2),
      conveyor("l50-belt2", 750, 394, 162, -110),
      platform("l50-c", 980, 342, 116),
      platform("l50-d", 1200, 294, 116),
      conveyor("l50-belt3", 1420, 340, 162, 108),
      platform("l50-e", 1656, 248, 116),
      platform("l50-f", 1744, 210, 160),
    ],
    coins: [
      coin("l50-c1", 196, 408), coin("l50-c2", 408, 362),
      coin("l50-c3", 604, 312), coin("l50-c4", 818, 360),
      coin("l50-c5", 1038, 308), coin("l50-c6", 1258, 260),
      coin("l50-c7", 1476, 306), coin("l50-c8", 1826, 176),
      coin("l50-c9", 870, 470), coin("l50-c10", 118, 470),
    ],
    spikes: [
      spike("l50-s1", 316, 470), spike("l50-s2", 720, 470),
      spike("l50-s3", 1110, 470), spike("l50-s4", 1600, 470),
    ],
    laserGates: [
      laserGate("l50-lg1", 488, 258, 24, 242, 0.2),
      laserGate("l50-lg2", 1098, 260, 24, 240, 1.1),
    ],
    sweepLasers: [sweepLaser("l50-sw1", 880, 224, 200, 14, "y", 100, 0.34, 0.7)],
    razors: [
      razor("l50-rz1", 666, 368, 36, "x", 80, 0.44, 1.5),
      razor("l50-rz2", 1430, 308, 36, "y", 76, 0.48, 0.3),
    ],
    crushers: [crusher("l50-cr1", 1202, 140, 54, 128, "y", 108, 0.44, 0.8)],
    plasmaVents: [
      vent("l50-v1", 302, 492, 62, 8, "up", 172, 1.2),
      vent("l50-v2", 1614, 492, 62, 8, "up", 196, 0.5),
    ],
    jumpPads: [jumpPad("l50-jp1", 310, 484, 54, 16, 700), jumpPad("l50-jp2", 968, 484, 54, 16, 700)],
    bugReport: report("l50-bug", 1038, 308, "5.x branch declared complete. Prematurely."),
    bounds: WORLD_WIDE,
    background: "#090e1e",
  },

  {
    id: 51,
    patchId: 51,
    title: "Patch 6.0",
    chapter: "production_floor",
    modifier: "security_lasers",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 168, w: 38, h: 62 },
    challenge: { type: "par_time", label: "Clear the full laser grid under par.", parTime: 38 },
    platforms: [
      ground("l51-ground"),
      platform("l51-a", 132, 426, 116),
      platform("l51-b", 308, 366, 116),
      platform("l51-c", 486, 304, 116),
      platform("l51-d", 672, 248, 116),
      platform("l51-e", 766, 200, 136),
    ],
    coins: [
      coin("l51-c1", 188, 392), coin("l51-c2", 364, 332),
      coin("l51-c3", 542, 270), coin("l51-c4", 728, 214),
      coin("l51-c5", 836, 166),
    ],
    spikes: [spike("l51-s1", 268, 470), spike("l51-s2", 450, 470), spike("l51-s3", 636, 470), spike("l51-s4", 830, 470)],
    laserGates: [
      laserGate("l51-lg1", 240, 298, 24, 202, 0.0),
      laserGate("l51-lg2", 424, 238, 24, 262, 0.7),
      laserGate("l51-lg3", 610, 182, 24, 318, 1.4),
      laserGate("l51-lg4", 754, 148, 24, 352, 2.1),
    ],
    teslaArcs: [
      tesla("l51-t1", 324, 366, 324, 500, 0.3),
      tesla("l51-t2", 508, 304, 508, 500, 1.1),
    ],
    bugReport: report("l51-bug", 542, 270, "6.0 shipped without reading 5.x notes"),
    bounds: WORLD,
    background: "#071a26",
  },

  {
    id: 52,
    patchId: 52,
    title: "Patch 6.1",
    chapter: "production_floor",
    modifier: "crusher_panels",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 878, y: 168, w: 38, h: 62 },
    challenge: { type: "no_double_jump", label: "Ship without using the double jump." },
    platforms: [
      ground("l52-ground"),
      platform("l52-a", 132, 424, 116),
      platform("l52-b", 306, 360, 116),
      asyncPlatform("l52-c", 486, 298, 116, 22, 0.4),
      platform("l52-d", 672, 240, 116),
      platform("l52-e", 768, 196, 136),
    ],
    coins: [
      coin("l52-c1", 188, 390), coin("l52-c2", 362, 326),
      coin("l52-c3", 542, 264), coin("l52-c4", 728, 206),
      coin("l52-c5", 836, 162),
    ],
    spikes: [spike("l52-s1", 264, 470), spike("l52-s2", 448, 470), spike("l52-s3", 636, 470), spike("l52-s4", 832, 470)],
    crushers: [
      crusher("l52-cr1", 264, 176, 50, 128, "y", 110, 0.44, 0.0),
      crusher("l52-cr2", 448, 154, 50, 144, "y", 122, 0.46, 0.9),
      crusher("l52-cr3", 636, 136, 50, 158, "y", 138, 0.42, 1.8),
      crusher("l52-cr4", 824, 126, 50, 168, "y", 148, 0.44, 0.5),
    ],
    sweepLasers: [sweepLaser("l52-sw1", 480, 182, 240, 14, "y", 94, 0.34, 1.3)],
    bugReport: report("l52-bug", 542, 264, "Crusher approved async scheduling"),
    bounds: WORLD,
    background: "#0f1320",
  },

  {
    id: 53,
    patchId: 53,
    title: "Patch 6.2",
    chapter: "production_floor",
    modifier: "plasma_vents",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 186, w: 38, h: 62 },
    challenge: { type: "all_coins", label: "Collect every coin across the vent field." },
    platforms: [
      { id: "l53-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      platform("l53-a", 148, 428, 116),
      platform("l53-b", 400, 376, 116),
      platform("l53-c", 680, 322, 116),
      asyncPlatform("l53-d", 970, 370, 116, 22, 0.6),
      platform("l53-e", 1240, 318, 116),
      platform("l53-f", 1530, 270, 116),
      platform("l53-g", 1706, 220, 190),
    ],
    coins: [
      coin("l53-c1", 204, 394), coin("l53-c2", 456, 342),
      coin("l53-c3", 736, 288), coin("l53-c4", 1026, 336),
      coin("l53-c5", 1296, 284), coin("l53-c6", 1586, 236),
      coin("l53-c7", 1800, 186),
    ],
    spikes: [
      spike("l53-s1", 312, 470), spike("l53-s2", 582, 470),
      spike("l53-s3", 876, 470), spike("l53-s4", 1148, 470),
      spike("l53-s5", 1444, 470),
    ],
    plasmaVents: [
      vent("l53-v1", 254, 492, 62, 8, "up", 210, 0.0),
      vent("l53-v2", 518, 492, 62, 8, "up", 230, 0.8),
      vent("l53-v3", 808, 492, 62, 8, "up", 250, 1.6),
      vent("l53-v4", 1084, 492, 62, 8, "up", 240, 0.4),
      vent("l53-v5", 1378, 492, 62, 8, "up", 260, 1.2),
    ],
    razors: [
      razor("l53-rz1", 594, 298, 36, "x", 80, 0.48, 0.5),
      razor("l53-rz2", 1150, 290, 36, "y", 74, 0.52, 1.3),
    ],
    bugReport: report("l53-bug", 1026, 336, "Vent pressure cleared backlog"),
    bounds: WORLD_WIDE,
    background: "#071621",
  },

  {
    id: 54,
    patchId: 54,
    title: "Patch 6.3",
    chapter: "production_floor",
    modifier: "production_finale",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 158, w: 38, h: 62, fee: 8 },
    challenge: { type: "master", label: "Master patch: all coins and under par.", parTime: 92 },
    platforms: [
      { id: "l54-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      conveyor("l54-belt1", 128, 440, 178, 112),
      platform("l54-a", 352, 392, 116),
      asyncPlatform("l54-b", 550, 336, 116, 22, 0.15),
      platform("l54-c", 758, 282, 116),
      conveyor("l54-belt2", 960, 330, 162, -110),
      platform("l54-d", 1196, 278, 116),
      asyncPlatform("l54-e", 1390, 226, 116, 22, 0.85),
      platform("l54-f", 1620, 194, 116),
      platform("l54-g", 1714, 170, 190),
    ],
    coins: [
      coin("l54-c1", 196, 406), coin("l54-c2", 408, 358),
      coin("l54-c3", 606, 302), coin("l54-c4", 814, 248),
      coin("l54-c5", 1018, 296), coin("l54-c6", 1252, 244),
      coin("l54-c7", 1446, 192), coin("l54-c8", 1808, 136),
      coin("l54-c9", 880, 470), coin("l54-c10", 118, 470),
    ],
    spikes: [
      spike("l54-s1", 318, 470), spike("l54-s2", 730, 470),
      spike("l54-s3", 1110, 470), spike("l54-s4", 1598, 470),
    ],
    laserGates: [
      laserGate("l54-lg1", 492, 246, 24, 254, 0.15),
      laserGate("l54-lg2", 1120, 242, 24, 258, 1.05),
    ],
    sweepLasers: [sweepLaser("l54-sw1", 882, 206, 204, 14, "y", 106, 0.34, 0.6)],
    razors: [
      razor("l54-rz1", 668, 260, 38, "y", 78, 0.46, 0.9),
      razor("l54-rz2", 1406, 202, 38, "x", 86, 0.50, 1.7),
    ],
    crushers: [crusher("l54-cr1", 1208, 128, 56, 130, "y", 112, 0.46, 0.3)],
    plasmaVents: [
      vent("l54-v1", 308, 492, 62, 8, "up", 188, 1.1),
      vent("l54-v2", 1624, 492, 62, 8, "up", 210, 0.4),
    ],
    teslaArcs: [
      tesla("l54-t1", 344, 392, 344, 500, 0.5),
      tesla("l54-t2", 966, 330, 966, 500, 1.4),
    ],
    jumpPads: [jumpPad("l54-jp1", 318, 484, 54, 16, 700), jumpPad("l54-jp2", 978, 484, 54, 16, 700)],
    sensors: [sensor("l54-sn1", 544, 272, 80, 88, 3)],
    doors: [door("l54-ld1", 790, 254, 30, 246, { linkedToLockdown: true })],
    bugReport: report("l54-bug", 814, 248, "6.3 introduced all known hazards simultaneously"),
    bounds: WORLD_WIDE,
    background: "#080d1a",
  },

  {
    id: 55,
    patchId: 55,
    title: "Patch 6.4",
    chapter: "production_floor",
    modifier: "production_finale",
    gravity: "down",
    start: { x: 54, y: 458, w: 28, h: 34 },
    exit: { x: 1856, y: 136, w: 38, h: 62, fee: 10 },
    challenge: { type: "master", label: "True finale: all coins, no deaths, under par.", parTime: 98 },
    platforms: [
      { id: "l55-ground", kind: "solid", x: 0, y: 500, w: 1920, h: 40 },
      conveyor("l55-belt1", 128, 438, 186, 114),
      platform("l55-a", 358, 388, 116),
      asyncPlatform("l55-b", 556, 330, 116, 22, 0.2),
      conveyor("l55-belt2", 758, 376, 168, -112),
      platform("l55-c", 998, 322, 116),
      asyncPlatform("l55-d", 1200, 268, 116, 22, 1.0),
      conveyor("l55-belt3", 1408, 314, 166, 110),
      platform("l55-e", 1648, 232, 116),
      platform("l55-f", 1744, 178, 160),
    ],
    coins: [
      coin("l55-c1", 198, 404), coin("l55-c2", 414, 354),
      coin("l55-c3", 612, 296), coin("l55-c4", 828, 342),
      coin("l55-c5", 1054, 288), coin("l55-c6", 1256, 234),
      coin("l55-c7", 1480, 280), coin("l55-c8", 1824, 144),
      coin("l55-c9", 880, 470), coin("l55-c10", 118, 470),
      coin("l55-c11", 500, 470),
    ],
    spikes: [
      spike("l55-s1", 322, 470), spike("l55-s2", 730, 470),
      spike("l55-s3", 1120, 470), spike("l55-s4", 1614, 470),
    ],
    laserGates: [
      laserGate("l55-lg1", 494, 240, 24, 260, 0.1),
      laserGate("l55-lg2", 1128, 234, 24, 266, 1.0),
      laserGate("l55-lg3", 1634, 200, 24, 300, 1.8),
    ],
    sweepLasers: [
      sweepLaser("l55-sw1", 888, 200, 210, 14, "y", 110, 0.34, 0.6),
      sweepLaser("l55-sw2", 1420, 186, 14, 250, "x", 96, 0.32, 1.5),
    ],
    razors: [
      razor("l55-rz1", 672, 354, 38, "x", 82, 0.46, 1.5),
      razor("l55-rz2", 1140, 298, 38, "y", 76, 0.50, 0.3),
      razor("l55-rz3", 1660, 208, 38, "x", 88, 0.44, 1.1),
    ],
    crushers: [
      crusher("l55-cr1", 1214, 120, 56, 134, "y", 116, 0.46, 0.7),
      crusher("l55-cr2", 1644, 100, 54, 150, "y", 128, 0.42, 1.6),
    ],
    plasmaVents: [
      vent("l55-v1", 310, 492, 62, 8, "up", 196, 1.0),
      vent("l55-v2", 1430, 492, 62, 8, "up", 218, 0.3),
    ],
    teslaArcs: [
      tesla("l55-t1", 348, 388, 348, 500, 0.4),
      tesla("l55-t2", 972, 322, 972, 500, 1.3),
      tesla("l55-t3", 1624, 232, 1624, 500, 0.8),
    ],
    sensors: [
      sensor("l55-sn1", 550, 262, 80, 92, 3),
      sensor("l55-sn2", 1196, 210, 80, 88, 3),
    ],
    doors: [
      door("l55-ld1", 798, 248, 30, 252, { linkedToLockdown: true }),
      door("l55-ld2", 1456, 194, 30, 306, { linkedToLockdown: true }),
    ],
    jumpPads: [
      jumpPad("l55-jp1", 320, 484, 54, 16, 700),
      jumpPad("l55-jp2", 980, 484, 54, 16, 700),
      jumpPad("l55-jp3", 1428, 484, 54, 16, 700),
    ],
    tokens: [token("l55-r1", 118, 412, 3.2), token("l55-r2", 880, 482, 3.0)],
    bugReport: report("l55-bug", 1054, 288, "Final patch. Probably."),
    bounds: WORLD_WIDE,
    background: "#060a16",
  },
];

export function cloneLevel(definition: LevelDefinition): LevelDefinition {
  return structuredClone(definition);
}
