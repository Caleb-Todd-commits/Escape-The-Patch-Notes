import { describe, expect, it } from "vitest";
import { levels } from "../src/game/levels";
import { canonicalPatches } from "../src/shared/run";
import {
  canUseExit,
  computeSpikeMagnetVelocity,
  doubleJumpImpulse,
  frictionForModifier,
  intersects,
  isPlatformActive,
  isTimedHazardActive,
  isTimedHazardWarning,
  jumpImpulseForModifier,
} from "../src/game/physics";

describe("platformer helpers", () => {
  it("detects rectangle overlap", () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 12, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it("nerfs jump only while the patch is active", () => {
    expect(jumpImpulseForModifier("jump_nerf")).toBeLessThan(jumpImpulseForModifier("base"));
    expect(jumpImpulseForModifier("jump_nerf", true)).toBe(jumpImpulseForModifier("base"));
  });

  it("makes slippery floors meaningfully slicker", () => {
    expect(frictionForModifier("slippery_floor")).toBeLessThan(frictionForModifier("base"));
  });

  it("handles asynchronous platform windows", () => {
    const platform = { on: 1, off: 1, phase: 0 };
    expect(isPlatformActive(platform, 0.25)).toBe(true);
    expect(isPlatformActive(platform, 1.25)).toBe(false);
  });

  it("handles timed tech hazard active and warning windows", () => {
    const hazard = { on: 1, off: 1, warning: 0.25, phase: 0 };
    expect(isTimedHazardActive(hazard, 0.5)).toBe(true);
    expect(isTimedHazardActive(hazard, 1.25)).toBe(false);
    expect(isTimedHazardWarning(hazard, 1.85)).toBe(true);
  });

  it("keeps double jump weaker than the first jump", () => {
    const normal = jumpImpulseForModifier("base");

    expect(doubleJumpImpulse(normal)).toBeLessThan(normal);
    expect(doubleJumpImpulse(normal)).toBeGreaterThan(400);
  });

  it("waives exit fees during rollback", () => {
    expect(canUseExit(2, 5)).toBe(false);
    expect(canUseExit(2, 5, true)).toBe(true);
  });

  it("pulls spikes toward nearby magnet pulses only", () => {
    const near = computeSpikeMagnetVelocity({ x: 0, y: 0 }, { x: 3, y: 4 }, 100, 10);
    const far = computeSpikeMagnetVelocity({ x: 0, y: 0 }, { x: 100, y: 0 }, 100, 10);

    expect(Math.round(Math.hypot(near.x, near.y))).toBe(100);
    expect(far).toEqual({ x: 0, y: 0 });
  });

  it("ships forty levels with run metadata kept in lockstep", () => {
    expect(levels).toHaveLength(40);
    expect(canonicalPatches).toHaveLength(levels.length);
    expect(levels[10]?.modifier).toBe("finale_combo");
    expect(levels[29]?.modifier).toBe("finale_combo");
    expect(levels[30]?.chapter).toBe("production_floor");
    expect(levels[39]?.modifier).toBe("production_finale");
  });

  it("hides one optional bug report in every level", () => {
    expect(levels.every((level) => level.bugReport)).toBe(true);
  });
});
