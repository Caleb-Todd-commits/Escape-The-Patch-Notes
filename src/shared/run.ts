export const patchModifiers = [
  "base",
  "jump_nerf",
  "coin_spike_magnet",
  "rotated_gravity",
  "crumbling_platforms",
  "exit_fee",
  "slippery_floor",
  "async_platforms",
  "rollback_token",
  "moving_exit",
  "finale_combo",
  "wide_world",
  "tall_world",
  "moving_platforms_h",
  "headwind",
] as const;

export type PatchModifier = (typeof patchModifiers)[number];

export type PatchSeverity = "stable" | "minor" | "major" | "critical" | "rollback";

export type RunSource = "openai" | "fallback";

export interface LevelPatch {
  levelId: number;
  version: string;
  modifier: PatchModifier;
  headline: string;
  note: string;
  joke: string;
  severity: PatchSeverity;
  targetTime: number;
  devLines: string[];
}

export interface PatchRun {
  runId: string;
  seed: string;
  source: RunSource;
  difficulty: "normal" | "chaos";
  buildName: string;
  levels: LevelPatch[];
  finale: {
    headline: string;
    note: string;
  };
  recapPrompts: string[];
  gameOverSummary: string;
}

export const canonicalPatches: Array<Omit<LevelPatch, "headline" | "note" | "joke" | "severity" | "devLines">> = [
  { levelId: 1, version: "1.0", modifier: "base", targetTime: 24 },
  { levelId: 2, version: "1.1", modifier: "jump_nerf", targetTime: 30 },
  { levelId: 3, version: "1.2", modifier: "coin_spike_magnet", targetTime: 34 },
  { levelId: 4, version: "1.3", modifier: "rotated_gravity", targetTime: 42 },
  { levelId: 5, version: "1.4", modifier: "crumbling_platforms", targetTime: 38 },
  { levelId: 6, version: "1.5", modifier: "exit_fee", targetTime: 40 },
  { levelId: 7, version: "1.6", modifier: "slippery_floor", targetTime: 34 },
  { levelId: 8, version: "1.7", modifier: "async_platforms", targetTime: 44 },
  { levelId: 9, version: "1.8", modifier: "rollback_token", targetTime: 44 },
  { levelId: 10, version: "1.9", modifier: "moving_exit", targetTime: 46 },
  { levelId: 11, version: "2.0", modifier: "finale_combo", targetTime: 70 },
  { levelId: 12, version: "2.1", modifier: "wide_world", targetTime: 56 },
  { levelId: 13, version: "2.2", modifier: "tall_world", targetTime: 70 },
  { levelId: 14, version: "2.3", modifier: "moving_platforms_h", targetTime: 62 },
  { levelId: 15, version: "2.4", modifier: "headwind", targetTime: 46 },
  { levelId: 16, version: "2.5", modifier: "base", targetTime: 34 },
  { levelId: 17, version: "2.6", modifier: "jump_nerf", targetTime: 36 },
  { levelId: 18, version: "2.7", modifier: "coin_spike_magnet", targetTime: 40 },
  { levelId: 19, version: "2.8", modifier: "async_platforms", targetTime: 48 },
  { levelId: 20, version: "2.9", modifier: "moving_exit", targetTime: 50 },
  { levelId: 21, version: "3.0", modifier: "wide_world", targetTime: 74 },
  { levelId: 22, version: "3.1", modifier: "tall_world", targetTime: 84 },
  { levelId: 23, version: "3.2", modifier: "crumbling_platforms", targetTime: 62 },
  { levelId: 24, version: "3.3", modifier: "moving_platforms_h", targetTime: 68 },
  { levelId: 25, version: "3.4", modifier: "headwind", targetTime: 52 },
  { levelId: 26, version: "3.5", modifier: "rollback_token", targetTime: 58 },
  { levelId: 27, version: "3.6", modifier: "exit_fee", targetTime: 52 },
  { levelId: 28, version: "3.7", modifier: "rotated_gravity", targetTime: 58 },
  { levelId: 29, version: "3.8", modifier: "slippery_floor", targetTime: 46 },
  { levelId: 30, version: "3.9", modifier: "finale_combo", targetTime: 92 },
];

