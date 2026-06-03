import {
  levels,
  cloneLevel,
  type BugReport,
  type Coin,
  type GravityMode,
  type LevelDefinition,
  type Platform,
  type RollbackToken,
  type Spike,
} from "./levels";
import {
  canUseExit,
  clamp,
  computeSpikeMagnetVelocity,
  distance,
  frictionForModifier,
  intersects,
  isPlatformActive,
  jumpImpulseForModifier,
  rectCenter,
  type Rect,
  type Vec2,
} from "./physics";
import {
  LEVEL_PROGRESS_KEY,
  parseLevelProgress,
  shouldShowBonusChallenge,
  updateLevelProgress,
  type LevelProgress,
  type LevelProgressMap,
} from "./progress";
import { medalColor, medalForLevel, releaseGrade, scoreRun, type LevelResult } from "./scoring";
import { createFallbackRun, type LevelPatch, type PatchModifier, type PatchRun } from "../shared/run";

type GameMode =
  | "loading"
  | "title"
  | "releaseBoard"
  | "levelIntro"
  | "playing"
  | "paused"
  | "levelComplete"
  | "gameOver"
  | "gameComplete"
  | "settings";

interface Player extends Rect {
  vx: number;
  vy: number;
  grounded: boolean;
}

interface PlatformState extends Platform {
  broken?: boolean;
  standTime?: number;
}

interface CoinState extends Coin {
  collected?: boolean;
}

interface SpikeState extends Spike {
  baseX: number;
  baseY: number;
}

interface RollbackTokenState extends RollbackToken {
  collected?: boolean;
}

interface BugReportState extends BugReport {
  collected?: boolean;
}

interface LevelState extends Omit<LevelDefinition, "platforms" | "coins" | "spikes" | "tokens" | "bugReport"> {
  platforms: PlatformState[];
  coins: CoinState[];
  spikes: SpikeState[];
  tokens: RollbackTokenState[];
  bugReport?: BugReportState;
}

interface MagnetPulse {
  x: number;
  y: number;
  until: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text?: string;
}

interface DebugSnapshot {
  mode: GameMode;
  level: number;
  bonusChallenge: boolean;
  reportVisible: boolean;
  reportCollected: boolean;
  coins: number;
  deaths: number;
  progress: LevelProgressMap;
}

interface PatchNotesDebug {
  snapshot: () => DebugSnapshot;
  startLevel: (levelNumber: number) => DebugSnapshot;
  completeLevel: (seconds?: number) => DebugSnapshot;
  collectReport: () => DebugSnapshot;
  setCompleted: (levelNumber: number, progress?: Partial<LevelProgress>) => DebugSnapshot;
  resetProgress: () => DebugSnapshot;
}

declare global {
  interface Window {
    __patchNotesDebug?: PatchNotesDebug;
  }
}

interface Bindings {
  left: string;
  right: string;
  jump: string;
  pause: string;
}

const DEFAULT_BINDINGS: Bindings = { left: "ArrowLeft", right: "ArrowRight", jump: "Space", pause: "Escape" };
const SETTINGS_ROWS = 6; // name, left, right, jump, pause, touch

