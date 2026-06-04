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
  "production_intro",
  "security_lasers",
  "double_jump_unlock",
  "razor_rails",
  "sweep_lasers",
  "crusher_panels",
  "tesla_arcs",
  "security_sensors",
  "plasma_vents",
  "production_finale",
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
  deathLines: string[];
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

export const canonicalPatches: Array<Omit<LevelPatch, "headline" | "note" | "joke" | "severity" | "devLines" | "deathLines">> = [
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
  { levelId: 31, version: "4.0", modifier: "production_intro", targetTime: 44 },
  { levelId: 32, version: "4.1", modifier: "security_lasers", targetTime: 48 },
  { levelId: 33, version: "4.2", modifier: "double_jump_unlock", targetTime: 50 },
  { levelId: 34, version: "4.3", modifier: "razor_rails", targetTime: 54 },
  { levelId: 35, version: "4.4", modifier: "sweep_lasers", targetTime: 58 },
  { levelId: 36, version: "4.5", modifier: "crusher_panels", targetTime: 58 },
  { levelId: 37, version: "4.6", modifier: "tesla_arcs", targetTime: 56 },
  { levelId: 38, version: "4.7", modifier: "security_sensors", targetTime: 62 },
  { levelId: 39, version: "4.8", modifier: "plasma_vents", targetTime: 64 },
  { levelId: 40, version: "4.9", modifier: "production_finale", targetTime: 82 },
];

