import type { Medal, LevelResult } from "./scoring";

export interface LevelProgress {
  completed: boolean;
  bestTime?: number;
  bestMedal?: Medal;
  reportCollected?: boolean;
  challengeCompleted?: boolean;
  bestCoins?: number;
  bestDeaths?: number;
}

export type LevelProgressMap = Record<number, LevelProgress>;

export const LEVEL_PROGRESS_KEY = "escapePatchNotesLevelCompletions";

export function shouldShowBonusChallenge(progress: LevelProgress | undefined): boolean {
  return Boolean(progress?.completed);
}

export function updateLevelProgress(progress: LevelProgressMap, result: LevelResult): LevelProgressMap {
  const current = progress[result.levelId] ?? { completed: false };
  const bestTime = current.bestTime === undefined ? result.seconds : Math.min(current.bestTime, result.seconds);
  const bestMedal = betterMedal(current.bestMedal, result.medal);

  return {
    ...progress,
    [result.levelId]: {
      completed: true,
      bestTime,
      bestMedal,
      reportCollected: Boolean(current.reportCollected || result.report),
      challengeCompleted: Boolean(current.challengeCompleted || result.challenge || result.report),
      bestCoins: current.bestCoins === undefined ? result.coins : Math.max(current.bestCoins, result.coins),
      bestDeaths: current.bestDeaths === undefined ? result.deaths : Math.min(current.bestDeaths, result.deaths),
    },
  };
}

export function parseLevelProgress(raw: string | null): LevelProgressMap {
  if (!raw) return {};

  try {
    const value = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return {};

    return Object.fromEntries(
      Object.entries(value)
        .map(([level, progress]) => [Number(level), normalizeProgress(progress)] as const)
        .filter(([level, progress]) => Number.isInteger(level) && level > 0 && progress !== undefined),
    ) as LevelProgressMap;
  } catch {
    return {};
  }
}

function normalizeProgress(value: unknown): LevelProgress | undefined {
  if (value === true) {
    return { completed: true };
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (record.completed !== true) {
    return undefined;
  }

  const progress: LevelProgress = { completed: true };
  const bestTime = cleanNumber(record.bestTime);
  const bestCoins = cleanNumber(record.bestCoins);
  const bestDeaths = cleanNumber(record.bestDeaths);

  if (bestTime !== undefined) progress.bestTime = bestTime;
  if (isMedal(record.bestMedal)) progress.bestMedal = record.bestMedal;
  if (record.reportCollected === true) progress.reportCollected = true;
  if (record.challengeCompleted === true || record.reportCollected === true) progress.challengeCompleted = true;
  if (bestCoins !== undefined) progress.bestCoins = bestCoins;
  if (bestDeaths !== undefined) progress.bestDeaths = bestDeaths;

  return progress;
}

function betterMedal(current: Medal | undefined, next: Medal): Medal {
  if (!current) return next;
  return medalRank(next) > medalRank(current) ? next : current;
}

function medalRank(medal: Medal): number {
  if (medal === "gold") return 4;
  if (medal === "silver") return 3;
  if (medal === "bronze") return 2;
  return 1;
}

function cleanNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Number(value.toFixed(2));
}

function isMedal(value: unknown): value is Medal {
  return value === "gold" || value === "silver" || value === "bronze" || value === "shipped";
}
