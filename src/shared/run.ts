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

export const canonicalPatches: Array<Omit<LevelPatch, "headline" | "note" | "joke" | "severity">> = [
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
];

const fallbackCopy: Array<Pick<LevelPatch, "headline" | "note" | "joke" | "severity">> = [
  {
    headline: "Everything works",
    note: "The release manager smiles. That cannot last.",
    joke: "Known issue: optimism detected.",
    severity: "stable",
  },
  {
    headline: "Jump height reduced for balance",
    note: "Vertical ambition has been identified as an exploit.",
    joke: "Please keep all dreams closer to the ground.",
    severity: "minor",
  },
  {
    headline: "Coins now attract spikes",
    note: "The economy is finally working as designed.",
    joke: "Every purchase now includes consequences.",
    severity: "major",
  },
  {
    headline: "Gravity rotated 90 degrees",
    note: "Players requested a fresh perspective. Legal approved this wording.",
    joke: "Side effects may include sideways effects.",
    severity: "critical",
  },
  {
    headline: "Platforms now have durability",
    note: "Standing still is no longer part of the core fantasy.",
    joke: "The floor has started enforcing deadlines.",
    severity: "major",
  },
  {
    headline: "The exit now charges a processing fee",
    note: "A tiny toll has been added for your convenience.",
    joke: "Convenience fees remain deeply convenient for the exit.",
    severity: "minor",
  },
  {
    headline: "Friction removed for performance",
    note: "Stopping was taking measurable CPU time.",
    joke: "Momentum is now a stakeholder.",
    severity: "major",
  },
  {
    headline: "Builds are now asynchronous",
    note: "Some platforms may resolve later. Or earlier. Mostly later.",
    joke: "Await platform; regret platform.",
    severity: "critical",
  },
  {
    headline: "Rollback button added",
    note: "It works briefly, which is technically a feature.",
    joke: "The old bug misses you too.",
    severity: "rollback",
  },
  {
    headline: "Exit relocated under load",
    note: "The destination is elastic during peak traffic.",
    joke: "If the exit moves, ship faster.",
    severity: "critical",
  },
  {
    headline: "Everything is stable now",
    note: "All previous fixes have been reintroduced in one confidence-building bundle.",
    joke: "Stability has been defined as all errors happening together.",
    severity: "critical",
  },
  {
    headline: "Map boundary expanded",
    note: "The level footprint now exceeds the original specification. Scroll to explore.",
    joke: "Out of viewport, out of mind.",
    severity: "minor",
  },
  {
    headline: "Vertical scope approved",
    note: "Progress now requires upward mobility. The exit has been promoted.",
    joke: "What goes up has not been nerfed. Yet.",
    severity: "major",
  },
  {
    headline: "Platforms migrated to async delivery",
    note: "Infrastructure components are now in transit. Timing is a feature.",
    joke: "Stand still and the floor leaves you.",
    severity: "major",
  },
  {
    headline: "Lateral air resistance enabled",
    note: "A persistent headwind has been introduced to reduce leftward throughput.",
    joke: "The wind is not a bug. It is a stakeholder.",
    severity: "critical",
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
        required: ["headline", "note", "joke", "severity"],
        properties: {
          headline: { type: "string", minLength: 4, maxLength: 54 },
          note: { type: "string", minLength: 8, maxLength: 120 },
          joke: { type: "string", minLength: 8, maxLength: 90 },
          severity: { type: "string", enum: ["stable", "minor", "major", "critical", "rollback"] },
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
