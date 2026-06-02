export type Medal = "gold" | "silver" | "bronze" | "shipped";

export interface LevelResult {
  levelId: number;
  patch: string;
  seconds: number;
  deaths: number;
  coins: number;
  report: boolean;
  medal: Medal;
}

export interface RunScoreInput {
  seconds: number;
  deaths: number;
  coins: number;
  reports: number;
  results: LevelResult[];
}

export function medalForLevel(seconds: number, targetTime: number, deaths: number, report: boolean): Medal {
  if (deaths === 0 && report && seconds <= targetTime) {
    return "gold";
  }

  if (deaths <= 1 && seconds <= targetTime * 1.3) {
    return "silver";
  }

  if (seconds <= targetTime * 1.75) {
    return "bronze";
  }

  return "shipped";
}

export function scoreRun(input: RunScoreInput): number {
  const medalBonus = input.results.reduce((total, result) => total + medalPoints(result.medal), 0);
  const raw = 24_000 - input.seconds * 58 - input.deaths * 520 + input.coins * 115 + input.reports * 420 + medalBonus;
  return Math.max(1000, Math.round(raw));
}

export function releaseGrade(score: number): string {
  if (score >= 30_000) return "S";
  if (score >= 25_000) return "A";
  if (score >= 20_000) return "B";
  if (score >= 15_000) return "C";
  return "SHIP?";
}

export function medalColor(medal: Medal): string {
  if (medal === "gold") return "#ffdc3f";
  if (medal === "silver") return "#cde9ff";
  if (medal === "bronze") return "#ff9a3d";
  return "#87ffc4";
}

function medalPoints(medal: Medal): number {
  if (medal === "gold") return 900;
  if (medal === "silver") return 520;
  if (medal === "bronze") return 260;
  return 80;
}