const fallbackCopy: Array<Pick<LevelPatch, "headline" | "note" | "joke" | "severity" | "devLines" | "deathLines">> = [
  {
    headline: "Everything works",
    note: "The release manager smiles. That cannot last.",
    joke: "Known issue: optimism detected.",
    severity: "stable",
    devLines: ["Hey! Welcome to the release train. Collect coins, dodge spikes, reach the exit.", "Simple stuff. We'd never ship anything complicated. Anyway — here's Patch 1.0."],
    deathLines: ["Look, spikes were in scope.", "That one's on me. Mostly.", "Unexpected behavior. Not a bug."],
  },
  {
    headline: "Jump height reduced for balance",
    note: "Vertical ambition has been identified as an exploit.",
    joke: "Please keep all dreams closer to the ground.",
    severity: "minor",
    devLines: ["So... playtesting flagged jumping as overpowered. We had to nerf it.", "Don't look at me like that. The platforms are still reachable. Probably."],
    deathLines: ["The nerf was a bit much. Sorry.", "Vertical ambition detected. Rejected.", "Platform was reachable in testing. Smaller tester."],
  },
  {
    headline: "Coins now attract spikes",
    note: "The economy is finally working as designed.",
    joke: "Every purchase now includes consequences.",
    severity: "major",
    devLines: ["Okay this one wasn't my idea. Revenue wanted coins to feel more 'engaging.'", "The spikes are just... very engaged. Good luck out there."],
    deathLines: ["Revenue called that a feature.", "The economy is working as designed.", "Coins now include terms and conditions."],
  },
  {
    headline: "Gravity rotated 90 degrees",
    note: "Players requested a fresh perspective. Legal approved this wording.",
    joke: "Side effects may include sideways effects.",
    severity: "critical",
    devLines: ["Fresh perspective. That's what legal called it."],
    deathLines: ["Down is a social construct.", "That wall was supposed to be a floor.", "Lateral tombstone. Efficient."],
  },
  {
    headline: "Platforms now have durability",
    note: "Standing still is no longer part of the core fantasy.",
    joke: "The floor has started enforcing deadlines.",
    severity: "major",
    devLines: ["The floor now has feelings. And a timer."],
    deathLines: ["Platform budget exceeded.", "You stood still. The floor had opinions.", "Time limit was a soft limit. Briefly."],
  },
  {
    headline: "The exit now charges a processing fee",
    note: "A tiny toll has been added for your convenience.",
    joke: "Convenience fees remain deeply convenient for the exit.",
    severity: "minor",
    devLines: ["Monetization asked for one small change. It's fine."],
    deathLines: ["Insufficient funds. Exit declined.", "You needed four more coins.", "Premium death. Technically billable."],
  },
  {
    headline: "Friction removed for performance",
    note: "Stopping was taking measurable CPU time.",
    joke: "Momentum is now a stakeholder.",
    severity: "major",
    devLines: ["Stopping is expensive. We cut it."],
    deathLines: ["Momentum carried you past the safe zone.", "Stopping was technically optional.", "Physics refactored. Results varied."],
  },
  {
    headline: "Builds are now asynchronous",
    note: "Some platforms may resolve later. Or earlier. Mostly later.",
    joke: "Await platform; regret platform.",
    severity: "critical",
    devLines: ["The platforms ship when they're ready."],
    deathLines: ["Platform was pending resolution.", "You arrived before the floor did.", "async/await, mostly await."],
  },
  {
    headline: "Rollback button added",
    note: "It works briefly, which is technically a feature.",
    joke: "The old bug misses you too.",
    severity: "rollback",
    devLines: ["We added undo. It's temporary. Like most things."],
    deathLines: ["Rollback window expired.", "Token collected too late.", "Undo had a cooldown. It still does."],
  },
  {
    headline: "Exit relocated under load",
    note: "The destination is elastic during peak traffic.",
    joke: "If the exit moves, ship faster.",
    severity: "critical",
    devLines: ["The exit is elastic now. Just... keep moving."],
    deathLines: ["The exit load-balanced away from you.", "Wrong exit. That one was deprecated.", "Destination moved mid-transit. Classic."],
  },
  {
    headline: "Everything is stable now",
    note: "All previous fixes have been reintroduced in one confidence-building bundle.",
    joke: "Stability has been defined as all errors happening together.",
    severity: "critical",
    devLines: ["We combined the fixes. All of them. At once."],
    deathLines: ["All previous bugs contributed equally.", "Stability incident. Fully reproducible.", "The bundle was confident. You were not."],
  },
  {
    headline: "Map boundary expanded",
    note: "The level footprint now exceeds the original specification. Scroll to explore.",
    joke: "Out of viewport, out of mind.",
    severity: "minor",
    devLines: ["Scope crept. The map is wider now."],
    deathLines: ["Fell off the expanded edge.", "The new area needed more QA.", "Out of viewport. Out of luck."],
  },
  {
    headline: "Vertical scope approved",
    note: "Progress now requires upward mobility. The exit has been promoted.",
    joke: "What goes up has not been nerfed. Yet.",
    severity: "major",
    devLines: ["The exit got promoted. Several floors up."],
    deathLines: ["Upward mobility denied.", "The org chart was steeper than advertised.", "Exit was promoted. You were not."],
  },
  {
    headline: "Platforms migrated to async delivery",
    note: "Infrastructure components are now in transit. Timing is a feature.",
    joke: "Stand still and the floor leaves you.",
    severity: "major",
    devLines: ["Infrastructure is in motion. Stay light."],
    deathLines: ["Platform resolved after impact.", "Infrastructure was in transit. So were you.", "Ledge arrived late. Apologies."],
  },
  {
    headline: "Lateral air resistance enabled",
    note: "A persistent headwind has been introduced to reduce leftward throughput.",
    joke: "The wind is not a bug. It is a stakeholder.",
    severity: "critical",
    devLines: ["The wind has a roadmap. You're not on it."],
    deathLines: ["Wind-assisted spike. Efficient.", "The headwind has KPIs.", "Blown into a hazard. As designed."],
  },
  {
    headline: "Support tickets now spawn platforms",
    note: "The escalation queue has created several convenient ledges.",
    joke: "Every ticket is load-bearing until closed.",
    severity: "minor",
    devLines: ["Good news: the backlog is structural now."],
    deathLines: ["Ticket closed. Platform removed.", "That ledge was a known issue.", "Support escalated too late."],
  },
  {
    headline: "Jump height reduced again for consistency",
    note: "The previous nerf has been normalized across morale.",
    joke: "Small hops are now part of the brand.",
    severity: "major",
    devLines: ["Second nerf. For consistency."],
    deathLines: ["Brand-consistent hop. Insufficient.", "Nerf applied retroactively.", "Consistent with previous failure."],
  },
  {
    headline: "Coin telemetry linked to hazards",
    note: "Revenue signals now notify nearby spikes with enthusiasm.",
    joke: "Analytics finally became actionable.",
    severity: "critical",
    devLines: ["Analytics are fully actionable now. Very actionable."],
    deathLines: ["Analytics notified the spike in time.", "Revenue signal received. Spike responded.", "Hazard was data-driven."],
  },
  {
    headline: "Platforms now honor async standups",
    note: "Some ledges may briefly disappear to provide status updates.",
    joke: "The floor is in another meeting.",
    severity: "major",
    devLines: ["Some platforms are currently in standup."],
    deathLines: ["Platform was in standup.", "Floor had a conflict. Reschedule.", "Ledge gave its update. Then left."],
  },
  {
    headline: "Exit now load-balances itself",
    note: "The destination may relocate to improve throughput optics.",
    joke: "Try not to optimize against the door.",
    severity: "critical",
    devLines: ["The exit optimizes itself. Stay flexible."],
    deathLines: ["Exit routed you to a spike.", "Load balancer selected suboptimal destination.", "The door had better options."],
  },
  {
    headline: "World width doubled for enterprise",
    note: "The release train now includes scenic horizontal sprawl.",
    joke: "Scope creep has a parallax layer.",
    severity: "major",
    devLines: ["Enterprise tier. Twice as wide."],
    deathLines: ["Fell off the enterprise edge.", "Scope crept into a hazard.", "Wide world. Narrow survival window."],
  },
  {
    headline: "Vertical integration completed",
    note: "The exit has been promoted several floors above reason.",
    joke: "Climb the org chart carefully.",
    severity: "major",
    devLines: ["The org chart goes up. So does the exit."],
    deathLines: ["Org chart climb failed.", "Vertical integration rejected your application.", "Floor denied the promotion."],
  },
  {
    headline: "Platform lifetime budgets enforced",
    note: "Standing still now spends infrastructure credits.",
    joke: "The floor passed a cost review.",
    severity: "critical",
    devLines: ["Idle platforms cost money. Keep moving."],
    deathLines: ["Credit exhausted. Platform deprecated.", "Stood still too long. Invoiced.", "Cost review concluded mid-jump."],
  },
  {
    headline: "Moving platforms adopted agile delivery",
    note: "The route still exists, but its sprint velocity has opinions.",
    joke: "Please align with the ledge roadmap.",
    severity: "major",
    devLines: ["The platforms are agile now. Match their velocity."],
    deathLines: ["Missed the sprint.", "Platform velocity exceeded alignment.", "Ledge shipped without you."],
  },
  {
    headline: "Wind tunnel added for performance testing",
    note: "The environment now pushes back against confident movement.",
    joke: "Resistance is measurable and billable.",
    severity: "major",
    devLines: ["The second wind tunnel. Stronger this time."],
    deathLines: ["Performance test: failed.", "Wind resistance billed to the player.", "Confidence was the exploit."],
  },
  {
    headline: "Rollback tokens require deliberate trust",
    note: "Temporary safety is available, but only if you grab it first.",
    joke: "The undo button has a cooldown and a lawyer.",
    severity: "rollback",
    devLines: ["Undo is back. Grab it before you need it."],
    deathLines: ["Token not collected. Condolences.", "Rollback declined. Terms not accepted.", "Safety was available. Briefly."],
  },
  {
    headline: "Exit fee adjusted for premium routing",
    note: "The door accepts coins, apologies, and very little feedback.",
    joke: "Shipping is free. Arriving costs extra.",
    severity: "minor",
    devLines: ["Premium door. Collect enough coins."],
    deathLines: ["Insufficient coins. Door remained closed.", "Premium exit. Budget death.", "Fee was non-negotiable."],
  },
  {
    headline: "Gravity rotation reissued",
    note: "The axis migration is back with cleaner paperwork.",
    joke: "Sideways remains technically forward.",
    severity: "critical",
    devLines: ["The axis migration is back. Cleaner paperwork this time."],
    deathLines: ["Paperwork was cleaner. Outcome was not.", "Axis re-migrated mid-fall.", "Sideways was technically downward."],
  },
  {
    headline: "Friction removed from the release notes",
    note: "Momentum is expected to resolve itself before launch.",
    joke: "Stopping is now a stretch goal.",
    severity: "major",
    devLines: ["No friction. Not in the game, not in the notes."],
    deathLines: ["Momentum unresolved at time of impact.", "Stopping remains a stretch goal.", "Sliding into a spike is still a spike."],
  },
  {
    headline: "Final final stability bundle",
    note: "All known fixes have been combined into one persuasive incident.",
    joke: "Stable means every bug is reproducible.",
    severity: "critical",
    devLines: ["Everything. All at once. Final patch."],
    deathLines: ["All bugs confirmed reproducible.", "Final incident logged.", "Stability defined. Narrowly."],
  },
  {
    headline: "Production deploy detected",
    note: "The old patch train has entered a bright, expensive room full of moving parts.",
    joke: "Modernization begins with conveyor belts.",
    severity: "major",
    devLines: ["Welcome to the Production Floor. Everything is sleeker, faster, and legally still my fault."],
    deathLines: ["Conveyor throughput exceeded survival.", "The floor optimized your route badly.", "Production accepted the failure instantly."],
  },
  {
    headline: "Security now scans for fun",
    note: "Laser gates have been installed to improve trust, compliance, and panic.",
    joke: "The lasers passed accessibility review by blinking first.",
    severity: "critical",
    devLines: ["Security asked for readable warnings. I gave the lasers a brief conscience."],
    deathLines: ["The laser warning was not decorative.", "Security logged that as enthusiastic contact.", "Compliance beam achieved compliance."],
  },
  {
    headline: "Air control approved",
    note: "Magnetic pads now teach the player that a second jump is possible.",
    joke: "The floor finally agreed to let you have one more idea.",
    severity: "stable",
    devLines: ["Good news: after this patch, double jump is approved for production."],
    deathLines: ["Air control was approved. Air planning was not.", "The jump pad filed a mixed report.", "Gravity still gets final review."],
  },
  {
    headline: "Indexers now have razors",
    note: "Search performance improved after replacing indexes with spinning hazards.",
    joke: "Query latency is down. Everything else is also down.",
    severity: "critical",
    devLines: ["The indexers spin now. I was told that means they're faster."],
    deathLines: ["Indexer found you immediately.", "Razor route was indexed correctly.", "Search results included one reset."],
  },
  {
    headline: "Load balancer hates doors",
    note: "The exit relocates while sweep lasers verify your patience.",
    joke: "Availability is high if you keep moving.",
    severity: "critical",
    devLines: ["The exit and lasers are both sweeping. Only one of them is helpful."],
    deathLines: ["Sweep laser completed its pass.", "Load balancer selected pain.", "The exit moved. The beam did not."],
  },
  {
    headline: "Compression enabled",
    note: "Crusher panels reduce layout size by applying pressure to the player.",
    joke: "The build is smaller now. So is the margin.",
    severity: "major",
    devLines: ["Compression saved 12 percent. The panels are very proud."],
    deathLines: ["Compression ratio too aggressive.", "The panel closed the issue.", "Layout compacted unexpectedly."],
  },
  {
    headline: "Merge conflict electrified",
    note: "Tesla arcs now connect unresolved changes with charged confidence.",
    joke: "Rollback helps, unless you want the challenge star.",
    severity: "rollback",
    devLines: ["Those arcs are merge conflicts. Grab rollback if you want the cowardly smart route."],
    deathLines: ["Conflict resolved you first.", "The arc reviewed your pull request.", "Rollback was available. Pride was also available."],
  },
  {
    headline: "Monitoring became aggressive",
    note: "Security sensors trigger lockdowns when they notice suspicious platforming.",
    joke: "Observability now observes back.",
    severity: "major",
    devLines: ["Monitoring asked to be more actionable. It now closes doors."],
    deathLines: ["Sensor saw everything.", "Lockdown metrics look excellent.", "You tripped the dashboard."],
  },
  {
    headline: "Cooling system overclocked",
    note: "Plasma vents burst from the floor while async platforms keep their own schedule.",
    joke: "Thermals are stable if nobody stands there.",
    severity: "critical",
    devLines: ["Cooling is fixed. Please avoid the parts where cooling is visible."],
    deathLines: ["Vent cycle was not ambiance.", "Cooling system expressed itself.", "Thermals stable. Player unstable."],
  },
  {
    headline: "Release candidate unstable",
    note: "Lasers, razors, crushers, and moving exits agree this is probably ready.",
    joke: "Stable means every subsystem gets a turn.",
    severity: "critical",
    devLines: ["Release candidate time. If this ships, I am taking a nap on the server rack."],
    deathLines: ["Release candidate rejected your candidacy.", "Every subsystem participated.", "Final production incident recorded."],
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
        required: ["headline", "note", "joke", "severity", "devLines", "deathLines"],
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
          deathLines: {
            type: "array",
            minItems: 2,
            maxItems: 3,
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
        deathLines: cleanDeathLines(fromAi.deathLines, fallbackPatch.deathLines),
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

function cleanDeathLines(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const lines = value.map((v) => cleanText(v, "", 100)).filter((v) => v.length >= 8).slice(0, 3);
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
