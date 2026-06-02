import { describe, expect, it } from "vitest";
import { medalForLevel, releaseGrade, scoreRun } from "../src/game/scoring";

describe("run scoring", () => {
  it("awards gold only for clean target-time levels with the active objective complete", () => {
    expect(medalForLevel(20, 22, 0, true)).toBe("gold");
    expect(medalForLevel(20, 22, 0, false)).toBe("silver");
    expect(medalForLevel(20, 22, 1, true)).toBe("silver");
  });

  it("keeps slow finishes shippable instead of failing the run", () => {
    expect(medalForLevel(100, 22, 4, false)).toBe("shipped");
  });

  it("rewards reports and medals in final scoring", () => {
    const low = scoreRun({ seconds: 240, deaths: 8, coins: 12, reports: 0, results: [] });
    const high = scoreRun({
      seconds: 160,
      deaths: 1,
      coins: 35,
      reports: 11,
      results: [{ levelId: 1, patch: "1.0", seconds: 18, deaths: 0, coins: 3, report: true, medal: "gold" }],
    });

    expect(high).toBeGreaterThan(low);
  });

  it("maps scores to release grades", () => {
    expect(releaseGrade(30_000)).toBe("S");
    expect(releaseGrade(25_000)).toBe("A");
    expect(releaseGrade(20_000)).toBe("B");
    expect(releaseGrade(15_000)).toBe("C");
    expect(releaseGrade(1_000)).toBe("SHIP?");
  });
});