const fallbackCopy: Array<Pick<LevelPatch, "headline" | "note" | "joke" | "severity" | "devLines">> = [
  {
    headline: "Everything works",
    note: "The release manager smiles. That cannot last.",
    joke: "Known issue: optimism detected.",
    severity: "stable",
    devLines: ["Hey! Welcome to the release train. Collect coins, dodge spikes, reach the exit.", "Simple stuff. We'd never ship anything complicated. Anyway — here's Patch 1.0."],
  },
  {
    headline: "Jump height reduced for balance",
    note: "Vertical ambition has been identified as an exploit.",
    joke: "Please keep all dreams closer to the ground.",
    severity: "minor",
    devLines: ["So... playtesting flagged jumping as overpowered. We had to nerf it.", "Don't look at me like that. The platforms are still reachable. Probably."],
  },
  {
    headline: "Coins now attract spikes",
    note: "The economy is finally working as designed.",
    joke: "Every purchase now includes consequences.",
    severity: "major",
    devLines: ["Okay this one wasn't my idea. Revenue wanted coins to feel more 'engaging.'", "The spikes are just... very engaged. Good luck out there."],
  },
  {
    headline: "Gravity rotated 90 degrees",
    note: "Players requested a fresh perspective. Legal approved this wording.",
    joke: "Side effects may include sideways effects.",
    severity: "critical",
    devLines: ["Fresh perspective. That's what legal called it."],
  },
  {
    headline: "Platforms now have durability",
    note: "Standing still is no longer part of the core fantasy.",
    joke: "The floor has started enforcing deadlines.",
    severity: "major",
    devLines: ["The floor now has feelings. And a timer."],
  },
  {
    headline: "The exit now charges a processing fee",
    note: "A tiny toll has been added for your convenience.",
    joke: "Convenience fees remain deeply convenient for the exit.",
    severity: "minor",
    devLines: ["Monetization asked for one small change. It's fine."],
  },
  {
    headline: "Friction removed for performance",
    note: "Stopping was taking measurable CPU time.",
    joke: "Momentum is now a stakeholder.",
    severity: "major",
    devLines: ["Stopping is expensive. We cut it."],
  },
  {
    headline: "Builds are now asynchronous",
    note: "Some platforms may resolve later. Or earlier. Mostly later.",
    joke: "Await platform; regret platform.",
    severity: "critical",
    devLines: ["The platforms ship when they're ready."],
  },
  {
    headline: "Rollback button added",
    note: "It works briefly, which is technically a feature.",
    joke: "The old bug misses you too.",
    severity: "rollback",
    devLines: ["We added undo. It's temporary. Like most things."],
  },
  {
    headline: "Exit relocated under load",
    note: "The destination is elastic during peak traffic.",
    joke: "If the exit moves, ship faster.",
    severity: "critical",
    devLines: ["The exit is elastic now. Just... keep moving."],
  },
  {
    headline: "Everything is stable now",
    note: "All previous fixes have been reintroduced in one confidence-building bundle.",
    joke: "Stability has been defined as all errors happening together.",
    severity: "critical",
    devLines: ["We combined the fixes. All of them. At once."],
  },
  {
    headline: "Map boundary expanded",
    note: "The level footprint now exceeds the original specification. Scroll to explore.",
    joke: "Out of viewport, out of mind.",
    severity: "minor",
    devLines: ["Scope crept. The map is wider now."],
  },
  {
    headline: "Vertical scope approved",
    note: "Progress now requires upward mobility. The exit has been promoted.",
    joke: "What goes up has not been nerfed. Yet.",
    severity: "major",
    devLines: ["The exit got promoted. Several floors up."],
  },
  {
    headline: "Platforms migrated to async delivery",
    note: "Infrastructure components are now in transit. Timing is a feature.",
    joke: "Stand still and the floor leaves you.",
    severity: "major",
    devLines: ["Infrastructure is in motion. Stay light."],
  },
  {
    headline: "Lateral air resistance enabled",
    note: "A persistent headwind has been introduced to reduce leftward throughput.",
    joke: "The wind is not a bug. It is a stakeholder.",
    severity: "critical",
    devLines: ["The wind has a roadmap. You're not on it."],
  },
  {
    headline: "Support tickets now spawn platforms",
    note: "The escalation queue has created several convenient ledges.",
    joke: "Every ticket is load-bearing until closed.",
    severity: "minor",
    devLines: ["Good news: the backlog is structural now."],
  },
  {
    headline: "Jump height reduced again for consistency",
    note: "The previous nerf has been normalized across morale.",
    joke: "Small hops are now part of the brand.",
    severity: "major",
    devLines: ["Second nerf. For consistency."],
  },
  {
    headline: "Coin telemetry linked to hazards",
    note: "Revenue signals now notify nearby spikes with enthusiasm.",
    joke: "Analytics finally became actionable.",
    severity: "critical",
    devLines: ["Analytics are fully actionable now. Very actionable."],
  },
  {
    headline: "Platforms now honor async standups",
    note: "Some ledges may briefly disappear to provide status updates.",
    joke: "The floor is in another meeting.",
    severity: "major",
    devLines: ["Some platforms are currently in standup."],
  },
  {
    headline: "Exit now load-balances itself",
    note: "The destination may relocate to improve throughput optics.",
    joke: "Try not to optimize against the door.",
    severity: "critical",
    devLines: ["The exit optimizes itself. Stay flexible."],
  },
  {
    headline: "World width doubled for enterprise",
    note: "The release train now includes scenic horizontal sprawl.",
    joke: "Scope creep has a parallax layer.",
    severity: "major",
    devLines: ["Enterprise tier. Twice as wide."],
  },
  {
    headline: "Vertical integration completed",
    note: "The exit has been promoted several floors above reason.",
    joke: "Climb the org chart carefully.",
    severity: "major",
    devLines: ["The org chart goes up. So does the exit."],
  },
  {
    headline: "Platform lifetime budgets enforced",
    note: "Standing still now spends infrastructure credits.",
    joke: "The floor passed a cost review.",
    severity: "critical",
    devLines: ["Idle platforms cost money. Keep moving."],
  },
  {
    headline: "Moving platforms adopted agile delivery",
    note: "The route still exists, but its sprint velocity has opinions.",
    joke: "Please align with the ledge roadmap.",
    severity: "major",
    devLines: ["The platforms are agile now. Match their velocity."],
  },
  {
    headline: "Wind tunnel added for performance testing",
    note: "The environment now pushes back against confident movement.",
    joke: "Resistance is measurable and billable.",
    severity: "major",
    devLines: ["The second wind tunnel. Stronger this time."],
  },
  {
    headline: "Rollback tokens require deliberate trust",
    note: "Temporary safety is available, but only if you grab it first.",
    joke: "The undo button has a cooldown and a lawyer.",
    severity: "rollback",
    devLines: ["Undo is back. Grab it before you need it."],
  },
  {
    headline: "Exit fee adjusted for premium routing",
    note: "The door accepts coins, apologies, and very little feedback.",
    joke: "Shipping is free. Arriving costs extra.",
    severity: "minor",
    devLines: ["Premium door. Collect enough coins."],
  },
  {
    headline: "Gravity rotation reissued",
    note: "The axis migration is back with cleaner paperwork.",
    joke: "Sideways remains technically forward.",
    severity: "critical",
    devLines: ["The axis migration is back. Cleaner paperwork this time."],
  },
  {
    headline: "Friction removed from the release notes",
    note: "Momentum is expected to resolve itself before launch.",
    joke: "Stopping is now a stretch goal.",
    severity: "major",
    devLines: ["No friction. Not in the game, not in the notes."],
  },
  {
    headline: "Final final stability bundle",
    note: "All known fixes have been combined into one persuasive incident.",
    joke: "Stable means every bug is reproducible.",
    severity: "critical",
    devLines: ["Everything. All at once. Final patch."],
  },
];

