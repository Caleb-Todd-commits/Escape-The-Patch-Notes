import type { PatchModifier } from "../shared/run";
import type { Rect } from "./physics";

export type PlatformKind = "solid" | "crumbling" | "async" | "moving";
export type GravityMode = "down" | "right";

export interface Platform extends Rect {
  id: string;
  kind: PlatformKind;
  breakAfter?: number;
  on?: number;
  off?: number;
  phase?: number;
  moveRange?: number;
  moveSpeed?: number;
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

export interface LevelDefinition {
  id: number;
  patchId: number;
  title: string;
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
    exit: { x: 878, y: 438, w: 38, h: 62 },
    platforms: [
      ground("l7-ground"),
      platform("l7-a", 178, 430, 132),
      platform("l7-b", 400, 382, 150),
      platform("l7-c", 670, 430, 120),
    ],
    coins: [coin("l7-c1", 232, 398), coin("l7-c2", 468, 350), coin("l7-c3", 716, 398)],
    spikes: [spike("l7-s1", 336, 470), spike("l7-s2", 588, 470), spike("l7-s3", 818, 470)],
    bugReport: report("l7-bug", 468, 346, "Stop button converted to suggestion"),
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
    exit: { x: 870, y: 40, w: 38, h: 62 },
    platforms: [
      { id: "l13-ground", kind: "solid", x: 0, y: 1060, w: 960, h: 40 },
      platform("l13-01", 150, 1010, 120),
      platform("l13-02", 680,  940, 120),
      platform("l13-03", 280,  870, 130),
      platform("l13-04", 660,  800, 120),
      platform("l13-05", 160,  730, 120),
      platform("l13-06", 710,  660, 120),
      platform("l13-07", 310,  590, 130),
      platform("l13-08", 640,  520, 120),
      platform("l13-09", 160,  450, 120),
      platform("l13-10", 700,  380, 120),
      platform("l13-11", 290,  310, 130),
      platform("l13-12", 650,  240, 120),
      platform("l13-13", 170,  170, 120),
      platform("l13-14", 700,  100, 120),
    ],
    coins: [
      coin("l13-c1", 210, 976), coin("l13-c2", 728, 766),
      coin("l13-c3", 354, 556), coin("l13-c4", 688, 346),
      coin("l13-c5", 228, 136),
    ],
    spikes: [
      spike("l13-s1", 450, 1050), spike("l13-s2", 820, 910),
      spike("l13-s3", 440, 840), spike("l13-s4", 850, 490),
    ],
    bugReport: report("l13-bug", 700, 380, "Vertical scope creep detected"),
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
    wind: -740,
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
    exit: { x: 870, y: 42, w: 38, h: 62 },
    platforms: [
      { id: "l22-ground", kind: "solid", x: 0, y: 1060, w: 960, h: 40 },
      platform("l22-01", 148, 1010, 120),
      platform("l22-02", 620,  950, 126),
      platform("l22-03", 290,  876, 126),
      platform("l22-04", 682,  810, 126),
      platform("l22-05", 160,  740, 126),
      platform("l22-06", 612,  670, 126),
      platform("l22-07", 276,  594, 126),
      platform("l22-08", 680,  520, 126),
      platform("l22-09", 188,  450, 126),
      platform("l22-10", 652,  380, 126),
      platform("l22-11", 300,  308, 126),
      platform("l22-12", 666,  236, 126),
      platform("l22-13", 186,  166, 126),
      platform("l22-14", 716,   98, 126),
    ],
    coins: [
      coin("l22-c1", 204, 976), coin("l22-c2", 674, 916),
      coin("l22-c3", 356, 842), coin("l22-c4", 742, 776),
      coin("l22-c5", 214, 706), coin("l22-c6", 742, 486),
      coin("l22-c7", 246, 132),
    ],
    spikes: [
      spike("l22-s1", 430, 1050), spike("l22-s2", 800, 920),
      spike("l22-s3", 488, 842), spike("l22-s4", 836, 632),
      spike("l22-s5", 458, 352),
    ],
    bugReport: report("l22-bug", 742, 486, "Org chart climb required"),
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
    wind: -640,
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
    exit: { x: 878, y: 438, w: 38, h: 62 },
    platforms: [
      ground("l29-ground"),
      platform("l29-a", 170, 432, 126),
      platform("l29-b", 402, 382, 138),
      platform("l29-c", 650, 432, 126),
      platform("l29-d", 790, 370, 116),
    ],
    coins: [
      coin("l29-c1", 226, 398), coin("l29-c2", 462, 348),
      coin("l29-c3", 708, 398), coin("l29-c4", 838, 336),
    ],
    spikes: [spike("l29-s1", 326, 470), spike("l29-s2", 578, 470), spike("l29-s3", 808, 470)],
    bugReport: report("l29-bug", 462, 350, "Stopping deferred to next sprint"),
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
];

export function cloneLevel(definition: LevelDefinition): LevelDefinition {
  return structuredClone(definition);
}
