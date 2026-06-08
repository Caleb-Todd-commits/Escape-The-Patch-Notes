import { describe, expect, it } from "vitest";
import { canonicalPatches, createFallbackRun, runJsonSchema, sanitizeRun } from "../src/shared/run";

describe("run schema helpers", () => {
  it("creates a full fallback run", () => {
    const run = createFallbackRun("judge-seed");

    expect(run.seed).toBe("judge-seed");
    expect(run.source).toBe("fallback");
    expect(run.levels).toHaveLength(canonicalPatches.length);
    expect(run.levels).toHaveLength(50);
    expect(run.gameOverSummary).toContain("release failed");
  });

  it("sanitizes AI flavor without allowing mechanic drift", () => {
    const run = sanitizeRun(
      {
        buildName: "Bug Bash Royale",
        levels: canonicalPatches.map((patch) => ({
          ...patch,
          modifier: "moving_exit",
          headline: `Funny ${patch.version}`,
          note: "A concise and safe generated joke.",
          joke: "A tiny one-line joke for the level.",
          severity: "critical",
          targetTime: 999,
        })),
        finale: {
          headline: "All clear",
          note: "Nothing suspicious remains in the release candidate.",
        },
        recapPrompts: ["Best bad update", "Most trusted crack", "Least payable fee"],
        gameOverSummary: "A safe generated game over summary.",
      },
      "seeded",
      "openai",
    );

    expect(run.source).toBe("openai");
    expect(run.buildName).toBe("Bug Bash Royale");
    expect(run.levels[1].modifier).toBe("jump_nerf");
    expect(run.levels[1].targetTime).toBe(canonicalPatches[1].targetTime);
    expect(run.levels[1].joke).toBe("A tiny one-line joke for the level.");
    expect(run.recapPrompts).toHaveLength(3);
    expect(run.gameOverSummary).toBe("A safe generated game over summary.");
  });

  it("falls back for malformed text", () => {
    const run = sanitizeRun({ buildName: "\n", levels: [] }, "x", "openai");

    expect(run.buildName).toBe("Midnight Hotfix");
    expect(run.levels[0].headline).toBe("Everything works");
  });

  it("does not ask AI for gameplay fields in the structured output schema", () => {
    const levels = runJsonSchema.properties.levels;
    const item = levels.items;

    expect(item.required).toEqual(["headline", "note", "joke", "severity", "devLines", "deathLines"]);
    expect(item.properties).not.toHaveProperty("modifier");
    expect(item.properties).not.toHaveProperty("targetTime");
    expect(item.properties).not.toHaveProperty("levelId");
  });
});
