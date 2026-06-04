import { describe, expect, it } from "vitest";
import { levels, type LevelDefinition } from "../src/game/levels";
import { canonicalPatches } from "../src/shared/run";

describe("level tuning", () => {
  it("keeps every exit fee fair with at least one optional coin left over", () => {
    for (const level of levels) {
      const fee = level.exit.fee ?? 0;
      const coins = level.coins.reduce((total, coin) => total + coin.value, 0);

      expect(coins).toBeGreaterThanOrEqual(fee === 0 ? 0 : fee + 1);
    }
  });

  it("places every bug report in bounds, away from hazards, and near playable support", () => {
    for (const level of levels) {
      expect(level.bugReport, `level ${level.id} report`).toBeDefined();
      const report = level.bugReport!;

      expect(report.x).toBeGreaterThanOrEqual(level.bounds.x + report.r);
      expect(report.x).toBeLessThanOrEqual(level.bounds.x + level.bounds.w - report.r);
      expect(report.y).toBeGreaterThanOrEqual(level.bounds.y + report.r);
      expect(report.y).toBeLessThanOrEqual(level.bounds.y + level.bounds.h - report.r);
      expect(level.spikes.some((spike) => overlapsCircleRect(report.x, report.y, report.r + 10, spike))).toBe(false);
      expect(hasSupport(level)).toBe(true);
    }
  });

  it("does not auto-collect coins or rollback tokens at spawn", () => {
    for (const level of levels) {
      const center = {
        x: level.start.x + level.start.w / 2,
        y: level.start.y + level.start.h / 2,
      };

      for (const coin of level.coins) {
        expect(distance(center, coin), `level ${level.id} coin ${coin.id}`).toBeGreaterThan(coin.r + 22);
      }

      for (const token of level.tokens ?? []) {
        expect(distance(center, token), `level ${level.id} token ${token.id}`).toBeGreaterThan(token.r + 22);
      }
    }
  });

  it("uses generous medal targets for mechanic-heavy patches", () => {
    const targets = Object.fromEntries(canonicalPatches.map((patch) => [patch.modifier, patch.targetTime]));

    expect(targets.jump_nerf).toBeGreaterThanOrEqual(30);
    expect(targets.rotated_gravity).toBeGreaterThanOrEqual(40);
    expect(targets.async_platforms).toBeGreaterThanOrEqual(42);
    expect(targets.rollback_token).toBeGreaterThanOrEqual(42);
    expect(targets.finale_combo).toBeGreaterThanOrEqual(65);
    expect(targets.production_finale).toBeGreaterThanOrEqual(75);
  });

  it("adds a distinct production chapter with modern tech hazards", () => {
    const chapterTwo = levels.slice(30);

    expect(chapterTwo).toHaveLength(10);
    expect(chapterTwo.every((level) => level.chapter === "production_floor")).toBe(true);
    expect(chapterTwo.some((level) => (level.laserGates?.length ?? 0) > 0)).toBe(true);
    expect(chapterTwo.some((level) => (level.razors?.length ?? 0) > 0)).toBe(true);
    expect(chapterTwo.some((level) => (level.crushers?.length ?? 0) > 0)).toBe(true);
    expect(chapterTwo.some((level) => (level.teslaArcs?.length ?? 0) > 0)).toBe(true);
    expect(chapterTwo.some((level) => (level.plasmaVents?.length ?? 0) > 0)).toBe(true);
    expect(levels[32]?.modifier).toBe("double_jump_unlock");
  });
});

function hasSupport(level: LevelDefinition): boolean {
  const report = level.bugReport!;

  if (level.gravity === "right") {
    return level.platforms.some(
      (platform) =>
        report.x >= platform.x - 72 &&
        report.x <= platform.x + platform.w + 72 &&
        report.y >= platform.y - 18 &&
        report.y <= platform.y + platform.h + 18,
    );
  }

  return level.platforms.some(
    (platform) =>
      report.x >= platform.x - 18 &&
      report.x <= platform.x + platform.w + 18 &&
      report.y >= platform.y - 56 &&
      report.y <= platform.y + platform.h,
  );
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function overlapsCircleRect(x: number, y: number, r: number, rect: { x: number; y: number; w: number; h: number }): boolean {
  const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return Math.hypot(x - closestX, y - closestY) < r;
}