export const runJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["buildName", "levels", "finale", "recapPrompts", "gameOverSummary"],
  properties: {
    buildName: { type: "string", minLength: 3, maxLength: 36 },
    levels: {
      type: "array",
      minItems: canonicalPatches.length,
      maxItems: canonicalPatches.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "note", "joke", "severity", "devLines"],
        properties: {
          headline: { type: "string", minLength: 4, maxLength: 54 },
          note: { type: "string", minLength: 8, maxLength: 120 },
          joke: { type: "string", minLength: 8, maxLength: 90 },
          severity: { type: "string", enum: ["stable", "minor", "major", "critical", "rollback"] },
          devLines: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: { type: "string", minLength: 8, maxLength: 100 },
          },
        },
      },
    },
    finale: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "note"],
      properties: {
        headline: { type: "string", minLength: 4, maxLength: 60 },
        note: { type: "string", minLength: 8, maxLength: 150 },
      },
    },
    recapPrompts: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string", minLength: 8, maxLength: 90 },
    },
    gameOverSummary: { type: "string", minLength: 8, maxLength: 110 },
  },
} as const;

export function makeSeed(seed = ""): string {
  const trimmed = seed.trim();
  if (trimmed.length > 0) {
    return trimmed.slice(0, 32);
  }

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

export function createRunId(seed: string): string {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `patch-${(hash >>> 0).toString(36).padStart(6, "0")}`;
}

export function createFallbackRun(seedInput = "", difficulty: PatchRun["difficulty"] = "normal"): PatchRun {
  const seed = makeSeed(seedInput);

  return {
    runId: createRunId(seed),
    seed,
    source: "fallback",
    difficulty,
    buildName: "Midnight Hotfix",
    levels: canonicalPatches.map((patch, index) => ({
      ...patch,
      ...fallbackCopy[index],
    })),
    finale: {
      headline: "Release candidate declared emotionally stable",
      note: "The patch notes insist this is fine. The spikes have not commented.",
    },
    recapPrompts: [
      "Most expensive coin collected",
      "Most suspicious platform trusted",
      "Patch note that should have stayed in drafts",
    ],
    gameOverSummary: "The release failed locally, which means it is nearly ready for production.",
  };
}

export function sanitizeRun(
  candidate: unknown,
  seedInput = "",
  source: RunSource = "openai",
  difficulty: PatchRun["difficulty"] = "normal",
): PatchRun {
  const fallback = createFallbackRun(seedInput, difficulty);
  const data = isRecord(candidate) ? candidate : {};
  const levelsCandidate = Array.isArray(data.levels) ? data.levels : [];

  return {
    ...fallback,
    source,
    buildName: cleanText(data.buildName, fallback.buildName, 36),
    levels: canonicalPatches.map((patch, index) => {
      const fromAi = isRecord(levelsCandidate[index]) ? levelsCandidate[index] : {};
      const fallbackPatch = fallback.levels[index];

      return {
        ...patch,
        headline: cleanText(fromAi.headline, fallbackPatch.headline, 54),
        note: cleanText(fromAi.note, fallbackPatch.note, 120),
        joke: cleanText(fromAi.joke, fallbackPatch.joke, 90),
        severity: cleanSeverity(fromAi.severity, fallbackPatch.severity),
        devLines: cleanDevLines(fromAi.devLines, fallbackPatch.devLines),
      };
    }),
    finale: {
      headline: cleanText(getNested(data, "finale", "headline"), fallback.finale.headline, 60),
      note: cleanText(getNested(data, "finale", "note"), fallback.finale.note, 150),
    },
    recapPrompts: cleanPromptList(data.recapPrompts, fallback.recapPrompts),
    gameOverSummary: cleanText(data.gameOverSummary, fallback.gameOverSummary, 110),
  };
}

function cleanDevLines(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const lines = value.map((v) => cleanText(v, "", 100)).filter((v) => v.length >= 8).slice(0, 2);
  return lines.length >= 1 ? lines : fallback;
}

function cleanPromptList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const prompts = value
    .map((item) => cleanText(item, "", 90))
    .filter((item) => item.length >= 8)
    .slice(0, 5);

  return prompts.length >= 3 ? prompts : fallback;
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const stripped = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (stripped.length < 3) {
    return fallback;
  }

  return stripped.slice(0, maxLength);
}

function cleanSeverity(value: unknown, fallback: PatchSeverity): PatchSeverity {
  return value === "stable" ||
    value === "minor" ||
    value === "major" ||
    value === "critical" ||
    value === "rollback"
    ? value
    : fallback;
}

function getNested(value: Record<string, unknown>, key: string, nestedKey: string): unknown {
  const child = value[key];
  return isRecord(child) ? child[nestedKey] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
