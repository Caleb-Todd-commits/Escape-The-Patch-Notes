import { describe, expect, it } from "vitest";
import { parseLevelProgress, shouldShowBonusChallenge, updateLevelProgress } from "../src/game/progress";

describe("level progress", () => {
  it("keeps the bonus challenge locked until a level is completed", () => {
    expect(shouldShowBonusChallenge(undefined)).toBe(false);
    expect(shouldShowBonusChallenge({ completed: false })).toBe(false);
  });

  it("unlocks the bonus challenge after successful completion", () => {
    const progress = updateLevelProgress(
      {},
      { levelId: 3, patch: "1.2", seconds: 24.2, deaths: 0, coins: 4, report: false, medal: "silver" },
    );

    expect(progress[3]).toMatchObject({ completed: true, bestTime: 24.2, bestMedal: "silver" });
    expect(shouldShowBonusChallenge(progress[3])).toBe(true);
  });

  it("keeps the best medal, report state, time, coins, and deaths", () => {
    const first = updateLevelProgress(
      {},
      { levelId: 1, patch: "1.0", seconds: 25, deaths: 2, coins: 1, report: false, medal: "bronze" },
    );
    const second = updateLevelProgress(
      first,
      { levelId: 1, patch: "1.0", seconds: 20, deaths: 0, coins: 3, report: true, medal: "gold" },
    );

    expect(second[1]).toEqual({
      completed: true,
      bestTime: 20,
      bestMedal: "gold",
      reportCollected: true,
      challengeCompleted: true,
      bestCoins: 3,
      bestDeaths: 0,
    });
  });

  it("parses persisted progress defensively and supports old boolean data", () => {
    expect(parseLevelProgress('{"1":true,"2":{"completed":true,"bestTime":18.222,"bestMedal":"gold","reportCollected":true},"4":{"completed":true,"challengeCompleted":true},"3":false}')).toEqual({
      1: { completed: true },
      2: { completed: true, bestTime: 18.22, bestMedal: "gold", reportCollected: true, challengeCompleted: true },
      4: { completed: true, challengeCompleted: true },
    });
    expect(parseLevelProgress("not json")).toEqual({});
  });
});
