import type { PatchModifier } from "../shared/run";
import type { Rect } from "./physics";

export type PlatformKind = "solid" | "crumbling" | "async";
export type GravityMode = "down" | "right";

export interface Platform extends Rect {
  id: string;
  kind: PlatformKind;
  breakAfter?: number;
  on?: number;
  off?: number;
  phase?: number;
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
    start: { x: 52, y: 70, w: 28, h: 34 },
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
      coin("l6-c6", 92, 470),
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
      coin("lf-c7", 92, 470),
    ],
    spikes: [spike("lf-s1", 280, 470), spike("lf-s2", 462, 470), spike("lf-s3", 622, 470), spike("lf-s4", 790, 470)],
    tokens: [token("lf-r1", 454, 316, 4.2)],
    gates: [{ x: 744, y: 320, w: 28, h: 180 }],
    bugReport: report("lf-bug", 858, 214, "Stable release includes all previous incidents"),
    bounds: WORLD,
    background: "#331a34",
  },
];

export function cloneLevel(definition: LevelDefinition): LevelDefinition {
  return structuredClone(definition);
}