const VIEW_W = 960;
const VIEW_H = 540;
const PLAYER_SPEED = 245;
const ACCEL = 1800;
const GRAVITY = 1420;
const MAX_FALL = 780;
const LEVEL_INTRO_MS = 1050;
const LEVEL_COMPLETE_MS = 1650;
const GAME_OVER_MS = 900;
const FINAL_MODIFIERS: PatchModifier[] = [
  "jump_nerf",
  "coin_spike_magnet",
  "crumbling_platforms",
  "exit_fee",
  "async_platforms",
  "rollback_token",
];

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly keys = new Set<string>();
  private readonly audio = new AudioBus();
  private mode: GameMode = "loading";
  private run: PatchRun = createFallbackRun();
  private levelIndex = 0;
  private level!: LevelState;
  private player!: Player;
  private levelCoins = 0;
  private totalCoins = 0;
  private totalReports = 0;
  private deaths = 0;
  private levelDeaths = 0;
  private runStartedAt = performance.now();
  private levelStartedAt = performance.now();
  private lastFrame = performance.now();
  private levelIntroUntil = 0;
  private levelCompletedAt = 0;
  private gameOverUntil = 0;
  private lastDeathReason = "";
  private rollbackUntil = 0;
  private magnetPulses: MagnetPulse[] = [];
  private particles: Particle[] = [];
  private shakeUntil = 0;
  private shakeMagnitude = 0;
  private results: LevelResult[] = [];
  private bestScore = 0;
  private levelProgress: LevelProgressMap = {};
  private boardSelection = 0;
  private bonusChallengeActive = false;
  private message = "";
  private messageUntil = 0;
  private jumpQueued = false;
  private groundedPlatformId = "";
  private shareUrl = "";
  private levelPauseStart = 0;
  private levelPausedMs = 0;
  private runPauseStart = 0;
  private runPausedMs = 0;
  private bindings: Bindings = loadBindings();
  private playerName = loadPlayerName();
  private settingsRow = 0;
  private settingsPrevMode: GameMode = "title";
  private rebindingFor: keyof Bindings | null = null;
  private facing: "right" | "left" = "right";
  private hotSpots: Array<{ x: number; y: number; w: number; h: number; action: () => void }> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly status?: HTMLElement,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not create 2d canvas context");
    }

    this.ctx = ctx;
    this.bindInput();
    this.resizeForDevicePixelRatio();
    window.addEventListener("resize", () => this.resizeForDevicePixelRatio());
  }

  async boot(): Promise<void> {
    this.setMode("loading");
    this.run = await loadRun();
    this.bestScore = loadBestScore();
    this.levelProgress = loadLevelProgress();
    this.shareUrl = `${location.origin}${location.pathname}?seed=${encodeURIComponent(this.run.seed)}`;
    this.resetRun();
    this.installDebugHooks();
    this.setMode("title");
    requestAnimationFrame((time) => this.loop(time));
  }

  private bindInput(): void {
    window.addEventListener("keydown", (event) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
        event.preventDefault();
      }

      if (event.code === "KeyM") {
        this.audio.toggle();
        this.toast(this.audio.muted ? "Audio muted" : "Audio live");
        return;
      }

      if (this.mode === "settings") {
        this.handleSettingsInput(event.code);
        return;
      }

      if (event.code === this.bindings.pause && (this.mode === "playing" || this.mode === "paused")) {
        this.setMode(this.mode === "playing" ? "paused" : "playing");
        return;
      }

      if (event.code === "Escape" && this.mode === "releaseBoard") {
        this.setMode("title");
        return;
      }

      if (event.code === "KeyS" && !event.repeat && (this.mode === "title" || this.mode === "paused")) {
        this.settingsPrevMode = this.mode;
        this.settingsRow = 0;
        this.rebindingFor = null;
        this.setMode("settings");
        return;
      }

      if (event.code === "KeyB" && this.mode !== "playing" && this.mode !== "loading") {
        this.setMode("releaseBoard");
        return;
      }

      if (this.mode === "releaseBoard") {
        this.handleBoardInput(event.code);
        return;
      }

      if (event.code === "KeyR" && this.mode === "gameComplete") {
        this.startRunAt(0);
        this.audio.play("start");
        return;
      }

      if (
        event.code === "KeyR" &&
        (this.mode === "playing" || this.mode === "paused" || this.mode === "levelIntro" || this.mode === "levelComplete" || this.mode === "gameOver")
      ) {
        this.resetLevel();
        this.startLevelIntro();
        this.audio.play("restart");
        return;
      }

      if (event.code === "Enter" || event.code === "Space") {
        if (this.mode === "title") {
          if (event.code === "Space") {
            this.startRunAt(0);
          } else {
            this.setMode("releaseBoard");
          }
          this.audio.play("start");
          return;
        }

        if (this.mode === "gameComplete") {
          this.setMode("releaseBoard");
          this.audio.play("start");
          return;
        }

        if (this.mode === "levelIntro") {
          this.startPlaying(performance.now());
          return;
        }

        if (this.mode === "levelComplete") {
          this.advanceLevel();
          return;
        }

        if (this.mode === "gameOver") {
          this.resetLevel();
          this.startLevelIntro();
          return;
        }
      }

      if (event.code === this.bindings.jump || event.code === "KeyW" || event.code === "ArrowUp") {
        this.jumpQueued = true;
      }

      this.keys.add(event.code);
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });

    this.canvas.addEventListener("pointerdown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const lx = (e.clientX - rect.left) * (VIEW_W / rect.width);
      const ly = (e.clientY - rect.top) * (VIEW_H / rect.height);
      for (const hs of this.hotSpots) {
        if (lx >= hs.x && lx <= hs.x + hs.w && ly >= hs.y && ly <= hs.y + hs.h) {
          hs.action();
          return;
        }
      }
    });

    this.canvas.addEventListener("pointermove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const lx = (e.clientX - rect.left) * (VIEW_W / rect.width);
      const ly = (e.clientY - rect.top) * (VIEW_H / rect.height);
      const over = this.hotSpots.some(hs =>
        lx >= hs.x && lx <= hs.x + hs.w && ly >= hs.y && ly <= hs.y + hs.h
      );
      this.canvas.style.cursor = over ? "pointer" : "";
    });
  }

  private hot(x: number, y: number, w: number, h: number, action: () => void): void {
    this.hotSpots.push({ x, y, w, h, action });
  }

  private resizeForDevicePixelRatio(): void {
    const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.canvas.width = VIEW_W * ratio;
    this.canvas.height = VIEW_H * ratio;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private resetRun(): void {
    this.levelIndex = 0;
    this.totalCoins = 0;
    this.totalReports = 0;
    this.deaths = 0;
    this.levelDeaths = 0;
    this.results = [];
    this.particles = [];
    this.runStartedAt = performance.now();
    this.runPausedMs = 0;
    this.runPauseStart = 0;
    this.resetLevel();
  }

  private resetLevel(): void {
    const definition = cloneLevel(levels[this.levelIndex]);
    this.level = {
      ...definition,
      platforms: definition.platforms.map((item) => ({ ...item, standTime: 0 })),
      coins: definition.coins.map((item) => ({ ...item, collected: false })),
      spikes: definition.spikes.map((item) => ({ ...item, baseX: item.x, baseY: item.y, vx: 0, vy: 0 })),
      tokens: (definition.tokens ?? []).map((item) => ({ ...item, collected: false })),
      bugReport: definition.bugReport ? { ...definition.bugReport, collected: false } : undefined,
    };
    this.player = {
      ...definition.start,
      vx: 0,
      vy: 0,
      grounded: false,
    };
    this.levelCoins = 0;
    this.rollbackUntil = 0;
    this.magnetPulses = [];
    this.bonusChallengeActive = false;
    this.message = "";
    this.messageUntil = 0;
    this.levelStartedAt = performance.now();
    this.levelPausedMs = 0;
    this.levelPauseStart = 0;
    this.setStatus();
  }

  private loop(time: number): void {
    const dt = Math.min(0.033, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;

    this.updateParticles(dt);

    if (this.mode === "playing") {
      this.update(dt, time);
    } else if (this.mode === "levelIntro" && time > this.levelIntroUntil) {
      this.startPlaying(time);
    } else if (this.mode === "levelComplete" && time - this.levelCompletedAt > LEVEL_COMPLETE_MS) {
      this.advanceLevel();
    } else if (this.mode === "gameOver" && time > this.gameOverUntil) {
      this.resetLevel();
      this.startLevelIntro();
    }

    this.draw(time);
    requestAnimationFrame((next) => this.loop(next));
  }

  private update(dt: number, time: number): void {
    this.updatePlayer(dt, time);
    if (this.mode !== "playing") return;
    this.updateCrumblingPlatforms(dt);
    if (this.mode !== "playing") return;
    this.updateSpikes(dt, time);
    if (this.mode !== "playing") return;
    this.collectItems(time);
    if (this.mode !== "playing") return;
    this.checkHazards(time);
    if (this.mode !== "playing") return;
    this.checkExit(time);
    this.setStatus();
  }

  private updatePlayer(dt: number, time: number): void {
    const rollbackActive = this.isRollbackActive(time);
    const gravity = gravityVector(this.level.gravity);
    const lateral = lateralVector(this.level.gravity);
    const input = this.inputAxis();
    const friction = frictionForModifier(this.level.modifier, rollbackActive);

    if (lateral.x !== 0) {
      this.player.vx += input * ACCEL * dt;
      if (input === 0) {
        this.player.vx -= clamp(this.player.vx, -friction * PLAYER_SPEED * dt, friction * PLAYER_SPEED * dt);
      }
      this.player.vx = clamp(this.player.vx, -PLAYER_SPEED, PLAYER_SPEED);
    } else {
      this.player.vy += input * ACCEL * dt;
      if (input === 0) {
        this.player.vy -= clamp(this.player.vy, -friction * PLAYER_SPEED * dt, friction * PLAYER_SPEED * dt);
      }
      this.player.vy = clamp(this.player.vy, -PLAYER_SPEED, PLAYER_SPEED);
    }

    if (this.jumpQueued && this.player.grounded) {
      const jump = jumpImpulseForModifier(this.level.modifier, rollbackActive);
      this.player.vx += -gravity.x * jump;
      this.player.vy += -gravity.y * jump;
      this.player.grounded = false;
      this.audio.play("jump");
    }
    this.jumpQueued = false;

    this.player.vx += gravity.x * GRAVITY * dt;
    this.player.vy += gravity.y * GRAVITY * dt;
    this.player.vx = clamp(this.player.vx, -MAX_FALL, MAX_FALL);
    this.player.vy = clamp(this.player.vy, -MAX_FALL, MAX_FALL);

    this.moveAndCollide(dt, time);

    if (lateral.x !== 0 && input !== 0) {
      this.facing = input > 0 ? "right" : "left";
    }

    if (
      this.player.x < -80 ||
      this.player.x > VIEW_W + 80 ||
      this.player.y < -80 ||
      this.player.y > VIEW_H + 80
    ) {
      this.die("Patched out of bounds");
    }
  }

  private moveAndCollide(dt: number, time: number): void {
    const gravity = gravityVector(this.level.gravity);
    const solids = this.activePlatforms(time);
    this.player.grounded = false;
    this.groundedPlatformId = "";

    this.player.x += this.player.vx * dt;
    for (const solid of solids) {
      if (!intersects(this.player, solid)) {
        continue;
      }

      if (this.player.vx > 0) {
        this.player.x = solid.x - this.player.w;
        if (gravity.x > 0) {
          this.player.grounded = true;
          this.groundedPlatformId = solid.id;
        }
      } else if (this.player.vx < 0) {
        this.player.x = solid.x + solid.w;
        if (gravity.x < 0) {
          this.player.grounded = true;
          this.groundedPlatformId = solid.id;
        }
      }
      this.player.vx = 0;
    }

    this.player.y += this.player.vy * dt;
    for (const solid of solids) {
      if (!intersects(this.player, solid)) {
        continue;
      }

      if (this.player.vy > 0) {
        this.player.y = solid.y - this.player.h;
        if (gravity.y > 0) {
          this.player.grounded = true;
          this.groundedPlatformId = solid.id;
        }
      } else if (this.player.vy < 0) {
        this.player.y = solid.y + solid.h;
        if (gravity.y < 0) {
          this.player.grounded = true;
          this.groundedPlatformId = solid.id;
        }
      }
      this.player.vy = 0;
    }
  }

  private levelElapsed(time: number): number {
    const pauseAdjust = this.levelPauseStart > 0 ? time - this.levelPauseStart : 0;
    return Math.max(0, (time - this.levelStartedAt - this.levelPausedMs - pauseAdjust) / 1000);
  }

  private activePlatforms(time: number): PlatformState[] {
    const rollbackActive = this.isRollbackActive(time);
    const elapsed = this.levelElapsed(time);

    return this.level.platforms.filter((platform) => {
      if (platform.broken) {
        return false;
      }

      if (platform.kind === "async" && !rollbackActive) {
        return isPlatformActive(platform, elapsed);
      }

      return true;
    });
  }

  private updateCrumblingPlatforms(dt: number): void {
    if (!this.isModifierLive("crumbling_platforms")) {
      return;
    }

    for (const platform of this.level.platforms) {
      if (platform.kind !== "crumbling" || platform.broken) {
        continue;
      }

      if (platform.id === this.groundedPlatformId) {
        platform.standTime = (platform.standTime ?? 0) + dt;
        if (platform.standTime > (platform.breakAfter ?? 0.75)) {
          platform.broken = true;
          this.audio.play("break");
        }
      } else {
        platform.standTime = Math.max(0, (platform.standTime ?? 0) - dt * 0.55);
      }
    }
  }

  private updateSpikes(dt: number, time: number): void {
    const magnetLive = this.isModifierLive("coin_spike_magnet");
    this.magnetPulses = this.magnetPulses.filter((pulse) => pulse.until > time);

    for (const spike of this.level.spikes) {
      if (!magnetLive || this.magnetPulses.length === 0) {
        spike.vx = (spike.vx ?? 0) * 0.9;
        spike.vy = (spike.vy ?? 0) * 0.9;
      } else {
        const center = rectCenter(spike);
        const target = nearestPulse(center, this.magnetPulses);
        const velocity = computeSpikeMagnetVelocity(center, target, 92, 260);
        spike.vx = clamp((spike.vx ?? 0) + velocity.x * dt * 3, -110, 110);
        spike.vy = clamp((spike.vy ?? 0) + velocity.y * dt * 3, -110, 110);
      }

      spike.x += (spike.vx ?? 0) * dt;
      spike.y += (spike.vy ?? 0) * dt;
      spike.x = clamp(spike.x, spike.baseX - 46, spike.baseX + 46);
      spike.y = clamp(spike.y, spike.baseY - 36, spike.baseY + 36);
    }
  }

  private collectItems(time: number): void {
    const playerCenter = rectCenter(this.player);

    for (const coin of this.level.coins) {
      if (coin.collected || distance(playerCenter, coin) > coin.r + 22) {
        continue;
      }

      coin.collected = true;
      this.levelCoins += coin.value;
      this.magnetPulses.push({ x: coin.x, y: coin.y, until: time + 1350 });
      this.burst(coin.x, coin.y, "#ffdc3f", 10);
      this.audio.play("coin");
    }

    for (const token of this.level.tokens) {
      if (token.collected || distance(playerCenter, token) > token.r + 22) {
        continue;
      }

      token.collected = true;
      this.rollbackUntil = Math.max(this.rollbackUntil, time + token.seconds * 1000);
      this.toast("Rollback window open");
      this.burst(token.x, token.y, "#87ffc4", 16);
      this.shake(4, 180);
      this.audio.play("rollback");
    }

    const report = this.bonusChallengeActive ? this.level.bugReport : undefined;
    if (report && !report.collected && distance(playerCenter, report) <= report.r + 22) {
      report.collected = true;
      this.toast(`Bug filed: ${report.title}`);
      this.burst(report.x, report.y, "#ff9aa7", 20, "BUG");
      this.shake(5, 190);
      this.audio.play("coin");
    }
  }

  private checkHazards(time: number): void {
    for (const spike of this.level.spikes) {
      const hitbox = { x: spike.x + 6, y: spike.y + 6, w: spike.w - 12, h: spike.h - 8 };
      if (intersects(this.player, hitbox)) {
        this.die("Spike subscribed to revenue events");
        return;
      }
    }

    if (this.level.gates && !this.isRollbackActive(time)) {
      for (const gate of this.level.gates) {
        if (intersects(this.player, gate)) {
          this.die("Rollback required");
          return;
        }
      }
    }
  }

  private checkExit(time: number): void {
    const exit = this.activeExit(time);
    if (!intersects(this.player, exit)) {
      return;
    }

    const rollbackActive = this.isRollbackActive(time);
    const fee = rollbackActive ? 0 : this.level.exit.fee ?? 0;

    if (!canUseExit(this.levelCoins, fee, rollbackActive)) {
      this.toast(`Processing fee: ${fee} coins`);
      this.player.vx *= -0.35;
      this.player.vy *= -0.35;
      this.audio.play("error");
      return;
    }

    this.completeLevel(time);
  }

  private completeLevel(time: number): void {
    if (this.mode !== "playing") {
      return;
    }

    const elapsed = this.levelElapsed(time);
    const patch = this.currentPatch();
    const report = this.bonusChallengeActive && Boolean(this.level.bugReport?.collected);
    const bonusComplete = !this.bonusChallengeActive || report;
    const medal = medalForLevel(elapsed, patch.targetTime, this.levelDeaths, bonusComplete);
    this.results[this.levelIndex] = {
      levelId: this.level.id,
      patch: patch.version,
      seconds: elapsed,
      deaths: this.levelDeaths,
      coins: this.levelCoins,
      report,
      medal,
    };
    this.totalCoins += this.levelCoins;
    this.totalReports += report ? 1 : 0;
    this.levelProgress = updateLevelProgress(this.levelProgress, this.results[this.levelIndex]);
    saveLevelProgress(this.levelProgress);
    this.levelCompletedAt = time;
    this.setMode("levelComplete");
    this.toast(`${medal.toUpperCase()} PATCH`);
    this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, medalColor(medal), 28);
    this.shake(this.levelIndex === levels.length - 1 ? 8 : 5, 240);
    this.audio.play(this.levelIndex === levels.length - 1 ? "win" : "complete");
  }

  private advanceLevel(): void {
    if (this.levelIndex >= levels.length - 1) {
      this.setMode("gameComplete");
      return;
    }

    this.levelIndex += 1;
    this.levelDeaths = 0;
    this.resetLevel();
    this.startLevelIntro();
  }

  private startRunAt(index: number): void {
    this.levelIndex = clamp(index, 0, levels.length - 1);
    this.boardSelection = this.levelIndex;
    this.totalCoins = 0;
    this.totalReports = 0;
    this.deaths = 0;
    this.levelDeaths = 0;
    this.results = [];
    this.particles = [];
    this.runStartedAt = performance.now();
    this.runPausedMs = 0;
    this.runPauseStart = 0;
    this.resetLevel();
    this.startLevelIntro();
  }

  private handleBoardInput(code: string): void {
    const columns = 3;
    const current = this.boardSelection;

    if (code === "ArrowLeft") this.boardSelection = clamp(current - 1, 0, levels.length - 1);
    if (code === "ArrowRight") this.boardSelection = clamp(current + 1, 0, levels.length - 1);
    if (code === "ArrowUp") this.boardSelection = clamp(current - columns, 0, levels.length - 1);
    if (code === "ArrowDown") this.boardSelection = clamp(current + columns, 0, levels.length - 1);

    if (code === "Enter" || code === "Space" || code === "KeyR") {
      this.startRunAt(this.boardSelection);
      this.audio.play("start");
      return;
    }

    this.setStatus();
  }

  private die(reason: string): void {
    this.deaths += 1;
    this.levelDeaths += 1;
    this.toast(reason);
    this.lastDeathReason = reason;
    this.gameOverUntil = performance.now() + GAME_OVER_MS;
    this.setMode("gameOver");
    this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, "#ff4f81", 26, "X");
    this.shake(9, 260);
    this.audio.play("die");
  }

  private startLevelIntro(time = performance.now()): void {
    this.beginLevelAttempt();
    this.levelIntroUntil = time + LEVEL_INTRO_MS;
    this.setMode("levelIntro");
    this.audio.play("intro");
  }

  private startPlaying(time: number): void {
    this.levelStartedAt = time;
    this.setMode("playing");
  }

  private inputAxis(): number {
    const left = this.keys.has(this.bindings.left) || this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const right = this.keys.has(this.bindings.right) || this.keys.has("KeyD") || this.keys.has("ArrowRight");
    return Number(right) - Number(left);
  }

  private isRollbackActive(time = performance.now()): boolean {
    return time < this.rollbackUntil;
  }

  private isModifierLive(modifier: PatchModifier): boolean {
    if (this.isRollbackActive()) {
      return false;
    }

    return this.level.modifier === modifier || (this.level.modifier === "finale_combo" && FINAL_MODIFIERS.includes(modifier));
  }

  private activeExit(time: number): Rect {
    if (this.level.exit.pads && this.level.exit.pads.length > 0) {
      const elapsed = this.levelElapsed(time);
      const index = Math.floor(elapsed / 2.1) % this.level.exit.pads.length;
      return this.level.exit.pads[index];
    }

    return this.level.exit;
  }

  private setMode(mode: GameMode): void {
    const prev = this.mode;
    this.mode = mode;

    if (prev === "playing" && mode !== "playing") {
      const now = performance.now();
      this.levelPauseStart = now;
      this.runPauseStart = now;
    } else if (prev !== "playing" && mode === "playing") {
      const now = performance.now();
      if (this.levelPauseStart > 0) {
        this.levelPausedMs += now - this.levelPauseStart;
        this.levelPauseStart = 0;
      }
      if (this.runPauseStart > 0) {
        this.runPausedMs += now - this.runPauseStart;
        this.runPauseStart = 0;
      }
    }

    this.setStatus();
  }

  private setStatus(): void {
    const level = this.levelIndex + 1;
    const boardProgress = this.levelProgress[levels[this.boardSelection]?.id ?? 1];
    const boardBonus = this.mode === "releaseBoard" ? shouldShowBonusChallenge(boardProgress) : this.bonusChallengeActive;
    document.body.dataset.gameState = this.mode;
    document.body.dataset.level = String(level);
    document.body.dataset.boardSelection = String(this.boardSelection + 1);
    document.body.dataset.bonusChallenge = boardBonus ? "active" : "locked";
    if (this.status) {
      this.status.textContent = `${this.mode}, level ${level}, coins ${this.levelCoins}, deaths ${this.deaths}`;
    }
  }

  private toast(message: string): void {
    this.message = message;
    this.messageUntil = performance.now() + 1400;
  }

  private draw(time: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    if (time < this.shakeUntil) {
      const strength = this.shakeMagnitude * ((this.shakeUntil - time) / Math.max(1, this.shakeUntil - (time - 16)));
      ctx.translate((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength);
    }

    this.hotSpots = [];
    this.drawBackground(ctx, time);

    if (this.mode === "loading") {
      this.drawCenteredPanel("Loading patch notes", "Fetching the questionable decisions...");
      ctx.restore();
      return;
    }

    if (this.mode === "releaseBoard") {
      this.drawReleaseBoard();
      ctx.restore();
      return;
    }

    if (this.mode === "settings") {
      this.drawSettings();
      ctx.restore();
      return;
    }

    this.drawWorld(ctx, time);
    this.drawHud(ctx, time);

    if (this.mode === "title") {
      this.drawTitle();
    } else if (this.mode === "levelIntro") {
      this.drawPatchIntro();
    } else if (this.mode === "paused") {
      this.drawPausedScreen();
    } else if (this.mode === "levelComplete") {
      this.drawLevelComplete();
    } else if (this.mode === "gameOver") {
      this.drawGameOverScreen();
    } else if (this.mode === "gameComplete") {
      this.drawWinScreen();
    }
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D, time: number): void {
    const bg = this.level?.background ?? "#090d22";
    const gradient = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    gradient.addColorStop(0, bg);
    gradient.addColorStop(1, "#080814");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Star field tinted to match the level's color palette
    ctx.fillStyle = `rgba(${hexLighter(bg, 110)}, 0.18)`;
    for (let i = 0; i < 48; i += 1) {
      const x = (i * 137 + Math.sin(time / 900 + i) * 8) % VIEW_W;
      const y = (i * 73 + Math.cos(time / 1300 + i) * 8) % VIEW_H;
      ctx.fillRect(x, y, i % 5 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
    }

    // Grid lines tinted to match
    ctx.fillStyle = `rgba(${hexLighter(bg, 20)}, 0.48)`;
    for (let x = 0; x < VIEW_W; x += 48) {
      ctx.fillRect(x, 0, 2, VIEW_H);
    }
    for (let y = 0; y < VIEW_H; y += 48) {
      ctx.fillRect(0, y, VIEW_W, 2);
    }
  }

  private drawWorld(ctx: CanvasRenderingContext2D, time: number): void {
    const activeIds = new Set(this.activePlatforms(time).map((item) => item.id));
    for (const platform of this.level.platforms) {
      this.drawPlatform(ctx, platform, activeIds.has(platform.id), time);
    }

    if (this.level.exit.pads) {
      for (const pad of this.level.exit.pads) {
        drawRect(ctx, pad, "rgba(99, 226, 255, 0.18)", "rgba(99, 226, 255, 0.34)");
      }
    }

    if (this.level.gates) {
      for (const gate of this.level.gates) {
        const active = !this.isRollbackActive(time);
        drawRect(ctx, gate, active ? "rgba(255, 79, 129, 0.52)" : "rgba(104, 255, 184, 0.22)", active ? "#ff4f81" : "#68ffb8");
        if (active) {
          for (let y = gate.y + 8; y < gate.y + gate.h; y += 18) {
            ctx.fillStyle = "#ffe66d";
            ctx.fillRect(gate.x + 4, y, gate.w - 8, 3);
          }
        }
      }
    }

    for (const coin of this.level.coins) {
      if (!coin.collected) {
        this.drawCoin(ctx, coin, time);
      }
    }

    for (const token of this.level.tokens) {
      if (!token.collected) {
        this.drawRollbackToken(ctx, token, time);
      }
    }

    if (this.bonusChallengeActive && this.level.bugReport && !this.level.bugReport.collected) {
      this.drawBugReport(ctx, this.level.bugReport, time);
    }

    for (const spike of this.level.spikes) {
      this.drawSpike(ctx, spike);
    }

    this.drawExit(ctx, this.activeExit(time), time);
    this.drawPlayer(ctx, time);
    this.drawParticles(ctx);

    if (this.message && time < this.messageUntil) {
      drawTextPill(ctx, this.message, VIEW_W / 2, 104, "#fff5d6", "#291a36");
    }
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, platform: PlatformState, active: boolean, time: number): void {
    if (platform.broken) {
      return;
    }

    const fill = platform.kind === "crumbling" ? "#99694a" : platform.kind === "async" ? "#3edce7" : "#4caf63";
    const edge = platform.kind === "crumbling" ? "#ffc15e" : platform.kind === "async" ? "#e8fbff" : "#b8ff85";
    const alpha = active ? 1 : 0.22;

    ctx.save();
    ctx.globalAlpha = alpha;
    drawRect(ctx, platform, fill, edge);
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.fillRect(platform.x, platform.y + platform.h - 7, platform.w, 7);

    if (platform.kind === "crumbling") {
      const crack = clamp((platform.standTime ?? 0) / (platform.breakAfter ?? 0.75), 0, 1);
      ctx.strokeStyle = `rgba(35, 20, 24, ${0.35 + crack * 0.5})`;
      ctx.lineWidth = 2;
      for (let x = platform.x + 16; x < platform.x + platform.w - 10; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, platform.y + 4);
        ctx.lineTo(x + 7, platform.y + 10 + crack * 6);
        ctx.lineTo(x + 2, platform.y + platform.h - 4);
        ctx.stroke();
      }
    }

    if (platform.kind === "async") {
      const pulse = 0.5 + Math.sin(time / 160 + platform.x) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.18 + pulse * 0.22})`;
      ctx.fillRect(platform.x + 6, platform.y + 5, platform.w - 12, 4);
    }
    ctx.restore();
  }

  private drawCoin(ctx: CanvasRenderingContext2D, coin: CoinState, time: number): void {
    const bob = Math.sin(time / 170 + coin.x) * 3;
    ctx.fillStyle = "#593b00";
    ctx.fillRect(coin.x - 8, coin.y + bob + 8, 16, 4);
    ctx.fillStyle = "#ffdc3f";
    ctx.beginPath();
    ctx.arc(coin.x, coin.y + bob, coin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff39b";
    ctx.fillRect(coin.x - 3, coin.y + bob - 6, 5, 12);
  }

  private drawRollbackToken(ctx: CanvasRenderingContext2D, token: RollbackTokenState, time: number): void {
    const bob = Math.sin(time / 160 + token.x) * 4;
    ctx.fillStyle = "#87ffc4";
    ctx.beginPath();
    ctx.arc(token.x, token.y + bob, token.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#15324a";
    ctx.fillRect(token.x - 7, token.y + bob - 3, 14, 6);
    ctx.fillRect(token.x - 1, token.y + bob - 8, 6, 16);
  }

  private drawBugReport(ctx: CanvasRenderingContext2D, report: BugReportState, time: number): void {
    const bob = Math.sin(time / 180 + report.x) * 4;
    ctx.fillStyle = "#2a1830";
    ctx.fillRect(report.x - 11, report.y + bob - 12, 23, 27);
    ctx.fillStyle = "#fff5d6";
    ctx.fillRect(report.x - 9, report.y + bob - 14, 22, 27);
    ctx.fillStyle = "#ff4f81";
    ctx.fillRect(report.x - 6, report.y + bob - 9, 12, 3);
    ctx.fillRect(report.x - 6, report.y + bob - 2, 16, 3);
    ctx.fillStyle = "#53d7ff";
    ctx.fillRect(report.x - 6, report.y + bob + 5, 10, 3);
  }

  private drawSpike(ctx: CanvasRenderingContext2D, spike: SpikeState): void {
    ctx.fillStyle = "#311522";
    ctx.beginPath();
    ctx.moveTo(spike.x, spike.y + spike.h);
    ctx.lineTo(spike.x + spike.w / 2, spike.y);
    ctx.lineTo(spike.x + spike.w, spike.y + spike.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff4f81";
    ctx.beginPath();
    ctx.moveTo(spike.x + 5, spike.y + spike.h - 2);
    ctx.lineTo(spike.x + spike.w / 2, spike.y + 8);
    ctx.lineTo(spike.x + spike.w - 5, spike.y + spike.h - 2);
    ctx.closePath();
    ctx.fill();
  }

  private drawExit(ctx: CanvasRenderingContext2D, exit: Rect, time: number): void {
    const pulse = 0.5 + Math.sin(time / 180) * 0.5;
    ctx.fillStyle = "#071221";
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.strokeStyle = "#70f5ff";
    ctx.lineWidth = 4;
    ctx.strokeRect(exit.x + 2, exit.y + 2, exit.w - 4, exit.h - 4);
    ctx.fillStyle = `rgba(112,245,255,${0.25 + pulse * 0.25})`;
    ctx.fillRect(exit.x + 8, exit.y + 8, exit.w - 16, exit.h - 16);

    const fee = this.level.exit.fee ?? 0;
    if (fee > 0 && !canUseExit(this.levelCoins, fee, this.isRollbackActive(time))) {
      drawTextPill(ctx, `$${fee}`, exit.x + exit.w / 2, exit.y - 14, "#ffdc3f", "#2d1833");
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, time: number): void {
    const p = this.player;
    const blink = Math.sin(time / 100) > 0.2;
    const cx = p.x + p.w / 2;

    ctx.save();
    if (this.facing === "left") {
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-cx, 0);
    }

    ctx.fillStyle = "#c73d58";
    ctx.fillRect(p.x - 8, p.y + 12, 12, 18);
    ctx.fillStyle = "#1e8dff";
    ctx.fillRect(p.x + 5, p.y + 8, p.w - 6, p.h - 6);
    ctx.fillStyle = "#63d7ff";
    ctx.fillRect(p.x + 9, p.y + 12, p.w - 14, 10);
    ctx.fillStyle = "#ffd89b";
    ctx.fillRect(p.x + 8, p.y + 2, p.w - 9, 14);
    ctx.fillStyle = "#3c1c28";
    ctx.fillRect(p.x + 6, p.y, p.w - 5, 7);
    ctx.fillStyle = "#111827";
    if (blink) {
      ctx.fillRect(p.x + 14, p.y + 8, 3, 3);
      ctx.fillRect(p.x + 22, p.y + 8, 3, 3);
    } else {
      ctx.fillRect(p.x + 14, p.y + 9, 3, 1);
      ctx.fillRect(p.x + 22, p.y + 9, 3, 1);
    }

    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, time: number): void {
    const patch = this.currentPatch();
    const elapsed = this.levelElapsed(time);
    const runPauseAdjust = this.runPauseStart > 0 ? time - this.runPauseStart : 0;
    const runElapsed = Math.max(0, (time - this.runStartedAt - this.runPausedMs - runPauseAdjust) / 1000);

    drawPanel(ctx, 18, 18, 430, 104, "rgba(9, 13, 31, 0.82)", "#53d7ff");
    drawText(ctx, `${this.level.title} - ${patch.headline}`, 34, 44, 20, "#ffffff", "bold");
    drawWrappedText(ctx, patch.note, 34, 68, 386, 16, "#cde9ff");
    drawText(ctx, severityLabel(patch.severity), 346, 106, 14, severityColor(patch.severity), "bold");

    drawPanel(ctx, 468, 18, 474, 64, "rgba(9, 13, 31, 0.78)", "#7767ff");
    drawText(ctx, this.run.buildName, 486, 43, 18, "#fff5d6", "bold");
    drawText(
      ctx,
      `${this.run.source.toUpperCase()} RUN ${this.run.runId}`,
      486,
      64,
      12,
      this.run.source === "openai" ? "#87ffc4" : "#ffdc3f",
      "bold",
    );
    drawText(ctx, `${this.levelCoins} coins`, 820, 43, 15, "#ffdc3f", "bold");
    drawText(ctx, `${this.deaths} deaths`, 820, 64, 13, "#ff9aa7", "bold");

    // Release-train progress track
    const dotW = 11;
    const dotGap = 3;
    const trainX = 670;
    const trainY = 76;
    for (let i = 0; i < 11; i++) {
      const lprog = this.levelProgress[levels[i]?.id];
      let dotColor: string;
      if (i === this.levelIndex && this.mode === "playing") {
        dotColor = "#ffdc3f";
      } else if (lprog?.completed) {
        dotColor = lprog.bestMedal === "gold" ? "#ffdc3f" : lprog.bestMedal === "silver" ? "#cde9ff" : "#87ffc4";
      } else {
        dotColor = "rgba(255,255,255,0.15)";
      }
      ctx.fillStyle = dotColor;
      ctx.fillRect(trainX + i * (dotW + dotGap), trainY - 7, dotW, 7);
    }
    const reportCount = this.totalReports + Number(this.bonusChallengeActive && Boolean(this.level.bugReport?.collected));
    drawText(
      ctx,
      this.bonusChallengeActive ? `${reportCount}/11 bugs` : "bonus locked",
      684,
      64,
      13,
      this.bonusChallengeActive ? "#fff5d6" : "#9fc7ff",
      "bold",
    );

    drawPanel(ctx, 0, 506, VIEW_W, 34, "rgba(9, 13, 31, 0.88)", "#4caf63");
    drawText(ctx, `Level ${elapsed.toFixed(1)}s`, 18, 529, 14, "#ffffff", "bold");
    drawText(ctx, `Run ${runElapsed.toFixed(1)}s`, 174, 529, 14, "#ffffff", "bold");
    drawText(ctx, this.audio.muted ? "Muted" : "Sound on", 340, 529, 13, this.audio.muted ? "#ff9aa7" : "#87ffc4", "bold");
    if (this.playerName) {
      drawText(ctx, this.playerName, 500, 529, 13, "#fff5d6");
    }

    if (this.isRollbackActive(time)) {
      const left = Math.max(0, (this.rollbackUntil - time) / 1000);
      drawTextPill(ctx, `ROLLBACK ${left.toFixed(1)}s`, 822, 102, "#87ffc4", "#12283a");
    }
  }

  private drawTitle(): void {
    const ctx = this.ctx;
    drawPanel(ctx, 112, 106, 736, 330, "rgba(7, 10, 26, 0.9)", "#ffdc3f");
    drawText(ctx, "ESCAPE THE PATCH NOTES", 152, 176, 44, "#ffffff", "bold");
    drawText(ctx, "A platformer slowly ruined by updates.", 162, 214, 20, "#87ffc4", "bold");
    drawText(ctx, this.run.finale.headline, 164, 270, 17, "#fff5d6", "bold");
    drawWrappedText(ctx, this.run.finale.note, 164, 296, 610, 17, "#cde9ff");
    if (this.bestScore > 0) {
      drawText(ctx, `Best release score ${this.bestScore}`, 164, 342, 16, "#ffdc3f", "bold");
    }
    drawTextPill(ctx, "ENTER RELEASE BOARD", 480, 378, "#111827", "#ffdc3f");
    this.hot(310, 358, 340, 34, () => { this.setMode("releaseBoard"); this.audio.play("start"); });
    drawText(ctx, "Space quick-starts · S settings · T touch controls", 186, 420, 13, "#cde9ff", "bold");
  }

  private drawReleaseBoard(): void {
    const ctx = this.ctx;
    const completed = levels.filter((level) => this.levelProgress[level.id]?.completed).length;
    const reports = levels.filter((level) => this.levelProgress[level.id]?.reportCollected).length;
    const golds = levels.filter((level) => this.levelProgress[level.id]?.bestMedal === "gold").length;
    const selected = levels[this.boardSelection];
    const selectedPatch = this.run.levels[this.boardSelection];
    const selectedProgress = this.levelProgress[selected.id];

    drawPanel(ctx, 36, 30, 888, 488, "rgba(7, 10, 26, 0.92)", "#70f5ff");
    drawText(ctx, "RELEASE BOARD", 68, 78, 34, "#ffffff", "bold");
    drawPanel(ctx, 796, 54, 106, 28, "rgba(0,0,0,0.4)", "#70f5ff");
    drawText(ctx, "← Title", 808, 73, 13, "#70f5ff", "bold");
    this.hot(796, 54, 106, 28, () => this.setMode("title"));
    drawText(ctx, `${completed}/11 shipped`, 554, 62, 15, "#87ffc4", "bold");
    drawText(ctx, `${reports}/11 reports`, 554, 84, 15, "#fff5d6", "bold");
    drawText(ctx, `${golds}/11 gold`, 724, 62, 15, "#ffdc3f", "bold");
    drawText(ctx, `Best ${this.bestScore || "--"}`, 724, 84, 15, "#cde9ff", "bold");
    drawText(ctx, "Arrows select   Enter deploy selected patch   Esc title", 68, 112, 14, "#9fc7ff", "bold");

    const columns = 3;
    const cardW = 278;
    const cardH = 70;
    const startX = 68;
    const startY = 126;
    const gapX = 14;
    const gapY = 9;

    for (let index = 0; index < levels.length; index += 1) {
      const level = levels[index];
      const patch = this.run.levels[index];
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);
      this.drawReleaseCard(
        ctx,
        level.id,
        patch,
        this.levelProgress[level.id],
        cx,
        cy,
        cardW,
        cardH,
        index === this.boardSelection,
      );
      this.hot(cx, cy, cardW, cardH, () => {
        this.boardSelection = index;
        this.startRunAt(index);
        this.audio.play("start");
      });
    }

    drawPanel(ctx, 68, 482, 856, 34, "rgba(12, 17, 39, 0.8)", selectedProgress?.completed ? "#ff9aa7" : "#87ffc4");
    drawText(
      ctx,
      selectedProgress?.completed
        ? `Selected Patch ${selectedPatch.version}: replay challenge unlocked. File the bug report for better medals.`
        : `Selected Patch ${selectedPatch.version}: first pass objective is only to reach the exit.`,
      84,
      505,
      14,
      selectedProgress?.completed ? "#ff9aa7" : "#87ffc4",
      "bold",
    );
  }

  private drawReleaseCard(
    ctx: CanvasRenderingContext2D,
    levelId: number,
    patch: LevelPatch,
    progress: LevelProgress | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
    selected: boolean,
  ): void {
    const completed = Boolean(progress?.completed);
    const stroke = selected ? "#ffdc3f" : completed ? "#87ffc4" : "#40517f";
    const fill = selected ? "rgba(32, 31, 65, 0.96)" : "rgba(10, 15, 36, 0.86)";

    drawPanel(ctx, x, y, w, h, fill, stroke);
    drawText(ctx, `${levelId}. ${patch.version}`, x + 12, y + 24, 16, selected ? "#ffdc3f" : "#ffffff", "bold");
    drawText(ctx, releaseBoardLabel(patch.modifier), x + 88, y + 24, 13, "#cde9ff", "bold");
    drawText(ctx, completed ? "CLEARED" : "UNSHIPPED", x + 12, y + 47, 13, completed ? "#87ffc4" : "#ff9aa7", "bold");
    drawText(ctx, completed ? "BONUS READY" : "BONUS LOCKED", x + 96, y + 47, 13, completed ? "#ff9aa7" : "#9fc7ff", "bold");
    drawText(ctx, `Medal ${progress?.bestMedal?.toUpperCase() ?? "--"}`, x + 12, y + 68, 12, progress?.bestMedal ? medalColor(progress.bestMedal) : "#7c8dbb", "bold");
    drawText(ctx, `Bug ${progress?.reportCollected ? "FILED" : completed ? "OPEN" : "--"}`, x + 116, y + 68, 12, progress?.reportCollected ? "#fff5d6" : "#7c8dbb", "bold");
    drawText(ctx, `Best ${formatTime(progress?.bestTime)}`, x + 204, y + 68, 12, "#cde9ff", "bold");
  }

  private drawPatchIntro(): void {
    const ctx = this.ctx;
    const patch = this.currentPatch();
    drawPanel(ctx, 132, 116, 696, 300, "rgba(7, 10, 26, 0.92)", severityColor(patch.severity));
    drawText(ctx, `PATCH ${patch.version}`, 174, 168, 24, severityColor(patch.severity), "bold");
    drawText(ctx, patch.headline, 174, 216, 33, "#ffffff", "bold");
    drawWrappedText(ctx, patch.note, 176, 258, 590, 18, "#cde9ff");
    drawText(ctx, patch.joke, 176, 330, 17, "#fff5d6", "bold");
    drawText(
      ctx,
      this.bonusChallengeActive ? "Replay objective: file the bug report before shipping." : "First pass objective: reach the exit.",
      176,
      362,
      16,
      this.bonusChallengeActive ? "#ff9aa7" : "#87ffc4",
      "bold",
    );
    drawTextPill(ctx, "ENTER TO SHIP", 480, 386, "#111827", severityColor(patch.severity));
    this.hot(350, 366, 260, 34, () => this.startPlaying(performance.now()));
  }

  private drawPausedScreen(): void {
    const ctx = this.ctx;
    drawPanel(ctx, 226, 168, 508, 210, "rgba(8, 11, 28, 0.93)", "#70f5ff");
    drawText(ctx, "Paused", 264, 222, 32, "#ffffff", "bold");
    drawText(ctx, "Esc continue · S settings · R restart", 264, 260, 14, "#cde9ff");
    drawText(ctx, `Move  ${keyLabel(this.bindings.left)} / ${keyLabel(this.bindings.right)}`, 264, 292, 13, "#9fc7ff");
    drawText(ctx, `Jump  ${keyLabel(this.bindings.jump)}   Pause  ${keyLabel(this.bindings.pause)}   M mute`, 264, 314, 13, "#9fc7ff");
    drawPanel(ctx, 310, 334, 148, 28, "rgba(0,0,0,0.4)", "#70f5ff");
    drawText(ctx, "► Resume", 326, 353, 13, "#70f5ff", "bold");
    this.hot(310, 334, 148, 28, () => this.setMode("playing"));
  }

  private drawGameOverScreen(): void {
    const ctx = this.ctx;
    drawPanel(ctx, 176, 148, 608, 244, "rgba(7, 10, 26, 0.93)", "#ff4f81");
    drawText(ctx, "GAME OVER", 228, 200, 36, "#ffffff", "bold");
    drawText(ctx, this.lastDeathReason || "Patch rejected", 228, 238, 16, "#ffdc3f", "bold");
    drawText(ctx, `${this.level.title} · Level ${this.levelIndex + 1}/11 · ${this.deaths} run deaths`, 228, 264, 14, "#9fc7ff");
    drawWrappedText(ctx, this.run.gameOverSummary, 228, 290, 520, 16, "#cde9ff");
    drawPanel(ctx, 346, 346, 148, 28, "rgba(0,0,0,0.4)", "#ff4f81");
    drawText(ctx, "Restart →", 358, 365, 13, "#ff4f81", "bold");
    this.hot(346, 346, 148, 28, () => { this.resetLevel(); this.startLevelIntro(); });
  }

  private drawLevelComplete(): void {
    const ctx = this.ctx;
    const patch = this.currentPatch();
    const result = this.results[this.levelIndex];
    const medal = result?.medal ?? "shipped";
    const h = this.bonusChallengeActive ? 230 : 200;
    drawPanel(ctx, 210, 166, 540, h, "rgba(8, 11, 28, 0.93)", medalColor(medal));
    drawText(ctx, "PATCH SHIPPED", 256, 222, 34, "#ffffff", "bold");
    drawText(ctx, `Patch ${patch.version}`, 258, 258, 18, "#cde9ff", "bold");
    drawText(ctx, medal.toUpperCase(), 420, 258, 22, medalColor(medal), "bold");
    if (result) {
      drawText(ctx, `${result.seconds.toFixed(1)}s  ·  ${result.coins} coins  ·  ${result.deaths}d`, 258, 284, 15, "#fff5d6");
    }
    if (this.bonusChallengeActive) {
      const filed = Boolean(this.level.bugReport?.collected);
      drawText(
        ctx,
        filed ? "BUG REPORT FILED" : "Bug report missed",
        258, 312, 15,
        filed ? "#ff9aa7" : "#7c8dbb",
        "bold",
      );
    }
    const nextY = this.bonusChallengeActive ? 352 : 322;
    drawText(ctx, "R replay   Enter continue release train", 258, nextY, 15, "#9fc7ff", "bold");
    this.hot(210, nextY - 18, 210, 26, () => { this.resetLevel(); this.startLevelIntro(); this.audio.play("restart"); });
    this.hot(420, nextY - 18, 330, 26, () => this.advanceLevel());
  }

  private drawWinScreen(): void {
    const ctx = this.ctx;
    const now = performance.now();
    const runPauseAdjust = this.runPauseStart > 0 ? now - this.runPauseStart : 0;
    const totalSeconds = Math.max(0, (now - this.runStartedAt - this.runPausedMs - runPauseAdjust) / 1000).toFixed(1);
    const score = scoreRun({
      seconds: Number(totalSeconds),
      deaths: this.deaths,
      coins: this.totalCoins,
      reports: this.totalReports,
      results: this.results,
    });
    if (score > this.bestScore) {
      this.bestScore = score;
      saveBestScore(score);
    }
    const grade = releaseGrade(score);
    const gradeColor = grade === "S" ? "#ffdc3f" : grade === "A" ? "#87ffc4" : grade === "B" ? "#cde9ff" : "#ff9a3d";

    drawPanel(ctx, 54, 26, 852, 488, "rgba(7, 10, 26, 0.93)", "#87ffc4");
    drawText(ctx, "ALL PATCHES DEPLOYED", 100, 82, 36, "#ffffff", "bold");

    drawText(ctx, `Grade ${grade}`, 100, 122, 22, gradeColor, "bold");
    drawText(ctx, `Score ${score}`, 248, 122, 20, "#ffdc3f", "bold");
    drawText(ctx, `Best ${this.bestScore}`, 510, 122, 16, "#87ffc4", "bold");
    drawText(ctx, `Bugs ${this.totalReports}/11`, 700, 122, 16, "#ff9aa7", "bold");
    drawText(ctx, `Time ${totalSeconds}s   Deaths ${this.deaths}   Coins ${this.totalCoins}`, 100, 148, 15, "#cde9ff", "bold");

    drawText(ctx, "Release Record", 100, 176, 14, "#ffffff", "bold");
    const colW = 266;
    const gridX = 100;
    const gridY = 194;
    const rowH = 24;
    for (let i = 0; i < this.results.length && i < 11; i++) {
      const result = this.results[i];
      const col = i % 3;
      const row = Math.floor(i / 3);
      const rx = gridX + col * colW;
      const ry = gridY + row * rowH;
      drawText(ctx, result.patch, rx, ry, 13, "#9fc7ff", "bold");
      drawText(ctx, result.medal.slice(0, 4).toUpperCase(), rx + 40, ry, 13, medalColor(result.medal), "bold");
      drawText(ctx, `${result.seconds.toFixed(1)}s`, rx + 96, ry, 12, "#fff5d6");
      if (result.report) drawText(ctx, "BUG", rx + 150, ry, 11, "#ff9aa7", "bold");
    }

    let ry = 310;
    for (const prompt of this.run.recapPrompts.slice(0, 3)) {
      drawText(ctx, `- ${prompt}`, 100, ry, 14, "#fff5d6");
      ry += 22;
    }

    drawText(ctx, this.shareUrl, 100, 378, 11, "#9fc7ff", "bold");

    drawTextPill(ctx, "R  NEW RUN", 228, 462, "#111827", "#ffdc3f");
    this.hot(116, 442, 224, 34, () => { this.startRunAt(0); this.audio.play("start"); });
    drawTextPill(ctx, "ENTER  RELEASE BOARD", 680, 462, "#111827", "#87ffc4");
    this.hot(488, 442, 384, 34, () => { this.setMode("releaseBoard"); this.audio.play("start"); });
  }

  private drawCenteredPanel(title: string, subtitle: string): void {
    const ctx = this.ctx;
    drawPanel(ctx, 260, 196, 440, 150, "rgba(8, 11, 28, 0.92)", "#70f5ff");
    drawText(ctx, title, 298, 252, 30, "#ffffff", "bold");
    drawText(ctx, subtitle, 298, 292, 16, "#cde9ff");
  }

  private currentPatch(): LevelPatch {
    return this.run.levels[this.levelIndex] ?? this.run.levels[0];
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 360 * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (particle.text) {
        drawText(ctx, particle.text, particle.x, particle.y, 14, particle.color, "bold");
      } else {
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      }
      ctx.restore();
    }
  }

  private burst(x: number, y: number, color: string, count: number, text?: string): void {
    if (text) {
      this.particles.push({
        x: x - 10,
        y: y - 16,
        vx: 0,
        vy: -90,
        life: 0.65,
        maxLife: 0.65,
        size: 1,
        color,
        text,
      });
    }

    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.35;
      const speed = 80 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.35 + Math.random() * 0.38,
        maxLife: 0.72,
        size: 3 + Math.random() * 4,
        color,
      });
    }
  }

  private shake(magnitude: number, duration: number): void {
    const now = performance.now();
    this.shakeMagnitude = now > this.shakeUntil ? magnitude : Math.max(this.shakeMagnitude, magnitude);
    this.shakeUntil = Math.max(this.shakeUntil, now + duration);
  }

  private beginLevelAttempt(): void {
    this.bonusChallengeActive = shouldShowBonusChallenge(this.levelProgress[this.level.id]);
  }

  private handleSettingsInput(code: string): void {
    if (this.rebindingFor !== null) {
      if (code === "Escape") {
        this.rebindingFor = null;
      } else {
        this.bindings = { ...this.bindings, [this.rebindingFor]: code };
        saveBindings(this.bindings);
        this.rebindingFor = null;
      }
      return;
    }
    if (code === "Escape") { this.setMode(this.settingsPrevMode); return; }
    if (code === "ArrowUp")   { this.settingsRow = (this.settingsRow - 1 + SETTINGS_ROWS) % SETTINGS_ROWS; return; }
    if (code === "ArrowDown") { this.settingsRow = (this.settingsRow + 1) % SETTINGS_ROWS; return; }
    if (code === "Enter" || code === "Space") this.activateSettingsRow();
  }

  private activateSettingsRow(): void {
    switch (this.settingsRow) {
      case 0: this.editPlayerName(); break;
      case 1: this.rebindingFor = "left"; break;
      case 2: this.rebindingFor = "right"; break;
      case 3: this.rebindingFor = "jump"; break;
      case 4: this.rebindingFor = "pause"; break;
      case 5: document.dispatchEvent(new CustomEvent("touchControlsToggle")); break;
    }
  }

  private editPlayerName(): void {
    const input = document.getElementById("name-input") as HTMLInputElement | null;
    if (!input) return;
    input.value = this.playerName;
    input.classList.add("editing");
    input.focus();
    input.select();
    const finish = () => {
      const trimmed = input.value.trim().slice(0, 24);
      this.playerName = trimmed;
      savePlayerName(trimmed);
      input.classList.remove("editing");
      input.removeEventListener("keydown", onKey);
      input.removeEventListener("blur", onBlur);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); }
    };
    const onBlur = () => finish();
    input.addEventListener("keydown", onKey);
    input.addEventListener("blur", onBlur, { once: true });
  }

  private drawSettings(): void {
    const ctx = this.ctx;
    const row = this.settingsRow;
    const rebinding = this.rebindingFor !== null;

    drawPanel(ctx, 80, 26, 800, 488, "rgba(7, 10, 26, 0.95)", "#7767ff");
    drawText(ctx, "SETTINGS", 118, 80, 30, "#ffffff", "bold");
    drawPanel(ctx, 746, 58, 112, 28, "rgba(0,0,0,0.4)", "#9fc7ff");
    drawText(ctx, "← Back", 758, 77, 13, "#9fc7ff", "bold");
    this.hot(746, 58, 112, 28, () => this.setMode(this.settingsPrevMode));

    // ── Player Name ──────────────────────────────────────────
    if (row === 0) {
      ctx.fillStyle = "rgba(119,103,255,0.16)";
      ctx.fillRect(98, 102, 764, 40);
    }
    drawText(ctx, "Player Name", 118, 130, 15, "#cde9ff", "bold");
    drawPanel(ctx, 300, 107, 340, 28, "rgba(0,0,0,0.45)", row === 0 ? "#7767ff" : "#40517f");
    drawText(ctx, this.playerName || "(no name set)", 314, 128, 14, this.playerName ? "#ffffff" : "#9fc7ff");
    if (row === 0) drawText(ctx, "Enter to edit", 660, 130, 12, "#7767ff");
    this.hot(98, 102, 764, 40, () => { this.settingsRow = 0; if (!rebinding) this.activateSettingsRow(); });

    // ── Current Level ─────────────────────────────────────────
    const patch = this.currentPatch();
    drawText(ctx, `Level ${this.levelIndex + 1}  ·  ${this.level.title}  ·  ${patch.headline}`, 118, 164, 13, "rgba(156,199,255,0.7)");

    // ── Controls ─────────────────────────────────────────────
    drawText(ctx, "Controls", 118, 198, 14, "#ffffff", "bold");

    const bindRows: Array<[number, string, keyof Bindings]> = [
      [1, "Move Left",  "left"],
      [2, "Move Right", "right"],
      [3, "Jump",       "jump"],
      [4, "Pause / Back", "pause"],
    ];

    for (const [rowIdx, label, action] of bindRows) {
      const y = 213 + (rowIdx - 1) * 34;
      const isRow = row === rowIdx;
      const isRebinding = isRow && rebinding && this.rebindingFor === action;

      if (isRow) {
        ctx.fillStyle = "rgba(119,103,255,0.16)";
        ctx.fillRect(98, y - 2, 764, 30);
      }
      drawText(ctx, label, 118, y + 18, 14, isRow ? "#ffffff" : "#cde9ff", "bold");
      const pillBorder = isRebinding ? "#ffdc3f" : isRow ? "#7767ff" : "#40517f";
      const pillText = isRebinding ? "Press any key…" : keyLabel(this.bindings[action]);
      drawPanel(ctx, 350, y + 2, 200, 22, "rgba(0,0,0,0.45)", pillBorder);
      drawText(ctx, pillText, 360, y + 18, 12, isRebinding ? "#ffdc3f" : "#cde9ff", "bold");
      if (isRow && !isRebinding) drawText(ctx, "Enter to rebind", 564, y + 18, 11, "#7767ff");
      this.hot(98, y - 2, 764, 30, () => {
        if (rebinding) { this.rebindingFor = null; return; }
        this.settingsRow = rowIdx;
        this.activateSettingsRow();
      });
    }

    drawText(ctx, "Jump also accepts: W · ↑ Arrow", 118, 355, 12, "rgba(156,199,255,0.45)");

    // ── Touch Controls ────────────────────────────────────────
    drawText(ctx, "Options", 118, 380, 14, "#ffffff", "bold");
    const touchOn = isTouchEnabled();
    if (row === 5) {
      ctx.fillStyle = "rgba(119,103,255,0.16)";
      ctx.fillRect(98, 390, 764, 38);
    }
    drawText(ctx, "Touch Controls", 118, 416, 14, row === 5 ? "#ffffff" : "#cde9ff", "bold");
    const touchBorder = touchOn ? "#87ffc4" : "#ff9aa7";
    drawPanel(ctx, 340, 394, 80, 22, "rgba(0,0,0,0.45)", touchBorder);
    drawText(ctx, touchOn ? "ON" : "OFF", touchOn ? 354 : 352, 410, 13, touchBorder, "bold");
    if (row === 5) drawText(ctx, "Enter to toggle", 434, 410, 11, "#7767ff");
    this.hot(98, 390, 764, 38, () => { this.settingsRow = 5; this.activateSettingsRow(); });

    drawText(ctx, "↑ ↓  navigate     Enter  activate     Esc  back", 118, 462, 12, "rgba(156,199,255,0.4)");
  }

  private installDebugHooks(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    window.__patchNotesDebug = {
      snapshot: () => this.debugSnapshot(),
      startLevel: (levelNumber: number) => {
        this.startRunAt(levelNumber - 1);
        return this.debugSnapshot();
      },
      completeLevel: (seconds?: number) => {
        const elapsed = seconds ?? Math.max(1, this.currentPatch().targetTime * 0.8);
        const now = performance.now();
        if (this.mode !== "playing") {
          this.startPlaying(now);
        }
        this.levelStartedAt = now - elapsed * 1000;
        this.completeLevel(now);
        return this.debugSnapshot();
      },
      collectReport: () => {
        if (this.bonusChallengeActive && this.level.bugReport) {
          this.level.bugReport.collected = true;
        }
        this.setStatus();
        return this.debugSnapshot();
      },
      setCompleted: (levelNumber: number, progress: Partial<LevelProgress> = {}) => {
        this.levelProgress = {
          ...this.levelProgress,
          [levelNumber]: {
            completed: true,
            ...progress,
          },
        };
        saveLevelProgress(this.levelProgress);
        this.setStatus();
        return this.debugSnapshot();
      },
      resetProgress: () => {
        this.levelProgress = {};
        saveLevelProgress(this.levelProgress);
        this.setStatus();
        return this.debugSnapshot();
      },
    };
  }

  private debugSnapshot(): DebugSnapshot {
    return {
      mode: this.mode,
      level: this.levelIndex + 1,
      bonusChallenge: this.bonusChallengeActive,
      reportVisible: Boolean(this.bonusChallengeActive && this.level.bugReport && !this.level.bugReport.collected),
      reportCollected: Boolean(this.level.bugReport?.collected),
      coins: this.levelCoins,
      deaths: this.deaths,
      progress: this.levelProgress,
    };
  }
}

async function loadRun(): Promise<PatchRun> {
  const params = new URLSearchParams(location.search);
  const seed = params.get("seed") ?? "";
  const fallback = createFallbackRun(seed);

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed, difficulty: "normal" }),
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as PatchRun;
  } catch {
    return fallback;
  }
}

function loadBestScore(): number {
  try {
    return Number(localStorage.getItem("escapePatchNotesBest") ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    localStorage.setItem("escapePatchNotesBest", String(score));
  } catch {
    // Local storage can be unavailable in privacy modes; the run should still finish.
  }
}

function loadLevelProgress(): LevelProgressMap {
  try {
    return parseLevelProgress(localStorage.getItem(LEVEL_PROGRESS_KEY));
  } catch {
    return {};
  }
}

function saveLevelProgress(progress: LevelProgressMap): void {
  try {
    localStorage.setItem(LEVEL_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Progress persistence is a bonus; gameplay still works without it.
  }
}

function formatTime(seconds: number | undefined): string {
  return seconds === undefined ? "--" : `${seconds.toFixed(1)}s`;
}

function releaseBoardLabel(modifier: PatchModifier): string {
  switch (modifier) {
    case "base":
      return "Basic release";
    case "jump_nerf":
      return "Jump nerfed";
    case "coin_spike_magnet":
      return "Coins pull spikes";
    case "rotated_gravity":
      return "Sideways gravity";
    case "crumbling_platforms":
      return "Crumbling floors";
    case "exit_fee":
      return "Paid exit";
    case "slippery_floor":
      return "Slippery floors";
    case "async_platforms":
      return "Blinking platforms";
    case "rollback_token":
      return "Rollback tokens";
    case "moving_exit":
      return "Moving exit";
    case "finale_combo":
      return "Stability bundle";
  }
}

function gravityVector(mode: GravityMode): Vec2 {
  return mode === "right" ? { x: 1, y: 0 } : { x: 0, y: 1 };
}

function lateralVector(mode: GravityMode): Vec2 {
  return mode === "right" ? { x: 0, y: 1 } : { x: 1, y: 0 };
}

function nearestPulse(center: Vec2, pulses: MagnetPulse[]): Vec2 {
  let best = pulses[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const pulse of pulses) {
    const score = distance(center, pulse);
    if (score < bestDistance) {
      best = pulse;
      bestDistance = score;
    }
  }
  return best;
}

function drawRect(ctx: CanvasRenderingContext2D, rect: Rect, fill: string, stroke: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
}

function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x + 4, y + 4, w - 8, 2);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight: "normal" | "bold" = "normal",
): void {
  ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color: string,
): void {
  const words = text.split(" ");
  let line = "";
  let offset = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      drawText(ctx, line, x, y + offset, 15, color);
      line = word;
      offset += lineHeight;
    } else {
      line = test;
    }
  }

  if (line) {
    drawText(ctx, line, x, y + offset, 15, color);
  }
}

function drawTextPill(ctx: CanvasRenderingContext2D, text: string, centerX: number, centerY: number, color: string, fill: string): void {
  ctx.font = "bold 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const width = Math.ceil(ctx.measureText(text).width + 34);
  const x = centerX - width / 2;
  const y = centerY - 20;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, 34);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, 32);
  ctx.fillStyle = color;
  ctx.fillText(text, x + 17, y + 23);
}

function severityLabel(severity: LevelPatch["severity"]): string {
  return severity === "stable" ? "STABLE" : severity === "rollback" ? "ROLLBACK" : `${severity.toUpperCase()} PATCH`;
}

function severityColor(severity: LevelPatch["severity"]): string {
  if (severity === "stable") return "#87ffc4";
  if (severity === "minor") return "#ffdc3f";
  if (severity === "major") return "#ff9a3d";
  if (severity === "rollback") return "#70f5ff";
  return "#ff4f81";
}

// ── Settings persistence ──────────────────────────────────────

const BINDINGS_KEY = "escapePatchNotesBindings";
const PLAYER_NAME_KEY = "escapePatchNotesName";

function loadBindings(): Bindings {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const p = JSON.parse(raw) as Partial<Bindings>;
    return {
      left:  typeof p.left  === "string" ? p.left  : DEFAULT_BINDINGS.left,
      right: typeof p.right === "string" ? p.right : DEFAULT_BINDINGS.right,
      jump:  typeof p.jump  === "string" ? p.jump  : DEFAULT_BINDINGS.jump,
      pause: typeof p.pause === "string" ? p.pause : DEFAULT_BINDINGS.pause,
    };
  } catch { return { ...DEFAULT_BINDINGS }; }
}

function saveBindings(b: Bindings): void {
  try { localStorage.setItem(BINDINGS_KEY, JSON.stringify(b)); } catch {}
}

function loadPlayerName(): string {
  try { return localStorage.getItem(PLAYER_NAME_KEY) ?? ""; } catch { return ""; }
}

function savePlayerName(name: string): void {
  try { localStorage.setItem(PLAYER_NAME_KEY, name); } catch {}
}

function isTouchEnabled(): boolean {
  try { return localStorage.getItem("escapePatchNotesTouch") === "true"; } catch { return false; }
}

function hexLighter(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const r = Math.min(255, parseInt(c.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(c.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(c.slice(4, 6), 16) + amount);
  return `${r},${g},${b}`;
}

function keyLabel(code: string): string {
  const map: Record<string, string> = {
    ArrowLeft: "← Arrow", ArrowRight: "→ Arrow", ArrowUp: "↑ Arrow", ArrowDown: "↓ Arrow",
    Space: "Space", Escape: "Escape", Enter: "Enter", Tab: "Tab",
    ShiftLeft: "L Shift", ShiftRight: "R Shift",
    ControlLeft: "L Ctrl", ControlRight: "R Ctrl",
    AltLeft: "L Alt", AltRight: "R Alt",
  };
  if (code in map) return map[code];
  if (/^Key[A-Z]$/.test(code)) return code[3];
  if (/^Digit\d$/.test(code)) return code[5];
  return code;
}

class AudioBus {
  muted = false;
  private ctx?: AudioContext;
  private masterGain?: GainNode;
  private musicGain?: GainNode;
  private musicBeat = 0;
  private musicNextTime = 0;
  private musicTimer = 0;
  private musicRunning = false;

  // Simple chiptune: two 16-note phrases that loop
  private static readonly MELODY = [
    523, 659, 784, 1047, 659, 587, 523, 494,
    523, 440, 523, 659,  784, 659, 523, 0,
    523, 0,   659, 784,  1047,784, 659, 0,
    523, 659, 523, 440,  523, 0,   494, 0,
  ];
  private static readonly BEAT = 0.182;

  toggle(): void {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.06);
    }
  }

  startMusic(): void {
    if (this.musicRunning || !this.ctx || !this.masterGain) return;
    this.musicRunning = true;
    const mg = this.ctx.createGain();
    mg.gain.value = 0.022;
    mg.connect(this.masterGain);
    this.musicGain = mg;
    this.musicBeat = 0;
    this.musicNextTime = this.ctx.currentTime + 0.2;
    this.pumpMusic();
  }

  private pumpMusic(): void {
    if (!this.ctx || !this.musicGain || !this.musicRunning) return;
    const ahead = 0.4;
    while (this.musicNextTime < this.ctx.currentTime + ahead) {
      const freq = AudioBus.MELODY[this.musicBeat % AudioBus.MELODY.length];
      if (freq > 0) this.scheduleChipNote(this.musicNextTime, freq, AudioBus.BEAT * 0.76);
      this.musicBeat++;
      this.musicNextTime += AudioBus.BEAT;
    }
    this.musicTimer = window.setTimeout(() => this.pumpMusic(), 110);
  }

  private scheduleChipNote(time: number, freq: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(1, time + 0.008);
    env.gain.setValueAtTime(1, time + dur * 0.55);
    env.gain.linearRampToValueAtTime(0.0001, time + dur);
    osc.connect(env).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  play(kind: "start" | "jump" | "coin" | "rollback" | "break" | "die" | "error" | "restart" | "complete" | "win" | "intro"): void {
    this.ensureCtx();
    if (!this.musicRunning) this.startMusic();
    if (this.muted || !this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const freqs: Record<string, number> = {
      start: 440, jump: 520, coin: 760, rollback: 320,
      break: 170, die: 90, error: 130, restart: 240,
      complete: 660, win: 880, intro: 380,
    };
    const f = freqs[kind] ?? 440;
    const duration = kind === "win" ? 0.34 : kind === "intro" ? 0.2 : 0.12;
    osc.type = kind === "die" || kind === "break" ? "sawtooth" : kind === "intro" ? "triangle" : "square";
    osc.frequency.setValueAtTime(f, now);
    if (kind === "intro") {
      osc.frequency.exponentialRampToValueAtTime(f * 1.6, now + duration);
    } else {
      osc.frequency.exponentialRampToValueAtTime(Math.max(50, f * 0.6), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private ensureCtx(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);
    }
  }
}
