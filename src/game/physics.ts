import type { PatchModifier } from "../shared/run";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface TimedPlatform {
  phase?: number;
  on?: number;
  off?: number;
}

export interface TimedHazard {
  phase?: number;
  on?: number;
  off?: number;
  warning?: number;
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectCenter(rect: Rect): Vec2 {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isPlatformActive(platform: TimedPlatform, elapsed: number): boolean {
  const on = platform.on ?? 1;
  const off = platform.off ?? 0;
  if (off <= 0) {
    return true;
  }

  const period = on + off;
  const local = (elapsed + (platform.phase ?? 0)) % period;
  return local < on;
}

export function isTimedHazardActive(hazard: TimedHazard, elapsed: number): boolean {
  const on = hazard.on ?? 1;
  const off = hazard.off ?? 0;
  if (off <= 0) {
    return true;
  }

  const period = on + off;
  const local = (elapsed + (hazard.phase ?? 0)) % period;
  return local < on;
}

export function isTimedHazardWarning(hazard: TimedHazard, elapsed: number): boolean {
  const on = hazard.on ?? 1;
  const off = hazard.off ?? 0;
  const warning = hazard.warning ?? 0.35;
  if (off <= 0 || warning <= 0) {
    return false;
  }

  const period = on + off;
  const local = (elapsed + (hazard.phase ?? 0)) % period;
  return local >= period - warning || local < Math.min(on, warning * 0.4);
}

export function jumpImpulseForModifier(modifier: PatchModifier, rollbackActive = false): number {
  if (!rollbackActive && (modifier === "jump_nerf" || modifier === "finale_combo")) {
    return 490;
  }

  return 580;
}

export function doubleJumpImpulse(baseImpulse: number): number {
  return Math.round(baseImpulse * 0.78);
}

export function frictionForModifier(modifier: PatchModifier, rollbackActive = false): number {
  if (!rollbackActive && modifier === "slippery_floor") {
    return 3;
  }

  if (!rollbackActive && modifier === "finale_combo") {
    return 6;
  }

  return 11;
}

export function canUseExit(coins: number, fee = 0, rollbackActive = false): boolean {
  return rollbackActive || coins >= fee;
}

export function computeSpikeMagnetVelocity(
  spikeCenter: Vec2,
  target: Vec2,
  speed: number,
  maxDistance: number,
): Vec2 {
  const dx = target.x - spikeCenter.x;
  const dy = target.y - spikeCenter.y;
  const length = Math.hypot(dx, dy);

  if (length <= 0.01 || length > maxDistance) {
    return { x: 0, y: 0 };
  }

  return {
    x: (dx / length) * speed,
    y: (dy / length) * speed,
  };
}
