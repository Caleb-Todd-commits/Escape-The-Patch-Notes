import {
  levels,
  cloneLevel,
  type BugReport,
  type Coin,
  type GravityMode,
  type JumpPad,
  type LevelDefinition,
  type LockdownDoor,
  type Platform,
  type PlasmaVent,
  type RollbackToken,
  type SecuritySensor,
  type Spike,
  type SweepLaser,
  type TeslaArc,
  type TimedHazardRect,
  type TrackHazard,
} from "./levels";
import {
  canUseExit,
  clamp,
  computeSpikeMagnetVelocity,
  distance,
  doubleJumpImpulse,
  frictionForModifier,
  intersects,
  isPlatformActive,
  isTimedHazardActive,
  isTimedHazardWarning,
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
  | "exhibitionIntro"
  | "devDialog"
  | "chapterIntro"
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
  airJumpsUsed: number;
}

interface PlatformState extends Platform {
  broken?: boolean;
  standTime?: number;
  baseX?: number;
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

interface MovingTechState extends TrackHazard {
  baseX: number;
  baseY: number;
}

interface SweepLaserState extends SweepLaser {
  baseX: number;
  baseY: number;
}

interface SecuritySensorState extends SecuritySensor {
  triggered?: boolean;
}

interface LevelState extends Omit<LevelDefinition, "platforms" | "coins" | "spikes" | "tokens" | "bugReport"> {
  platforms: PlatformState[];
  coins: CoinState[];
  spikes: SpikeState[];
  tokens: RollbackTokenState[];
  bugReport?: BugReportState;
  laserGates: TimedHazardRect[];
  sweepLasers: SweepLaserState[];
  razors: MovingTechState[];
  crushers: MovingTechState[];
  teslaArcs: TeslaArc[];
  sensors: SecuritySensorState[];
  plasmaVents: PlasmaVent[];
  jumpPads: JumpPad[];
  doors: LockdownDoor[];
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
  highlightRunActive: boolean;
  doubleJumpUnlocked: boolean;
  challengeComplete: boolean;
  reportVisible: boolean;
  reportCollected: boolean;
  coins: number;
  deaths: number;
  progress: LevelProgressMap;
}

interface PatchNotesDebug {
  snapshot: () => DebugSnapshot;
  startLevel: (levelNumber: number) => DebugSnapshot;
  startExhibition: () => DebugSnapshot;
  startHighlights: () => DebugSnapshot;
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
const SETTINGS_ROWS = 8; // name, left, right, jump, pause, touch, game select, factory reset
const CHAPTER_TWO_START_INDEX = Math.max(0, levels.findIndex((level) => level.chapter === "production_floor"));
const EXHIBITION_SEQUENCE = [2, 3, 24, 27, 34, 43, 49];
const HIGHLIGHT_SEQUENCE = EXHIBITION_SEQUENCE;
const JUDGE_HIGHLIGHTS = EXHIBITION_SEQUENCE;

const VIEW_W = 960;
const VIEW_H = 540;
const PLAYER_SPEED = 245;
const ACCEL = 1800;
const GRAVITY = 1420;
const MAX_FALL = 780;
const COYOTE_MS = 105;
const JUMP_BUFFER_MS = 130;
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
type EngineerMood = "confident" | "worried" | "proud" | "exhausted";

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
  private huntUntil = 0;
  private themeFlashUntil = 0;
  private themeFlashColor = "";
  private devDialogSlide = 0;
  private devDialogLines: string[] = [];
  private devDialogProceed: (() => void) | null = null;
  private resetConfirmPending = false;
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
  private jumpBufferedUntil = 0;
  private coyoteUntil = 0;
  private jumpHeld = false;
  private secondJumpUsed = false;
  private rollbackUses = 0;
  private sensorTrips = 0;
  private lockdownUntil = 0;
  private lastJumpPadId = "";
  private exitedPadIndex = 0;
  private highlightRunActive = false;
  private highlightStep = 0;
  private chapterIntroShown = false;
  private chapterIntroProceed: (() => void) | null = null;
  private doubleJumpUnlockUntil = 0;
  private medalRevealUntil = 0;
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
  private jumpToLevelValue = 1;
  private facing: "right" | "left" = "right";
  private camera = { x: 0, y: 0 };
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

      if (event.code === "Escape" && (this.mode === "releaseBoard" || this.mode === "exhibitionIntro")) {
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

      if (event.code === "KeyH" && this.mode === "title") {
        this.startExhibitionRun();
        this.audio.play("start");
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
        if (this.mode === "devDialog") {
          this.advanceDevDialog();
          return;
        }

        if (this.mode === "chapterIntro") {
          this.advanceChapterIntro();
          return;
        }

        if (this.mode === "exhibitionIntro") {
          this.beginExhibition();
          return;
        }

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

      if (!event.repeat && this.isJumpCode(event.code)) {
        this.jumpQueued = true;
        this.jumpHeld = true;
        this.jumpBufferedUntil = performance.now() + JUMP_BUFFER_MS;
      }

      this.keys.add(event.code);
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      if (this.isJumpCode(event.code)) {
        this.jumpHeld = false;
        this.cutJumpVelocity();
      }
    });

    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.mode === "devDialog") {
        this.advanceDevDialog();
        return;
      }
      if (this.mode === "chapterIntro") {
        this.advanceChapterIntro();
        return;
      }
      if (this.mode === "exhibitionIntro") {
        this.beginExhibition();
        return;
      }
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
    this.highlightRunActive = false;
    this.highlightStep = 0;
    this.chapterIntroShown = false;
    this.runStartedAt = performance.now();
    this.runPausedMs = 0;
    this.runPauseStart = 0;
    this.resetLevel();
  }

  private resetLevel(): void {
    const definition = cloneLevel(levels[this.levelIndex]);
    this.level = {
      ...definition,
      platforms: definition.platforms.map((item) => ({
        ...item,
        standTime: 0,
        baseX: item.kind === "moving" ? item.x : undefined,
      })),
      coins: definition.coins.map((item) => ({ ...item, collected: false })),
      spikes: definition.spikes.map((item) => ({ ...item, baseX: item.x, baseY: item.y, vx: 0, vy: 0 })),
      tokens: (definition.tokens ?? []).map((item) => ({ ...item, collected: false })),
      bugReport: definition.bugReport ? { ...definition.bugReport, collected: false } : undefined,
      laserGates: (definition.laserGates ?? []).map((item) => ({ ...item })),
      sweepLasers: (definition.sweepLasers ?? []).map((item) => ({ ...item, baseX: item.x, baseY: item.y })),
      razors: (definition.razors ?? []).map((item) => ({ ...item, baseX: item.x, baseY: item.y })),
      crushers: (definition.crushers ?? []).map((item) => ({ ...item, baseX: item.x, baseY: item.y })),
      teslaArcs: (definition.teslaArcs ?? []).map((item) => ({ ...item })),
      sensors: (definition.sensors ?? []).map((item) => ({ ...item, triggered: false })),
      plasmaVents: (definition.plasmaVents ?? []).map((item) => ({ ...item })),
      jumpPads: (definition.jumpPads ?? []).map((item) => ({ ...item })),
      doors: (definition.doors ?? []).map((item) => ({ ...item })),
    };
    this.player = {
      ...definition.start,
      vx: 0,
      vy: 0,
      grounded: false,
      airJumpsUsed: 0,
    };
    this.levelCoins = 0;
    this.rollbackUntil = 0;
    this.jumpQueued = false;
    this.jumpBufferedUntil = 0;
    this.coyoteUntil = 0;
    this.jumpHeld = false;
    this.rollbackUses = 0;
    this.secondJumpUsed = false;
    this.sensorTrips = 0;
    this.lockdownUntil = 0;
    this.lastJumpPadId = "";
    this.exitedPadIndex = 0;
    this.magnetPulses = [];
    this.huntUntil = 0;
    this.bonusChallengeActive = false;
    this.message = "";
    this.messageUntil = 0;
    this.medalRevealUntil = 0;
    this.levelStartedAt = performance.now();
    this.levelPausedMs = 0;
    this.levelPauseStart = 0;
    this.camera = { x: 0, y: 0 };
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

  private updateCamera(): void {
    const bw = this.level.bounds.w;
    const bh = this.level.bounds.h;
    const leadX = clamp(this.player.vx * 0.16, -118, 118);
    const leadY = clamp(this.player.vy * 0.08, -56, 74);
    const tx = clamp(this.player.x + this.player.w / 2 + leadX - VIEW_W / 2, 0, Math.max(0, bw - VIEW_W));
    const ty = clamp(this.player.y + this.player.h / 2 + leadY - VIEW_H / 2, 0, Math.max(0, bh - VIEW_H));
    this.camera.x += (tx - this.camera.x) * 0.14;
    this.camera.y += (ty - this.camera.y) * 0.14;
    if (Math.abs(tx - this.camera.x) < 0.5) this.camera.x = tx;
    if (Math.abs(ty - this.camera.y) < 0.5) this.camera.y = ty;
  }

  private updateMovingPlatforms(dt: number, time: number): void {
    if (!this.isModifierLive("moving_platforms_h")) return;
    const elapsed = this.levelElapsed(time);
    for (const platform of this.level.platforms) {
      if (platform.kind !== "moving" || platform.baseX === undefined) continue;
      const range = platform.moveRange ?? 80;
      const speed = platform.moveSpeed ?? 0.45;
      const newX = platform.baseX + Math.sin(elapsed * speed * Math.PI * 2 + (platform.phase ?? 0)) * range;
      const dx = newX - platform.x;
      platform.x = newX;
      if (this.groundedPlatformId === platform.id) {
        this.player.x += dx;
      }
    }
  }

  private updateModernHazards(time: number): void {
    const elapsed = this.levelElapsed(time);
    for (const hazard of [...this.level.sweepLasers, ...this.level.razors, ...this.level.crushers]) {
      const wave = Math.sin(elapsed * hazard.speed * Math.PI * 2 + (hazard.phase ?? 0));
      if (hazard.axis === "x") {
        hazard.x = hazard.baseX + wave * hazard.range;
        hazard.y = hazard.baseY;
      } else {
        hazard.x = hazard.baseX;
        hazard.y = hazard.baseY + wave * hazard.range;
      }
    }
  }

  private update(dt: number, time: number): void {
    this.updatePlayer(dt, time);
    if (this.mode !== "playing") return;
    this.updateMovingPlatforms(dt, time);
    if (this.mode !== "playing") return;
    this.updateCrumblingPlatforms(dt);
    if (this.mode !== "playing") return;
    this.updateModernHazards(time);
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

    if (this.player.grounded) {
      this.coyoteUntil = time + COYOTE_MS;
    }

    if (lateral.x !== 0) {
      this.player.vx += input * ACCEL * dt;
      if (input === 0) {
        this.player.vx -= clamp(this.player.vx, -friction * PLAYER_SPEED * dt, friction * PLAYER_SPEED * dt);
      }
      if (this.level.wind && !rollbackActive) {
        this.player.vx += this.level.wind * dt;
      }
      this.player.vx = clamp(this.player.vx, -PLAYER_SPEED, PLAYER_SPEED);
    } else {
      this.player.vy += input * ACCEL * dt;
      if (input === 0) {
        this.player.vy -= clamp(this.player.vy, -friction * PLAYER_SPEED * dt, friction * PLAYER_SPEED * dt);
      }
      this.player.vy = clamp(this.player.vy, -PLAYER_SPEED, PLAYER_SPEED);
    }

    const jumpRequested = this.jumpQueued || time <= this.jumpBufferedUntil;
    const groundedEnough = this.player.grounded || time <= this.coyoteUntil;
    if (jumpRequested && groundedEnough) {
      const jump = jumpImpulseForModifier(this.level.modifier, rollbackActive);
      if (gravity.x !== 0 && this.player.vx * gravity.x > 0) {
        this.player.vx = 0;
      }
      if (gravity.y !== 0 && this.player.vy * gravity.y > 0) {
        this.player.vy = 0;
      }
      this.player.vx += -gravity.x * jump;
      this.player.vy += -gravity.y * jump;
      this.player.grounded = false;
      this.player.airJumpsUsed = 0;
      this.coyoteUntil = 0;
      this.jumpQueued = false;
      this.jumpBufferedUntil = 0;
      this.audio.play("jump");
    } else if (jumpRequested && this.canDoubleJump()) {
      const jump = doubleJumpImpulse(jumpImpulseForModifier(this.level.modifier, rollbackActive));
      if (gravity.x !== 0 && this.player.vx * gravity.x > 0) {
        this.player.vx = 0;
      }
      if (gravity.y !== 0 && this.player.vy * gravity.y > 0) {
        this.player.vy = 0;
      }
      this.player.vx += -gravity.x * jump;
      this.player.vy += -gravity.y * jump;
      this.player.airJumpsUsed += 1;
      this.secondJumpUsed = true;
      this.jumpQueued = false;
      this.jumpBufferedUntil = 0;
      this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, "#70f5ff", 20, "AIR");
      this.shake(3, 120);
      this.audio.play("doubleJump");
    } else if (time > this.jumpBufferedUntil) {
      this.jumpQueued = false;
    }

    this.player.vx += gravity.x * GRAVITY * dt;
    this.player.vy += gravity.y * GRAVITY * dt;
    this.player.vx = clamp(this.player.vx, -MAX_FALL, MAX_FALL);
    this.player.vy = clamp(this.player.vy, -MAX_FALL, MAX_FALL);

    const wasGrounded = this.player.grounded;
    this.moveAndCollide(dt, time);
    if (!wasGrounded && this.player.grounded) {
      this.coyoteUntil = time + COYOTE_MS;
      const center = rectCenter(this.player);
      this.burst(center.x, center.y + this.player.h / 2, "#cde9ff", 8);
    }
    this.applyConveyor(dt);
    this.applyJumpPads();

    if (lateral.x !== 0 && input !== 0) {
      this.facing = input > 0 ? "right" : "left";
    }

    const b = this.level.bounds;
    if (
      this.player.x < b.x - 80 ||
      this.player.x > b.x + b.w + 80 ||
      this.player.y < b.y - 80 ||
      this.player.y > b.y + b.h + 80
    ) {
      this.die("Patched out of bounds");
    }
  }

  private moveAndCollide(dt: number, time: number): void {
    const gravity = gravityVector(this.level.gravity);
    const solids = this.activeCollisionSolids(time);
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

    if (this.player.grounded) {
      this.player.airJumpsUsed = 0;
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

  private activeCollisionSolids(time: number): Array<Rect & { id: string }> {
    return [...this.activePlatforms(time), ...this.activeDoors(time)];
  }

  private activeDoors(time: number): LockdownDoor[] {
    const elapsed = this.levelElapsed(time);
    return this.level.doors.filter((door) => {
      if (door.requiredCoins !== undefined && this.levelCoins >= door.requiredCoins) {
        return false;
      }

      if (door.opensAfter !== undefined && elapsed >= door.opensAfter) {
        return false;
      }

      if (door.linkedToLockdown) {
        return time < this.lockdownUntil;
      }

      return door.requiredCoins !== undefined || door.opensAfter !== undefined;
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
    const hunting = magnetLive && time < this.huntUntil;

    for (const spike of this.level.spikes) {
      if (!magnetLive) {
        spike.vx = (spike.vx ?? 0) * 0.9;
        spike.vy = (spike.vy ?? 0) * 0.9;
      } else if (hunting) {
        // Direct player-tracking hunt mode
        const sc = rectCenter(spike);
        const pc = rectCenter(this.player);
        const dx = pc.x - sc.x;
        const dy = pc.y - sc.y;
        const dist = Math.hypot(dx, dy) || 1;
        const HUNT_SPEED = 210;
        spike.vx = clamp((spike.vx ?? 0) + (dx / dist) * HUNT_SPEED * dt * 2.5, -210, 210);
        spike.vy = clamp((spike.vy ?? 0) + (dy / dist) * HUNT_SPEED * dt * 2.5, -210, 210);

        // Platform steering: when a solid is blocking, nudge perpendicular to go around it
        const nextX = spike.x + (spike.vx ?? 0) * dt * 2;
        const nextY = spike.y + (spike.vy ?? 0) * dt * 2;
        const projected = { x: nextX, y: nextY, w: spike.w, h: spike.h };
        for (const platform of this.activePlatforms(time)) {
          if (intersects(projected, platform)) {
            const pcx = platform.x + platform.w / 2;
            const pcy = platform.y + platform.h / 2;
            const spx = spike.x + spike.w / 2;
            const spy = spike.y + spike.h / 2;
            const perpX = spy - pcy;
            const perpY = -(spx - pcx);
            const plen = Math.hypot(perpX, perpY) || 1;
            spike.vx = clamp((spike.vx ?? 0) + (perpX / plen) * 120 * dt, -210, 210);
            spike.vy = clamp((spike.vy ?? 0) + (perpY / plen) * 120 * dt, -210, 210);
            break;
          }
        }
      } else if (this.magnetPulses.length > 0) {
        const center = rectCenter(spike);
        const target = nearestPulse(center, this.magnetPulses);
        const velocity = computeSpikeMagnetVelocity(center, target, 92, 260);
        spike.vx = clamp((spike.vx ?? 0) + velocity.x * dt * 3, -110, 110);
        spike.vy = clamp((spike.vy ?? 0) + velocity.y * dt * 3, -110, 110);
      } else {
        spike.vx = (spike.vx ?? 0) * 0.9;
        spike.vy = (spike.vy ?? 0) * 0.9;
      }

      spike.x += (spike.vx ?? 0) * dt;
      spike.y += (spike.vy ?? 0) * dt;
      // Larger roam range during hunt, tight during ghost-pulse mode
      const rx = hunting ? 130 : 46;
      const ry = hunting ? 90 : 36;
      spike.x = clamp(spike.x, spike.baseX - rx, spike.baseX + rx);
      spike.y = clamp(spike.y, spike.baseY - ry, spike.baseY + ry);
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
      if (this.isModifierLive("coin_spike_magnet")) {
        this.huntUntil = Math.max(this.huntUntil, time + 2800);
      }
      this.burst(coin.x, coin.y, "#ffdc3f", 10);
      this.audio.play("coin");
    }

    for (const token of this.level.tokens) {
      if (token.collected || distance(playerCenter, token) > token.r + 22) {
        continue;
      }

      token.collected = true;
      this.rollbackUses += 1;
      this.rollbackUntil = Math.max(this.rollbackUntil, time + token.seconds * 1000);
      this.toast("Rollback window open");
      this.burst(token.x, token.y, "#87ffc4", 16);
      this.shake(4, 180);
      this.audio.play("rollback");
    }

    const report = this.bonusChallengeActive && this.challengeType() === "bug_report" ? this.level.bugReport : undefined;
    if (report && !report.collected && distance(playerCenter, report) <= report.r + 22) {
      report.collected = true;
      this.toast(`Bug filed: ${report.title}`);
      this.burst(report.x, report.y, "#ff9aa7", 20, "BUG");
      this.shake(5, 190);
      this.audio.play("coin");
    }
  }

  private checkHazards(time: number): void {
    this.checkSecuritySensors(time);
    if (this.mode !== "playing") return;

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

    if (this.checkModernHazards(time)) {
      return;
    }
  }

  private checkSecuritySensors(time: number): void {
    if (this.isRollbackActive(time)) {
      return;
    }

    for (const sensor of this.level.sensors) {
      if (!intersects(this.player, sensor)) {
        continue;
      }

      if (!sensor.triggered) {
        sensor.triggered = true;
        this.sensorTrips += 1;
        this.lockdownUntil = Math.max(this.lockdownUntil, time + (sensor.duration ?? 3) * 1000);
        this.toast("LOCKDOWN TRIGGERED");
        this.shake(5, 170);
        this.audio.play("error");
      }
    }
  }

  private checkModernHazards(time: number): boolean {
    const rollbackActive = this.isRollbackActive(time);
    const elapsed = this.levelElapsed(time);

    if (!rollbackActive) {
      for (const laser of this.level.laserGates) {
        if (isTimedHazardActive(laser, elapsed) && intersects(this.player, shrinkRect(laser, 3))) {
          this.die("Laser gate shipped you first");
          return true;
        }
      }

      for (const laser of this.level.sweepLasers) {
        if (isTimedHazardActive(laser, elapsed) && intersects(this.player, shrinkRect(laser, 3))) {
          this.die("Sweep laser completed its pass");
          return true;
        }
      }

      for (const arc of this.level.teslaArcs) {
        if (isTimedHazardActive(arc, elapsed) && intersects(this.player, teslaHitbox(arc))) {
          this.die("Merge conflict resolved you");
          return true;
        }
      }

      for (const vent of this.level.plasmaVents) {
        if (isTimedHazardActive(vent, elapsed) && intersects(this.player, plasmaBeamRect(vent))) {
          this.die("Cooling system overcorrected");
          return true;
        }
      }
    }

    for (const razor of this.level.razors) {
      if (intersects(this.player, shrinkRect(razor, 5))) {
        this.die("Razor indexer found you");
        return true;
      }
    }

    for (const crusher of this.level.crushers) {
      if (intersects(this.player, shrinkRect(crusher, 4))) {
        this.die("Compression panel closed the issue");
        return true;
      }
    }

    return false;
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

    this.exitedPadIndex = this.activeExitIndex(time);
    this.completeLevel(time);
  }

  private completeLevel(time: number): void {
    if (this.mode !== "playing") {
      return;
    }

    const elapsed = this.levelElapsed(time);
    const patch = this.currentPatch();
    const report = this.bonusChallengeActive && this.challengeType() === "bug_report" && Boolean(this.level.bugReport?.collected);
    const challenge = this.bonusChallengeActive && this.isChallengeComplete(elapsed);
    const objectiveComplete = !this.bonusChallengeActive || challenge;
    const medal = medalForLevel(elapsed, patch.targetTime, this.levelDeaths, objectiveComplete);
    this.results[this.levelIndex] = {
      levelId: this.level.id,
      patch: patch.version,
      seconds: elapsed,
      deaths: this.levelDeaths,
      coins: this.levelCoins,
      report,
      challenge,
      medal,
    };
    this.totalCoins += this.levelCoins;
    this.totalReports += challenge ? 1 : 0;
    this.levelProgress = updateLevelProgress(this.levelProgress, this.results[this.levelIndex]);
    saveLevelProgress(this.levelProgress);
    this.levelCompletedAt = time;
    this.medalRevealUntil = time + 920;
    if (this.level.id === 28) {
      this.doubleJumpUnlockUntil = time + 2600;
    }
    this.setMode("levelComplete");
    this.toast(`${medal.toUpperCase()} PATCH`);
    this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, medalColor(medal), 28);
    this.shake(this.levelIndex === levels.length - 1 ? 8 : 5, 240);
    this.audio.play(this.levelIndex === levels.length - 1 ? "win" : "complete");
  }

  private advanceLevel(): void {
    if (this.highlightRunActive) {
      const nextStep = this.highlightStep + 1;
      if (nextStep >= HIGHLIGHT_SEQUENCE.length) {
        this.setMode("gameComplete");
        return;
      }

      this.highlightStep = nextStep;
      this.levelIndex = HIGHLIGHT_SEQUENCE[this.highlightStep];
      this.boardSelection = this.levelIndex;
      this.levelDeaths = 0;
      this.resetLevel();
      this.startLevelIntro();
      return;
    }

    if (this.levelIndex >= levels.length - 1) {
      this.setMode("gameComplete");
      return;
    }

    this.levelIndex += 1;
    this.levelDeaths = 0;
    this.resetLevel();
    this.startLevelIntro();
  }

  private startRunAt(index: number, options: { highlight?: boolean; highlightStep?: number } = {}): void {
    this.levelIndex = clamp(index, 0, levels.length - 1);
    this.boardSelection = this.levelIndex;
    this.highlightRunActive = Boolean(options.highlight);
    this.highlightStep = options.highlightStep ?? 0;
    this.chapterIntroShown = false;
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

  private startHighlightRun(): void {
    this.startExhibitionRun();
  }

  private startExhibitionRun(): void {
    this.levelIndex = EXHIBITION_SEQUENCE[0];
    this.boardSelection = this.levelIndex;
    this.highlightRunActive = true;
    this.highlightStep = 0;
    this.chapterIntroShown = false;
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
    this.setMode("exhibitionIntro");
    this.toast("Judge exhibition route");
  }

  private beginExhibition(): void {
    this.startRunAt(EXHIBITION_SEQUENCE[0], { highlight: true, highlightStep: 0 });
    this.toast("Judge exhibition route");
  }

  private handleBoardInput(code: string): void {
    const current = this.boardSelection;
    const range = boardPageRange(current, levels.length);
    const columns = boardColumnsForRange(range);

    if (code === "ArrowLeft") {
      this.boardSelection = current > range.start ? current - 1 : previousBoardPageStart(current, levels.length);
    }
    if (code === "ArrowRight") {
      this.boardSelection = current < range.end ? current + 1 : nextBoardPageStart(current, levels.length);
    }
    if (code === "ArrowUp") {
      this.boardSelection = current - columns >= range.start ? current - columns : current;
    }
    if (code === "ArrowDown") {
      this.boardSelection = current + columns <= range.end ? current + columns : current;
    }
    if (code === "PageUp" || code === "KeyQ") {
      this.boardSelection = previousBoardPageStart(current, levels.length);
    }
    if (code === "PageDown" || code === "KeyE") {
      this.boardSelection = nextBoardPageStart(current, levels.length);
    }
    if (code === "KeyH") {
      const currentHighlight = JUDGE_HIGHLIGHTS.findIndex((index) => index >= this.boardSelection);
      const next = currentHighlight >= 0 && JUDGE_HIGHLIGHTS[currentHighlight] === this.boardSelection
        ? JUDGE_HIGHLIGHTS[(currentHighlight + 1) % JUDGE_HIGHLIGHTS.length]
        : JUDGE_HIGHLIGHTS[Math.max(0, currentHighlight)];
      this.boardSelection = next ?? JUDGE_HIGHLIGHTS[0];
    }

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
    const prevTheme = this.audio.currentThemeKey;
    this.audio.switchTheme(this.level.modifier);
    if (this.audio.currentThemeKey !== prevTheme) {
      const themeColors: Record<string, string> = {
        frantic: "255,80,80", eerie: "120,80,220", rolling: "80,200,120", wind: "100,160,255",
      };
      const color = themeColors[this.audio.currentThemeKey];
      if (color) {
        this.themeFlashColor = color;
        this.themeFlashUntil = time + 700;
      }
    }
    this.audio.play("intro");

    // Levels 1–3 show the full dev dialog before the patch intro card
    const patch = this.currentPatch();
    const lines = patch.devLines ?? [];
    const continueIntro = () => {
      if (this.levelIndex < 3 && lines.length > 0) {
        this.devDialogLines = lines;
        this.devDialogSlide = 0;
        this.devDialogProceed = () => this.beginPatchIntro(time);
        this.setMode("devDialog");
      } else {
        this.beginPatchIntro(time);
      }
    };

    if (this.shouldShowChapterIntro()) {
      this.chapterIntroShown = true;
      this.chapterIntroProceed = continueIntro;
      this.setMode("chapterIntro");
      return;
    }

    continueIntro();
  }

  private shouldShowChapterIntro(): boolean {
    return this.level.chapter === "production_floor" && !this.chapterIntroShown;
  }

  private advanceChapterIntro(): void {
    this.audio.play("start");
    this.chapterIntroProceed?.();
    this.chapterIntroProceed = null;
  }

  private beginPatchIntro(time: number): void {
    this.levelIntroUntil = time + LEVEL_INTRO_MS;
    this.setMode("levelIntro");
  }

  private advanceDevDialog(): void {
    this.audio.play("start");
    this.devDialogProceed?.();
    this.devDialogProceed = null;
  }

  private startPlaying(time: number): void {
    this.levelStartedAt = time;
    const bw = this.level.bounds.w;
    const bh = this.level.bounds.h;
    this.camera.x = clamp(this.player.x + this.player.w / 2 - VIEW_W / 2, 0, Math.max(0, bw - VIEW_W));
    this.camera.y = clamp(this.player.y + this.player.h / 2 - VIEW_H / 2, 0, Math.max(0, bh - VIEW_H));
    this.setMode("playing");
  }

  private inputAxis(): number {
    const left = this.keys.has(this.bindings.left) || this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const right = this.keys.has(this.bindings.right) || this.keys.has("KeyD") || this.keys.has("ArrowRight");
    return Number(right) - Number(left);
  }

  private isJumpCode(code: string): boolean {
    return code === this.bindings.jump || code === "KeyW" || code === "ArrowUp";
  }

  private cutJumpVelocity(): void {
    if (this.mode !== "playing") {
      return;
    }

    const gravity = gravityVector(this.level.gravity);
    const upwardSpeed = -(this.player.vx * gravity.x + this.player.vy * gravity.y);
    if (upwardSpeed <= 90) {
      return;
    }

    const trim = upwardSpeed * 0.45;
    this.player.vx += gravity.x * trim;
    this.player.vy += gravity.y * trim;
  }

  private hasDoubleJumpUnlocked(): boolean {
    if (this.level.id < 26) {
      return false;
    }

    return this.level.id >= 29 || Boolean(this.levelProgress[28]?.completed);
  }

  private canDoubleJump(): boolean {
    return this.hasDoubleJumpUnlocked() && !this.player.grounded && this.player.airJumpsUsed < 1;
  }

  private applyConveyor(dt: number): void {
    if (!this.player.grounded || !this.groundedPlatformId) {
      return;
    }

    const platform = this.level.platforms.find((item) => item.id === this.groundedPlatformId);
    if (!platform || platform.kind !== "conveyor") {
      return;
    }

    const speed = platform.conveyorSpeed ?? 0;
    if (this.level.gravity === "right") {
      this.player.y += speed * dt;
    } else {
      this.player.x += speed * dt;
    }
  }

  private applyJumpPads(): void {
    const gravity = gravityVector(this.level.gravity);
    let touched = "";

    for (const pad of this.level.jumpPads) {
      if (!intersects(this.player, pad)) {
        continue;
      }

      touched = pad.id;
      if (this.lastJumpPadId === pad.id) {
        break;
      }

      const force = pad.force;
      if (gravity.x !== 0) {
        this.player.vx = -gravity.x * force;
      } else {
        this.player.vy = -gravity.y * force;
      }
      this.player.grounded = false;
      this.player.airJumpsUsed = 0;
      this.lastJumpPadId = pad.id;
      this.burst(pad.x + pad.w / 2, pad.y + pad.h / 2, "#70f5ff", 14);
      this.shake(3, 120);
      this.audio.play("jump");
      break;
    }

    if (!touched) {
      this.lastJumpPadId = "";
    }
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
      return this.level.exit.pads[this.activeExitIndex(time)];
    }

    return this.level.exit;
  }

  private activeExitIndex(time: number): number {
    if (!this.level.exit.pads || this.level.exit.pads.length === 0) {
      return 0;
    }

    const elapsed = this.levelElapsed(time);
    return Math.floor(elapsed / 2.1) % this.level.exit.pads.length;
  }

  private challengeType(): NonNullable<LevelDefinition["challenge"]>["type"] {
    return this.level.challenge?.type ?? "bug_report";
  }

  private challengeLabel(): string {
    return this.level.challenge?.label ?? "File the hidden bug report before shipping.";
  }

  private isChallengeComplete(elapsed: number): boolean {
    switch (this.challengeType()) {
      case "bug_report":
        return Boolean(this.level.bugReport?.collected);
      case "all_coins":
        return this.level.coins.every((coin) => coin.collected);
      case "par_time":
        return elapsed <= (this.level.challenge?.parTime ?? this.currentPatch().targetTime);
      case "no_sensor":
        return this.sensorTrips === 0;
      case "no_rollback":
        return this.rollbackUses === 0;
      case "no_double_jump":
        return !this.secondJumpUsed;
      case "first_exit":
        return this.exitedPadIndex === 0;
      case "master":
        return this.level.coins.every((coin) => coin.collected) &&
          elapsed <= (this.level.challenge?.parTime ?? this.currentPatch().targetTime);
    }
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
    document.body.dataset.runSource = this.run.source;
    document.body.dataset.highlightRun = this.highlightRunActive ? "active" : "inactive";
    document.body.dataset.doubleJump = this.level && this.hasDoubleJumpUnlocked() ? "unlocked" : "locked";
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

    if (this.mode === "exhibitionIntro") {
      this.drawExhibitionIntro(ctx, time);
      ctx.restore();
      return;
    }

    if (this.mode === "settings") {
      this.drawSettings();
      ctx.restore();
      return;
    }

    if (this.mode === "devDialog") {
      this.drawDevDialog(ctx);
      ctx.restore();
      return;
    }

    if (this.mode === "chapterIntro") {
      this.drawChapterIntro(ctx, time);
      ctx.restore();
      return;
    }

    this.drawWorld(ctx, time);
    if (this.shouldDrawHud()) {
      this.drawHud(ctx, time);
    }
    if (this.shouldDimWorld()) {
      this.drawModalScrim(ctx, this.modalScrimAlpha());
    }

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

  private shouldDrawHud(): boolean {
    return this.mode === "playing" || this.mode === "paused";
  }

  private shouldDimWorld(): boolean {
    return this.mode === "title" ||
      this.mode === "levelIntro" ||
      this.mode === "paused" ||
      this.mode === "levelComplete" ||
      this.mode === "gameOver" ||
      this.mode === "gameComplete";
  }

  private modalScrimAlpha(): number {
    if (this.mode === "title") return 0.46;
    if (this.mode === "paused") return 0.42;
    if (this.mode === "levelIntro") return 0.55;
    if (this.mode === "levelComplete") return 0.58;
    if (this.mode === "gameOver") return 0.62;
    if (this.mode === "gameComplete") return 0.68;
    return 0.5;
  }

  private drawModalScrim(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.save();
    ctx.fillStyle = `rgba(3, 7, 18, ${alpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 120, VIEW_W / 2, VIEW_H / 2, 560);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D, time: number): void {
    const bg = this.level?.background ?? "#090d22";
    const gradient = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    gradient.addColorStop(0, bg);
    gradient.addColorStop(1, "#080814");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Theme-switch flash: brief colored vignette when music theme changes
    if (this.themeFlashUntil > time && this.themeFlashColor) {
      const progress = 1 - (this.themeFlashUntil - time) / 700;
      const alpha = Math.max(0, 0.28 * (1 - progress * progress));
      ctx.fillStyle = `rgba(${this.themeFlashColor}, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (this.level?.chapter === "production_floor") {
      ctx.fillStyle = "rgba(112,245,255,0.08)";
      for (let x = -80; x < VIEW_W + 120; x += 96) {
        const drift = (time / 42 + x * 0.23) % 96;
        ctx.fillRect(x + drift, 0, 2, VIEW_H);
      }
      ctx.fillStyle = "rgba(255,79,129,0.08)";
      for (let y = 34; y < VIEW_H; y += 86) {
        ctx.fillRect(0, y, VIEW_W, 2);
      }
      for (let i = 0; i < 12; i += 1) {
        const x = (i * 173 + Math.sin(time / 700 + i) * 16) % VIEW_W;
        const y = 72 + ((i * 61 + time / 35) % (VIEW_H - 120));
        ctx.fillStyle = i % 2 === 0 ? "rgba(112,245,255,0.18)" : "rgba(255,220,63,0.13)";
        ctx.fillRect(x, y, 38 + (i % 3) * 18, 3);
      }
      return;
    }

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
    this.updateCamera();
    const cx = Math.round(this.camera.x);
    const cy = Math.round(this.camera.y);

    ctx.save();
    ctx.translate(-cx, -cy);

    if (this.level.chapter === "production_floor") {
      this.drawProductionWorld(ctx, time);
    }

    const activeIds = new Set(this.activePlatforms(time).map((item) => item.id));
    for (const platform of this.level.platforms) {
      this.drawPlatform(ctx, platform, activeIds.has(platform.id), time);
    }

    for (const door of this.level.doors) {
      this.drawLockdownDoor(ctx, door, this.activeDoors(time).some((active) => active.id === door.id), time);
    }

    for (const pad of this.level.jumpPads) {
      this.drawJumpPad(ctx, pad, time);
    }

    for (const sensor of this.level.sensors) {
      this.drawSecuritySensor(ctx, sensor, time);
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
      if (!coin.collected) this.drawCoin(ctx, coin, time);
    }
    for (const token of this.level.tokens) {
      if (!token.collected) this.drawRollbackToken(ctx, token, time);
    }
    if (this.bonusChallengeActive && this.challengeType() === "bug_report" && this.level.bugReport && !this.level.bugReport.collected) {
      this.drawBugReport(ctx, this.level.bugReport, time);
    }
    for (const spike of this.level.spikes) {
      this.drawSpike(ctx, spike);
    }

    this.drawModernHazards(ctx, time);

    this.drawExit(ctx, this.activeExit(time), time);
    this.drawPlayer(ctx, time);
    this.drawParticles(ctx);

    ctx.restore();

    // Screen-space overlays
    if (this.message && time < this.messageUntil) {
      drawTextPill(ctx, this.message, VIEW_W / 2, 104, "#fff5d6", "#291a36");
    }
    this.drawExitArrow(ctx, time);
  }

  private drawExitArrow(ctx: CanvasRenderingContext2D, time: number): void {
    const exit = this.activeExit(time);
    const ex = exit.x - this.camera.x;
    const ey = exit.y - this.camera.y;
    const offLeft   = ex + exit.w < 60;
    const offRight  = ex > VIEW_W - 60;
    const offTop    = ey + exit.h < 80;
    const offBottom = ey > VIEW_H - 80;
    if (!offLeft && !offRight && !offTop && !offBottom) return;

    const pulse = 0.55 + Math.sin(time / 260) * 0.45;
    ctx.save();
    ctx.globalAlpha = pulse;

    if (offRight)  this.drawArrowPointer(ctx, VIEW_W - 28, clamp(ey + exit.h / 2, 90, VIEW_H - 90), "right");
    else if (offLeft) this.drawArrowPointer(ctx, 28, clamp(ey + exit.h / 2, 90, VIEW_H - 90), "left");
    if (offBottom) this.drawArrowPointer(ctx, clamp(ex + exit.w / 2, 60, VIEW_W - 60), VIEW_H - 36, "down");
    else if (offTop) this.drawArrowPointer(ctx, clamp(ex + exit.w / 2, 60, VIEW_W - 60), 36, "up");

    ctx.restore();
  }

  private drawArrowPointer(ctx: CanvasRenderingContext2D, x: number, y: number, dir: "left" | "right" | "up" | "down"): void {
    const s = 13;
    ctx.fillStyle = "#70f5ff";
    ctx.strokeStyle = "#70f5ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    switch (dir) {
      case "right": ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x - s, y + s); break;
      case "left":  ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y); ctx.lineTo(x + s, y + s); break;
      case "down":  ctx.moveTo(x - s, y - s); ctx.lineTo(x, y + s); ctx.lineTo(x + s, y - s); break;
      case "up":    ctx.moveTo(x - s, y + s); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y + s); break;
    }
    ctx.closePath();
    ctx.fill();
    drawText(ctx, "EXIT", x + (dir === "right" ? -s - 36 : dir === "left" ? s + 4 : -14), y + (dir === "down" ? -s - 6 : dir === "up" ? s + 16 : 5), 11, "#70f5ff", "bold");
  }

  private drawProductionWorld(ctx: CanvasRenderingContext2D, time: number): void {
    const b = this.level.bounds;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    for (let x = b.x; x < b.x + b.w; x += 160) {
      ctx.fillRect(x + 18, 52, 76, b.h - 104);
      ctx.fillStyle = "rgba(112,245,255,0.16)";
      ctx.fillRect(x + 28, 72 + ((time / 35 + x) % 82), 56, 4);
      ctx.fillStyle = "rgba(255,255,255,0.035)";
    }
    ctx.fillStyle = "rgba(112,245,255,0.10)";
    for (let x = b.x; x < b.x + b.w; x += 64) {
      ctx.fillRect(x, b.h - 76, 42, 2);
      ctx.fillRect(x + 18, 90, 2, b.h - 166);
    }
    ctx.fillStyle = "rgba(255,79,129,0.18)";
    for (let x = b.x + 90; x < b.x + b.w; x += 260) {
      const pulse = 0.35 + Math.sin(time / 220 + x) * 0.25;
      ctx.globalAlpha = pulse;
      ctx.fillRect(x, 42, 18, 18);
    }
    ctx.restore();
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, platform: PlatformState, active: boolean, time: number): void {
    if (platform.broken) {
      return;
    }

    if (this.level.chapter === "production_floor") {
      this.drawProductionPlatform(ctx, platform, active, time);
      return;
    }

    const fill = platform.kind === "crumbling" ? "#99694a" : platform.kind === "async" ? "#3edce7" : platform.kind === "moving" ? "#c49020" : "#4caf63";
    const edge = platform.kind === "crumbling" ? "#ffc15e" : platform.kind === "async" ? "#e8fbff" : platform.kind === "moving" ? "#ffe566" : "#b8ff85";
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
    if (platform.kind === "moving") {
      const arrow = Math.sin(time / 180 + (platform.baseX ?? platform.x) * 0.01) > 0 ? "→" : "←";
      ctx.fillStyle = "rgba(255,220,100,0.55)";
      ctx.fillRect(platform.x + 6, platform.y + 5, platform.w - 12, 4);
      drawText(ctx, arrow, platform.x + platform.w / 2 - 5, platform.y + 18, 11, "rgba(255,230,120,0.7)");
    }
    ctx.restore();
  }

  private drawProductionPlatform(ctx: CanvasRenderingContext2D, platform: PlatformState, active: boolean, time: number): void {
    const alpha = active ? 1 : 0.22;
    const edge = platform.kind === "conveyor" ? "#ffdc3f" : platform.kind === "async" ? "#70f5ff" : "#58ffd4";
    const fill = platform.kind === "conveyor" ? "#24303b" : platform.kind === "async" ? "#163c4c" : "#1a2934";

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = edge;
    ctx.shadowBlur = active ? 10 : 0;
    const gradient = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.h);
    gradient.addColorStop(0, "rgba(255,255,255,0.16)");
    gradient.addColorStop(0.35, fill);
    gradient.addColorStop(1, "#081018");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(platform.x, platform.y, platform.w, platform.h, 7);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(platform.x + 1, platform.y + 1, platform.w - 2, platform.h - 2, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(112,245,255,0.18)";
    ctx.beginPath();
    ctx.roundRect(platform.x + 8, platform.y + 5, platform.w - 16, 3, 1.5);
    ctx.fill();

    if (platform.kind === "conveyor") {
      const dir = (platform.conveyorSpeed ?? 0) >= 0 ? 1 : -1;
      ctx.fillStyle = "rgba(255,220,63,0.72)";
      for (let x = platform.x + 12 + ((time / 28) % 24); x < platform.x + platform.w - 12; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, platform.y + platform.h / 2 - 5);
        ctx.lineTo(x + dir * 10, platform.y + platform.h / 2);
        ctx.lineTo(x, platform.y + platform.h / 2 + 5);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (platform.kind === "async") {
      const pulse = 0.5 + Math.sin(time / 150 + platform.x) * 0.5;
      ctx.fillStyle = `rgba(112,245,255,${0.22 + pulse * 0.34})`;
      ctx.beginPath();
      ctx.roundRect(platform.x + 8, platform.y + platform.h - 7, platform.w - 16, 3, 1.5);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawLockdownDoor(ctx: CanvasRenderingContext2D, door: LockdownDoor, closed: boolean, time: number): void {
    const pulse = 0.45 + Math.sin(time / 180 + door.x) * 0.25;
    ctx.save();
    ctx.globalAlpha = closed ? 1 : 0.24;
    ctx.shadowColor = closed ? "#ff4f81" : "#58ffd4";
    ctx.shadowBlur = closed ? 12 : 4;
    ctx.fillStyle = closed ? "#231726" : "#102b2a";
    ctx.beginPath();
    ctx.roundRect(door.x, door.y, door.w, door.h, 5);
    ctx.fill();
    ctx.strokeStyle = closed ? "#ff4f81" : "#58ffd4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(door.x + 1, door.y + 1, door.w - 2, door.h - 2, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = closed ? `rgba(255,79,129,${0.28 + pulse})` : "rgba(88,255,212,0.25)";
    for (let y = door.y + 10; y < door.y + door.h - 8; y += 18) {
      ctx.fillRect(door.x + 5, y, door.w - 10, 3);
    }
    ctx.restore();
  }

  private drawJumpPad(ctx: CanvasRenderingContext2D, pad: JumpPad, time: number): void {
    const pulse = 0.45 + Math.sin(time / 150 + pad.x) * 0.35;
    ctx.shadowColor = "#70f5ff";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#081421";
    ctx.beginPath();
    ctx.roundRect(pad.x, pad.y, pad.w, pad.h, 8);
    ctx.fill();
    ctx.strokeStyle = "#70f5ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pad.x + 1, pad.y + 1, pad.w - 2, pad.h - 2, 7);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(112,245,255,${0.35 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(pad.x + pad.w / 2, pad.y - 16 - pulse * 6);
    ctx.lineTo(pad.x + pad.w / 2 - 12, pad.y - 2);
    ctx.lineTo(pad.x + pad.w / 2 + 12, pad.y - 2);
    ctx.closePath();
    ctx.fill();
  }

  private drawSecuritySensor(ctx: CanvasRenderingContext2D, sensor: SecuritySensorState, time: number): void {
    const active = time < this.lockdownUntil || sensor.triggered;
    ctx.save();
    ctx.fillStyle = active ? "rgba(255,79,129,0.12)" : "rgba(112,245,255,0.10)";
    ctx.beginPath();
    ctx.roundRect(sensor.x, sensor.y, sensor.w, sensor.h, 8);
    ctx.fill();
    ctx.strokeStyle = active ? "#ff4f81" : "#70f5ff";
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.roundRect(sensor.x + 1, sensor.y + 1, sensor.w - 2, sensor.h - 2, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = active ? "#ff4f81" : "#70f5ff";
    ctx.fillRect(sensor.x + 4, sensor.y + 4, sensor.w - 8, 3);
    ctx.restore();
  }

  private drawModernHazards(ctx: CanvasRenderingContext2D, time: number): void {
    const elapsed = this.levelElapsed(time);
    const rollback = this.isRollbackActive(time);
    for (const laser of this.level.laserGates) this.drawLaserRect(ctx, laser, elapsed, rollback);
    for (const laser of this.level.sweepLasers) this.drawLaserRect(ctx, laser, elapsed, rollback);
    for (const razor of this.level.razors) this.drawRazor(ctx, razor, time);
    for (const crusher of this.level.crushers) this.drawCrusher(ctx, crusher);
    for (const arc of this.level.teslaArcs) this.drawTeslaArc(ctx, arc, elapsed, rollback, time);
    for (const vent of this.level.plasmaVents) this.drawPlasmaVent(ctx, vent, elapsed, rollback, time);
  }

  private drawLaserRect(ctx: CanvasRenderingContext2D, laser: TimedHazardRect, elapsed: number, rollback: boolean): void {
    const active = !rollback && isTimedHazardActive(laser, elapsed);
    const warning = !rollback && !active && isTimedHazardWarning(laser, elapsed);
    const color = rollback ? "#58ffd4" : active ? "#ff4f81" : warning ? "#ffdc3f" : "#40517f";
    ctx.save();
    ctx.globalAlpha = active ? 1 : warning ? 0.75 : 0.32;
    ctx.shadowColor = color;
    ctx.shadowBlur = active ? 18 : warning ? 8 : 0;
    ctx.fillStyle = active ? "rgba(255,79,129,0.46)" : warning ? "rgba(255,220,63,0.22)" : "rgba(64,81,127,0.18)";
    ctx.beginPath();
    ctx.roundRect(laser.x, laser.y, laser.w, laser.h, Math.min(8, laser.w / 2, laser.h / 2));
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 4 : 2;
    ctx.beginPath();
    ctx.roundRect(laser.x + 1, laser.y + 1, laser.w - 2, laser.h - 2, Math.min(7, laser.w / 2, laser.h / 2));
    ctx.stroke();
    ctx.restore();
  }

  private drawRazor(ctx: CanvasRenderingContext2D, razor: MovingTechState, time: number): void {
    const cx = razor.x + razor.w / 2;
    const cy = razor.y + razor.h / 2;
    const r = Math.min(razor.w, razor.h) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time / 120 + (razor.phase ?? 0));
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#cde9ff";
    for (let i = 0; i < 8; i += 1) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -r - 8);
      ctx.lineTo(7, -r + 5);
      ctx.lineTo(-7, -r + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ff4f81";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCrusher(ctx: CanvasRenderingContext2D, crusher: MovingTechState): void {
    ctx.fillStyle = "#221b25";
    ctx.beginPath();
    ctx.roundRect(crusher.x, crusher.y, crusher.w, crusher.h, 5);
    ctx.fill();
    ctx.strokeStyle = "#ffdc3f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(crusher.x + 1, crusher.y + 1, crusher.w - 2, crusher.h - 2, 4);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,79,129,0.45)";
    for (let x = crusher.x + 5; x < crusher.x + crusher.w - 4; x += 12) {
      ctx.fillRect(x, crusher.y + crusher.h - 10, 6, 10);
    }
  }

  private drawTeslaArc(ctx: CanvasRenderingContext2D, arc: TeslaArc, elapsed: number, rollback: boolean, time: number): void {
    const active = !rollback && isTimedHazardActive(arc, elapsed);
    const warning = !rollback && !active && isTimedHazardWarning(arc, elapsed);
    ctx.save();
    ctx.strokeStyle = rollback ? "#58ffd4" : active ? "#70f5ff" : warning ? "#ffdc3f" : "#40517f";
    ctx.globalAlpha = active ? 0.95 : warning ? 0.62 : 0.28;
    ctx.lineWidth = active ? 5 : 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = active ? 16 : 4;
    ctx.beginPath();
    ctx.moveTo(arc.x1, arc.y1);
    const wobble = active ? Math.sin(time / 55 + arc.x1) * 10 : 0;
    ctx.lineTo((arc.x1 + arc.x2) / 2 + wobble, (arc.y1 + arc.y2) / 2 - wobble);
    ctx.lineTo(arc.x2, arc.y2);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.arc(arc.x1, arc.y1, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(arc.x2, arc.y2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private drawPlasmaVent(ctx: CanvasRenderingContext2D, vent: PlasmaVent, elapsed: number, rollback: boolean, time: number): void {
    const active = !rollback && isTimedHazardActive(vent, elapsed);
    const warning = !rollback && !active && isTimedHazardWarning(vent, elapsed);
    ctx.fillStyle = "#101827";
    ctx.beginPath();
    ctx.roundRect(vent.x, vent.y, vent.w, vent.h, 5);
    ctx.fill();
    ctx.strokeStyle = active ? "#ff4f81" : warning ? "#ffdc3f" : "#40517f";
    ctx.strokeRect(vent.x + 1, vent.y + 1, vent.w - 2, vent.h - 2);
    if (active || warning) {
      const beam = plasmaBeamRect(vent);
      ctx.save();
      ctx.globalAlpha = active ? 0.55 + Math.sin(time / 90) * 0.14 : 0.22;
      ctx.shadowColor = active ? "#ff4f81" : "#ffdc3f";
      ctx.shadowBlur = active ? 18 : 8;
      ctx.fillStyle = active ? "#ff4f81" : "#ffdc3f";
      ctx.beginPath();
      ctx.roundRect(beam.x, beam.y, beam.w, beam.h, Math.min(8, beam.w / 2, beam.h / 2));
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCoin(ctx: CanvasRenderingContext2D, coin: CoinState, time: number): void {
    const bob = Math.sin(time / 170 + coin.x) * 3;
    const shine = 0.5 + Math.sin(time / 130 + coin.y) * 0.35;
    ctx.save();
    ctx.shadowColor = "#ffdc3f";
    ctx.shadowBlur = 10 + shine * 7;
    ctx.fillStyle = "#593b00";
    ctx.beginPath();
    ctx.ellipse(coin.x, coin.y + bob + 10, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const gradient = ctx.createRadialGradient(coin.x - 3, coin.y + bob - 4, 2, coin.x, coin.y + bob, coin.r + 3);
    gradient.addColorStop(0, "#fff9bd");
    gradient.addColorStop(0.45, "#ffdc3f");
    gradient.addColorStop(1, "#ff9a3d");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(coin.x, coin.y + bob, coin.r * 0.82, coin.r, Math.sin(time / 260) * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(coin.x - 2, coin.y + bob - 7);
    ctx.lineTo(coin.x + 2, coin.y + bob + 6);
    ctx.stroke();
    ctx.restore();
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
    ctx.save();
    ctx.shadowColor = "#ff4f81";
    ctx.shadowBlur = this.level.chapter === "production_floor" ? 9 : 4;
    ctx.fillStyle = "#311522";
    ctx.beginPath();
    ctx.moveTo(spike.x, spike.y + spike.h);
    ctx.quadraticCurveTo(spike.x + spike.w * 0.34, spike.y + spike.h * 0.28, spike.x + spike.w / 2, spike.y);
    ctx.quadraticCurveTo(spike.x + spike.w * 0.66, spike.y + spike.h * 0.28, spike.x + spike.w, spike.y + spike.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff4f81";
    ctx.beginPath();
    ctx.moveTo(spike.x + 5, spike.y + spike.h - 2);
    ctx.quadraticCurveTo(spike.x + spike.w * 0.42, spike.y + spike.h * 0.38, spike.x + spike.w / 2, spike.y + 8);
    ctx.quadraticCurveTo(spike.x + spike.w * 0.62, spike.y + spike.h * 0.38, spike.x + spike.w - 5, spike.y + spike.h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawExit(ctx: CanvasRenderingContext2D, exit: Rect, time: number): void {
    const pulse = 0.5 + Math.sin(time / 180) * 0.5;
    ctx.save();
    ctx.shadowColor = "#70f5ff";
    ctx.shadowBlur = 14 + pulse * 10;
    ctx.fillStyle = "#071221";
    ctx.beginPath();
    ctx.roundRect(exit.x, exit.y, exit.w, exit.h, 10);
    ctx.fill();
    ctx.strokeStyle = "#70f5ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(exit.x + 2, exit.y + 2, exit.w - 4, exit.h - 4, 8);
    ctx.stroke();
    ctx.fillStyle = `rgba(112,245,255,${0.22 + pulse * 0.28})`;
    ctx.beginPath();
    ctx.ellipse(exit.x + exit.w / 2, exit.y + exit.h / 2, exit.w * 0.28 + pulse * 4, exit.h * 0.36 + pulse * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.22 + pulse * 0.34})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(exit.x + exit.w / 2, exit.y + exit.h / 2, exit.w * 0.18, exit.h * 0.28, time / 800, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

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
    ctx.beginPath();
    ctx.moveTo(p.x + 4, p.y + 13);
    ctx.quadraticCurveTo(p.x - 14, p.y + 22, p.x + 2, p.y + 31);
    ctx.lineTo(p.x + 8, p.y + 25);
    ctx.closePath();
    ctx.fill();
    const suit = ctx.createLinearGradient(p.x, p.y + 8, p.x, p.y + p.h);
    suit.addColorStop(0, "#29a3ff");
    suit.addColorStop(1, "#0b5ec8");
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.roundRect(p.x + 5, p.y + 8, p.w - 6, p.h - 6, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(112,245,255,0.72)";
    ctx.beginPath();
    ctx.roundRect(p.x + 9, p.y + 12, p.w - 14, 10, 4);
    ctx.fill();
    ctx.fillStyle = "#ffd89b";
    ctx.beginPath();
    ctx.roundRect(p.x + 8, p.y + 2, p.w - 9, 14, 6);
    ctx.fill();
    ctx.fillStyle = "#3c1c28";
    ctx.beginPath();
    ctx.moveTo(p.x + 6, p.y + 7);
    ctx.quadraticCurveTo(p.x + 12, p.y - 4, p.x + p.w + 2, p.y + 3);
    ctx.lineTo(p.x + p.w - 3, p.y + 8);
    ctx.lineTo(p.x + 6, p.y + 7);
    ctx.fill();
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
    drawText(ctx, truncateText(`${this.level.title} - ${patch.headline}`, 32), 34, 44, 20, "#ffffff", "bold");
    drawWrappedText(ctx, patch.note, 34, 68, 386, 16, "#cde9ff");
    drawText(ctx, severityLabel(patch.severity), 346, 106, 14, severityColor(patch.severity), "bold");

    drawPanel(ctx, 468, 18, 474, 64, "rgba(9, 13, 31, 0.78)", "#7767ff");
    drawText(ctx, this.run.buildName, 486, 43, 18, "#fff5d6", "bold");
    drawText(
      ctx,
      `${this.run.source === "fallback" ? "DETERMINISTIC FALLBACK" : "OPENAI"} RUN ${this.run.runId}`,
      486,
      64,
      12,
      this.run.source === "openai" ? "#87ffc4" : "#ffdc3f",
      "bold",
    );
    drawText(ctx, `${this.levelCoins} coins`, 820, 43, 15, "#ffdc3f", "bold");
    drawText(ctx, `${this.deaths} deaths`, 820, 64, 13, "#ff9aa7", "bold");

    // Release-train progress track
    const dotGap = 2;
    const dotW = Math.max(4, Math.floor((270 - (levels.length - 1) * dotGap) / levels.length));
    const trainX = 670;
    const trainY = 76;
    for (let i = 0; i < levels.length; i++) {
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
    const starCount = levels.filter((level) => this.levelProgress[level.id]?.challengeCompleted).length;
    drawText(
      ctx,
      this.bonusChallengeActive ? `${starCount}/${levels.length} stars` : "challenge locked",
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
    if (this.hasDoubleJumpUnlocked()) {
      drawText(ctx, "Double jump", 500, 529, 13, "#70f5ff", "bold");
      const used = this.player.airJumpsUsed > 0 || this.secondJumpUsed && !this.player.grounded;
      drawJumpPip(ctx, 604, 518, true);
      drawJumpPip(ctx, 620, 518, !used && !this.player.grounded ? true : this.player.grounded);
    }
    if (this.playerName) {
      drawText(ctx, this.playerName, this.hasDoubleJumpUnlocked() ? 654 : 500, 529, 13, "#fff5d6");
    }

    if (this.isRollbackActive(time)) {
      const left = Math.max(0, (this.rollbackUntil - time) / 1000);
      drawTextPill(ctx, `ROLLBACK ${left.toFixed(1)}s`, 822, 102, "#87ffc4", "#12283a");
    }
  }

  private drawTitle(): void {
    const ctx = this.ctx;
    drawSoftPanel(ctx, 112, 106, 736, 330, "rgba(7, 10, 26, 0.92)", "#ffdc3f");
    this.drawAiChar(ctx, 758, 258, 2.28, true, "confident");
    drawText(ctx, "ESCAPE THE PATCH NOTES", 152, 168, 42, "#ffffff", "bold");
    drawText(ctx, "Chapter 2: The Production Floor is live.", 162, 204, 20, "#70f5ff", "bold");
    drawText(ctx, "A platformer slowly ruined by updates.", 162, 232, 17, "#87ffc4", "bold");
    drawText(ctx, this.run.finale.headline, 164, 274, 17, "#fff5d6", "bold");
    drawWrappedText(ctx, this.run.finale.note, 164, 300, 500, 17, "#cde9ff");
    if (this.bestScore > 0) {
      drawText(ctx, `Best release score ${this.bestScore}`, 164, 340, 16, "#ffdc3f", "bold");
    }
    drawTextPill(ctx, "CHOOSE LEVEL", 360, 380, "#111827", "#ffdc3f");
    this.hot(190, 360, 340, 34, () => { this.setMode("releaseBoard"); this.audio.play("start"); });
    drawTextPill(ctx, "START EXHIBITION", 640, 380, "#111827", "#70f5ff");
    this.hot(522, 360, 236, 34, () => {
      this.startExhibitionRun();
      this.audio.play("start");
    });
    if (this.run.source === "fallback") {
      drawTextPill(ctx, "DETERMINISTIC FALLBACK RUN", 384, 342, "#172033", "#ffdc3f");
    }
    drawText(ctx, "Space quick-starts · H exhibition · S settings · B choose level · T touch controls", 164, 420, 13, "#cde9ff", "bold");
  }

  private drawReleaseBoard(): void {
    const ctx = this.ctx;
    const completed = levels.filter((level) => this.levelProgress[level.id]?.completed).length;
    const stars = levels.filter((level) => this.levelProgress[level.id]?.challengeCompleted).length;
    const golds = levels.filter((level) => this.levelProgress[level.id]?.bestMedal === "gold").length;
    const selected = levels[this.boardSelection] ?? levels[0];
    const selectedPatch = this.run.levels[this.boardSelection] ?? this.run.levels[0];
    const selectedProgress = this.levelProgress[selected.id];
    const range = boardPageRange(this.boardSelection, levels.length);
    const pageFirstPatch = this.run.levels[range.start] ?? selectedPatch;
    const pageLastPatch = this.run.levels[range.end] ?? selectedPatch;
    const chapterOne = range.start < CHAPTER_TWO_START_INDEX;
    const compactBoard = range.end - range.start + 1 > 10;

    drawPanel(ctx, 36, 30, 888, 488, "rgba(7, 10, 26, 0.92)", "#70f5ff");
    drawText(ctx, "CHOOSE LEVEL", 68, 78, 34, "#ffffff", "bold");
    drawPanel(ctx, 796, 54, 106, 28, "rgba(0,0,0,0.4)", "#70f5ff");
    drawText(ctx, "← Title", 808, 73, 13, "#70f5ff", "bold");
    this.hot(796, 54, 106, 28, () => this.setMode("title"));
    drawText(ctx, `${completed}/${levels.length} shipped`, 532, 62, 15, "#87ffc4", "bold");
    drawText(ctx, `${stars}/${levels.length} stars`, 532, 84, 15, "#fff5d6", "bold");
    drawText(ctx, `${golds}/${levels.length} gold`, 700, 62, 15, "#ffdc3f", "bold");
    drawText(ctx, `Best ${this.bestScore || "--"}`, 724, 84, 15, "#cde9ff", "bold");
    drawText(ctx, `${chapterLabelForLevel(levels[range.start])}  ·  Page ${range.page + 1}/${range.totalPages}: Patch ${pageFirstPatch.version}-${pageLastPatch.version}`, 68, 108, 16, "#fff5d6", "bold");
    drawText(ctx, "Start Exhibition from title   Arrows select   Q/E chapter   H exhibit picks   Enter deploy   Esc title", 68, 128, 12, "#9fc7ff", "bold");

    const canPrev = range.page > 0;
    const canNext = range.page < range.totalPages - 1;
    if (chapterOne || compactBoard) {
      drawPanel(ctx, 812, 102, 38, 30, "rgba(0,0,0,0.32)", canPrev ? "#70f5ff" : "#40517f");
      drawText(ctx, "<", 826, 123, 17, canPrev ? "#70f5ff" : "#40517f", "bold");
      drawPanel(ctx, 858, 102, 38, 30, "rgba(0,0,0,0.32)", canNext ? "#70f5ff" : "#40517f");
      drawText(ctx, ">", 872, 123, 17, canNext ? "#70f5ff" : "#40517f", "bold");
      if (canPrev) {
        this.hot(812, 102, 38, 30, () => {
          this.boardSelection = previousBoardPageStart(this.boardSelection, levels.length);
          this.setStatus();
        });
      }
      if (canNext) {
        this.hot(858, 102, 38, 30, () => {
          this.boardSelection = nextBoardPageStart(this.boardSelection, levels.length);
          this.setStatus();
        });
      }
    } else {
      drawPanel(ctx, 54, 250, 44, 74, "rgba(0,0,0,0.32)", canPrev ? "#70f5ff" : "#40517f");
      drawText(ctx, "<", 70, 296, 28, canPrev ? "#70f5ff" : "#40517f", "bold");
      if (canPrev) {
        this.hot(54, 250, 44, 74, () => {
          this.boardSelection = previousBoardPageStart(this.boardSelection, levels.length);
          this.setStatus();
        });
      }
      drawPanel(ctx, 862, 250, 44, 74, "rgba(0,0,0,0.32)", canNext ? "#70f5ff" : "#40517f");
      drawText(ctx, ">", 878, 296, 28, canNext ? "#70f5ff" : "#40517f", "bold");
      if (canNext) {
        this.hot(862, 250, 44, 74, () => {
          this.boardSelection = nextBoardPageStart(this.boardSelection, levels.length);
          this.setStatus();
        });
      }
    }

    const columns = boardColumnsForRange(range);
    const compactGrid = compactBoard || columns >= 5;
    const cardW = compactGrid ? 158 : 356;
    const cardH = compactGrid ? 44 : 58;
    const startX = compactGrid ? 80 : 118;
    const startY = chapterOne ? 146 : 146;
    const gapX = compactGrid ? 10 : 20;
    const gapY = 8;

    for (let index = range.start; index <= range.end; index += 1) {
      const level = levels[index];
      const patch = this.run.levels[index] ?? this.run.levels[0];
      const local = index - range.start;
      const col = local % columns;
      const row = Math.floor(local / columns);
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
        JUDGE_HIGHLIGHTS.includes(index),
      );
      this.hot(cx, cy, cardW, cardH, () => {
        this.boardSelection = index;
        this.startRunAt(index);
        this.audio.play("start");
      });
    }

    drawPanel(ctx, 68, 476, 856, 34, "rgba(12, 17, 39, 0.8)", selectedProgress?.completed ? "#ff9aa7" : "#87ffc4");
    drawText(
      ctx,
      selectedProgress?.completed
        ? `Selected Patch ${selectedPatch.version}: Challenge Patch unlocked. ${selected.challenge?.label ?? "File the hidden bug report."}`
        : `Selected Patch ${selectedPatch.version}: first pass objective is only to reach the exit.`,
      84,
      499,
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
    exhibit: boolean,
  ): void {
    const completed = Boolean(progress?.completed);
    const starred = Boolean(progress?.challengeCompleted);
    const stroke = selected ? "#ffdc3f" : completed ? "#87ffc4" : "#40517f";
    const fill = selected ? "rgba(32, 31, 65, 0.96)" : "rgba(10, 15, 36, 0.86)";

    drawPanel(ctx, x, y, w, h, fill, stroke);
    if (h <= 48) {
      const status = starred ? "STAR" : completed ? "CLEAR" : "OPEN";
      const topTag = exhibit ? "EXH" : progress?.bestMedal ? progress.bestMedal.slice(0, 3).toUpperCase() : "--";
      drawText(ctx, `${levelId}. ${patch.version}`, x + 8, y + 17, 13, selected ? "#ffdc3f" : "#ffffff", "bold");
      drawText(ctx, status, x + 8, y + 35, 11, starred ? "#ffdc3f" : completed ? "#87ffc4" : "#ff9aa7", "bold");
      drawText(ctx, truncateText(releaseBoardLabel(patch.modifier), 16), x + 58, y + 35, 10, "#cde9ff", "bold");
      drawText(ctx, topTag, x + w - 34, y + 17, 10, exhibit ? "#ffdc3f" : progress?.bestMedal ? medalColor(progress.bestMedal) : "#7c8dbb", "bold");
      return;
    }

    drawText(ctx, `${levelId}. ${patch.version}`, x + 10, y + 19, 14, selected ? "#ffdc3f" : "#ffffff", "bold");
    drawText(ctx, releaseBoardLabel(patch.modifier), x + 78, y + 19, 12, "#cde9ff", "bold");
    if (exhibit) {
      drawText(ctx, "EXHIBIT", x + w - 74, y + 19, 11, "#ffdc3f", "bold");
    }
    drawText(ctx, starred ? "STARRED" : completed ? "CLEARED" : "UNSHIPPED", x + 10, y + 37, 12, starred ? "#ffdc3f" : completed ? "#87ffc4" : "#ff9aa7", "bold");
    drawText(ctx, starred ? "CHALLENGE DONE" : completed ? "CHALLENGE READY" : "CHALLENGE LOCKED", x + 90, y + 37, 12, starred ? "#ffdc3f" : completed ? "#ff9aa7" : "#9fc7ff", "bold");
    drawText(ctx, `${progress?.bestMedal?.toUpperCase() ?? "--"}`, x + 10, y + 53, 11, progress?.bestMedal ? medalColor(progress.bestMedal) : "#7c8dbb", "bold");
    drawText(ctx, `Star ${starred ? "YES" : completed ? "open" : "--"}`, x + 68, y + 53, 11, starred ? "#fff5d6" : "#7c8dbb", "bold");
    drawText(ctx, `${formatTime(progress?.bestTime)}`, x + 180, y + 53, 11, "#cde9ff", "bold");
  }

  // Stylized engineer portrait centered at (cx, cy), scale factor s.
  private drawDevChar(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, blink: boolean, mood: EngineerMood = "confident"): void {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 8 * s;
    ctx.shadowOffsetY = 3 * s;

    const jacket = ctx.createLinearGradient(0, -10 * s, 0, 34 * s);
    jacket.addColorStop(0, "#2f9be8");
    jacket.addColorStop(1, "#152f4a");
    ctx.fillStyle = jacket;
    ctx.beginPath();
    ctx.moveTo(-29 * s, 31 * s);
    ctx.quadraticCurveTo(-25 * s, -12 * s, -7 * s, -14 * s);
    ctx.lineTo(7 * s, -14 * s);
    ctx.quadraticCurveTo(25 * s, -12 * s, 29 * s, 31 * s);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.roundRect(-7 * s, -10 * s, 14 * s, 42 * s, 4 * s);
    ctx.fill();
    ctx.fillStyle = "#70f5ff";
    ctx.beginPath();
    ctx.roundRect(-5 * s, -7 * s, 10 * s, 20 * s, 3 * s);
    ctx.fill();

    ctx.fillStyle = "#d49362";
    ctx.beginPath();
    ctx.roundRect(-8 * s, -25 * s, 16 * s, 17 * s, 5 * s);
    ctx.fill();

    ctx.fillStyle = "#d28a62";
    ctx.beginPath();
    ctx.ellipse(-17 * s, -38 * s, 4 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(17 * s, -38 * s, 4 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const skin = ctx.createLinearGradient(-16 * s, -58 * s, 16 * s, -20 * s);
    skin.addColorStop(0, "#ffd9ac");
    skin.addColorStop(0.62, "#e79a67");
    skin.addColorStop(1, "#bc704f");
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0, -39 * s, 18 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const hair = ctx.createLinearGradient(-18 * s, -63 * s, 20 * s, -42 * s);
    hair.addColorStop(0, "#18101a");
    hair.addColorStop(1, "#422334");
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(-18 * s, -45 * s);
    ctx.bezierCurveTo(-19 * s, -61 * s, -6 * s, -68 * s, 10 * s, -63 * s);
    ctx.bezierCurveTo(20 * s, -59 * s, 24 * s, -50 * s, 17 * s, -42 * s);
    ctx.bezierCurveTo(7 * s, -47 * s, -5 * s, -48 * s, -18 * s, -45 * s);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(-7 * s, -59 * s);
    ctx.quadraticCurveTo(1 * s, -55 * s, 13 * s, -56 * s);
    ctx.stroke();

    ctx.strokeStyle = "#101827";
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.roundRect(-14 * s, -42 * s, 11 * s, 8 * s, 3.5 * s);
    ctx.roundRect(3 * s, -42 * s, 11 * s, 8 * s, 3.5 * s);
    ctx.moveTo(-3 * s, -38 * s);
    ctx.lineTo(3 * s, -38 * s);
    ctx.stroke();

    ctx.fillStyle = "rgba(112,245,255,0.18)";
    ctx.beginPath();
    ctx.roundRect(-13 * s, -41 * s, 9 * s, 6 * s, 3 * s);
    ctx.roundRect(4 * s, -41 * s, 9 * s, 6 * s, 3 * s);
    ctx.fill();

    ctx.fillStyle = "#101827";
    if (blink) {
      ctx.fillRect(-10 * s, -38 * s, 6 * s, 1.4 * s);
      ctx.fillRect(5 * s, -38 * s, 6 * s, 1.4 * s);
    } else {
      ctx.beginPath(); ctx.arc(-8 * s, -38 * s, 2.1 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(8 * s, -38 * s, 2.1 * s, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = "#70f5ff";
    ctx.beginPath();
    ctx.roundRect(16 * s, -42 * s, 4 * s, 13 * s, 2 * s);
    ctx.fill();
    ctx.strokeStyle = "#70f5ff";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(18 * s, -30 * s);
    ctx.quadraticCurveTo(14 * s, -26 * s, 8 * s, -25 * s);
    ctx.stroke();

    ctx.strokeStyle = "#2b1720";
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    if (mood === "worried") {
      ctx.moveTo(-13 * s, -48 * s);
      ctx.lineTo(-4 * s, -45 * s);
      ctx.moveTo(4 * s, -45 * s);
      ctx.lineTo(13 * s, -48 * s);
    } else if (mood === "exhausted") {
      ctx.moveTo(-12 * s, -45 * s);
      ctx.lineTo(-4 * s, -45 * s);
      ctx.moveTo(4 * s, -45 * s);
      ctx.lineTo(13 * s, -45 * s);
    } else if (mood === "proud") {
      ctx.moveTo(-12 * s, -48 * s);
      ctx.lineTo(-4 * s, -49 * s);
      ctx.moveTo(4 * s, -49 * s);
      ctx.lineTo(13 * s, -47 * s);
    } else {
      ctx.moveTo(-12 * s, -46 * s);
      ctx.lineTo(-4 * s, -48 * s);
      ctx.moveTo(4 * s, -48 * s);
      ctx.lineTo(13 * s, -45 * s);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(125,63,52,0.58)";
    ctx.lineWidth = 1.1 * s;
    ctx.beginPath();
    ctx.moveTo(1 * s, -36 * s);
    ctx.quadraticCurveTo(3 * s, -33 * s, 1 * s, -31 * s);
    ctx.stroke();

    ctx.strokeStyle = "#7d3f34";
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    if (mood === "worried") {
      ctx.moveTo(-7 * s, -25 * s);
      ctx.quadraticCurveTo(0, -30 * s, 8 * s, -25 * s);
    } else if (mood === "exhausted") {
      ctx.moveTo(-6 * s, -26 * s);
      ctx.lineTo(8 * s, -26 * s);
    } else if (mood === "proud") {
      ctx.moveTo(-8 * s, -29 * s);
      ctx.quadraticCurveTo(0, -21 * s, 11 * s, -29 * s);
    } else {
      ctx.moveTo(-7 * s, -28 * s);
      ctx.quadraticCurveTo(0, -23 * s, 9 * s, -28 * s);
    }
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(9 * s, -2 * s, 17 * s, 22 * s, 3 * s);
    ctx.fill();
    ctx.fillStyle = "#70f5ff";
    ctx.fillRect(12 * s, 2 * s, 11 * s, 2 * s);
    ctx.fillRect(12 * s, 8 * s, 7 * s, 2 * s);
    ctx.fillStyle = "#f0b676";
    ctx.beginPath();
    ctx.roundRect(-28 * s, -2 * s, 9 * s, 15 * s, 3 * s);
    ctx.fill();
    ctx.fillStyle = "#3d241d";
    ctx.fillRect(-26 * s, 1 * s, 5 * s, 10 * s);

    ctx.restore();
  }

  private drawAiChar(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, blink: boolean, mood: EngineerMood = "confident"): void {
    ctx.save();
    ctx.translate(cx, cy);

    const now = performance.now();
    const pulse = 0.5 + Math.sin(now / 480) * 0.5;           // 0→1 glow breath
    const fastPulse = 0.5 + Math.sin(now / 180) * 0.5;       // fast status blink

    const coreColor = mood === "worried" ? "#ffdc3f"
      : mood === "exhausted" ? "#ff4f81"
      : mood === "proud"     ? "#87ffc4"
      : "#70f5ff";
    const glowAlpha = 0.55 + pulse * 0.45;

    // ── Body ─────────────────────────────────────────────────────────────────
    ctx.shadowColor = coreColor;
    ctx.shadowBlur = (8 + pulse * 6) * s;
    const body = ctx.createLinearGradient(0, -12 * s, 0, 44 * s);
    body.addColorStop(0, "#1a3d58");
    body.addColorStop(0.5, "#0c1e33");
    body.addColorStop(1, "#040c18");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-28 * s, -10 * s, 56 * s, 54 * s, 14 * s);
    ctx.fill();
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 1.8 * s;
    ctx.globalAlpha = glowAlpha;
    ctx.beginPath();
    ctx.roundRect(-26 * s, -8 * s, 52 * s, 50 * s, 12 * s);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Chest display — version tag with blinking cursor
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(-19 * s, 2 * s, 38 * s, 16 * s, 4 * s);
    ctx.fill();
    ctx.fillStyle = coreColor;
    ctx.globalAlpha = 0.9;
    ctx.font = `bold ${Math.round(6.5 * s)}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = "middle";
    ctx.fillText("v5.9", -14 * s, 10 * s);
    if (fastPulse > 0.5) {
      ctx.fillRect(6 * s, 6 * s, 3 * s, 8 * s);  // blinking cursor
    }
    ctx.globalAlpha = 1;

    // Bottom status dots — 4 activity LEDs
    for (let i = 0; i < 4; i += 1) {
      const active = mood === "exhausted" ? i < 1
        : mood === "worried" ? i < 2
        : mood === "proud"   ? i === 3 && fastPulse > 0.5 || i < 3
        : i < 3 || fastPulse > 0.6;
      ctx.fillStyle = active ? coreColor : "rgba(112,245,255,0.2)";
      ctx.shadowColor = active ? coreColor : "transparent";
      ctx.shadowBlur = active ? 5 * s : 0;
      ctx.beginPath();
      ctx.arc((-12 + i * 9) * s, 32 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ── Head ─────────────────────────────────────────────────────────────────
    ctx.shadowColor = coreColor;
    ctx.shadowBlur = (12 + pulse * 8) * s;
    const head = ctx.createLinearGradient(-22 * s, -68 * s, 22 * s, -22 * s);
    head.addColorStop(0, "#1e3c62");
    head.addColorStop(0.45, "#0c1e37");
    head.addColorStop(1, "#060e1e");
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.roundRect(-26 * s, -68 * s, 52 * s, 46 * s, 13 * s);
    ctx.fill();
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 2 * s;
    ctx.globalAlpha = glowAlpha;
    ctx.beginPath();
    ctx.roundRect(-24 * s, -66 * s, 48 * s, 42 * s, 11 * s);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Neural node grid on head — 3×2 dots with connecting lines
    const nodes: [number, number][] = [
      [-14, -58], [0, -58], [14, -58],
      [-14, -44], [0, -44], [14, -44],
    ];
    const nodeConnections: [number, number][] = [
      [0,1],[1,2],[3,4],[4,5],[0,3],[1,4],[2,5],[0,4],[1,5],[1,3],
    ];
    ctx.strokeStyle = `rgba(112,245,255,0.18)`;
    ctx.lineWidth = 0.8 * s;
    for (const [a, b] of nodeConnections) {
      ctx.beginPath();
      ctx.moveTo(nodes[a][0] * s, nodes[a][1] * s);
      ctx.lineTo(nodes[b][0] * s, nodes[b][1] * s);
      ctx.stroke();
    }
    for (const [nx, ny] of nodes) {
      ctx.fillStyle = `rgba(112,245,255,${0.28 + pulse * 0.22})`;
      ctx.shadowColor = "#70f5ff";
      ctx.shadowBlur = 3 * s;
      ctx.beginPath();
      ctx.arc(nx * s, ny * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ── Eyes — large, mood-distinct ──────────────────────────────────────────
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(-20 * s, -62 * s, 38 * s, 14 * s, 4 * s);
    ctx.fill();

    ctx.fillStyle = coreColor;
    ctx.shadowColor = coreColor;
    ctx.shadowBlur = 7 * s;

    if (!blink) {
      // Eyes closed — thin horizontal bars
      ctx.fillRect(-17 * s, -57 * s, 14 * s, 2 * s);
      ctx.fillRect(3 * s,   -57 * s, 14 * s, 2 * s);
    } else if (mood === "confident") {
      // Solid square pupils — calm and alert
      ctx.beginPath();
      ctx.roundRect(-17 * s, -61 * s, 13 * s, 10 * s, 2 * s);
      ctx.roundRect(4 * s,   -61 * s, 13 * s, 10 * s, 2 * s);
      ctx.fill();
    } else if (mood === "proud") {
      // Upward arc — visibly happy
      ctx.lineWidth = 2.5 * s;
      ctx.strokeStyle = coreColor;
      ctx.beginPath();
      ctx.arc(-10 * s, -54 * s, 6 * s, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(11 * s, -54 * s, 6 * s, Math.PI, 0);
      ctx.stroke();
      // Pulsing ring on proud
      ctx.globalAlpha = 0.35 + pulse * 0.35;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(-10 * s, -57 * s, 9 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(11 * s, -57 * s, 9 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (mood === "worried") {
      // Diagonal slash pupils — tense
      ctx.lineWidth = 3 * s;
      ctx.strokeStyle = coreColor;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-17 * s, -61 * s); ctx.lineTo(-5 * s, -51 * s);
      ctx.moveTo(4 * s,   -61 * s); ctx.lineTo(16 * s, -51 * s);
      ctx.stroke();
      ctx.lineCap = "butt";
      // Worry ticks above each eye
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(-14 * s, -64 * s); ctx.lineTo(-10 * s, -62 * s);
      ctx.moveTo(7 * s,   -64 * s); ctx.lineTo(11 * s,  -62 * s);
      ctx.stroke();
    } else {
      // exhausted — narrow horizontal slit + droop marks
      ctx.fillRect(-17 * s, -57 * s, 13 * s, 3.5 * s);
      ctx.fillRect(4 * s,   -57 * s, 13 * s, 3.5 * s);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-17 * s, -53 * s, 13 * s, 2 * s);
      ctx.fillRect(4 * s,   -53 * s, 13 * s, 2 * s);
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;

    // ── Mouth — terminal-style, unambiguous per mood ──────────────────────────
    ctx.font = `bold ${Math.round(7 * s)}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = coreColor;
    ctx.shadowColor = coreColor;
    ctx.shadowBlur = 5 * s;
    const mouthY = -36 * s;
    if (mood === "confident") {
      ctx.fillText(">_", -10 * s, mouthY);
    } else if (mood === "proud") {
      ctx.fillText("^v^", -13 * s, mouthY);
    } else if (mood === "worried") {
      ctx.fillText("?!", -8 * s, mouthY);
    } else {
      ctx.fillText("—", -6 * s, mouthY);
    }
    ctx.shadowBlur = 0;

    // ── Antennas — mood reactive ──────────────────────────────────────────────
    ctx.lineWidth = 1.5 * s;
    if (mood === "worried") {
      // Droop inward
      ctx.strokeStyle = `rgba(112,245,255,0.5)`;
      ctx.beginPath();
      ctx.moveTo(-12 * s, -68 * s); ctx.lineTo(-18 * s, -80 * s);
      ctx.moveTo(12 * s,  -68 * s); ctx.lineTo(18 * s,  -80 * s);
      ctx.stroke();
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(-19 * s, -82 * s, 3 * s, 0, Math.PI * 2);
      ctx.arc(19 * s,  -82 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (mood === "exhausted") {
      // Limp downward
      ctx.strokeStyle = `rgba(112,245,255,0.3)`;
      ctx.beginPath();
      ctx.moveTo(-12 * s, -68 * s); ctx.quadraticCurveTo(-22 * s, -72 * s, -24 * s, -79 * s);
      ctx.moveTo(12 * s,  -68 * s); ctx.quadraticCurveTo(22 * s,  -72 * s, 24 * s,  -79 * s);
      ctx.stroke();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(-25 * s, -80 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.arc(25 * s,  -80 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (mood === "proud") {
      // Raised with halos
      ctx.strokeStyle = coreColor;
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = 8 * s;
      ctx.beginPath();
      ctx.moveTo(-10 * s, -68 * s); ctx.lineTo(-12 * s, -84 * s);
      ctx.moveTo(10 * s,  -68 * s); ctx.lineTo(12 * s,  -84 * s);
      ctx.stroke();
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(-12 * s, -86 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.arc(12 * s,  -86 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Halo rings
      ctx.globalAlpha = 0.3 + pulse * 0.35;
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.arc(-12 * s, -86 * s, 7 * s, 0, Math.PI * 2);
      ctx.arc(12 * s,  -86 * s, 7 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    } else {
      // Upright
      ctx.strokeStyle = `rgba(112,245,255,0.55)`;
      ctx.beginPath();
      ctx.moveTo(-10 * s, -68 * s); ctx.lineTo(-14 * s, -82 * s);
      ctx.moveTo(10 * s,  -68 * s); ctx.lineTo(14 * s,  -82 * s);
      ctx.stroke();
      ctx.fillStyle = coreColor;
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = 6 * s;
      ctx.beginPath();
      ctx.arc(-14 * s, -84 * s, 3.2 * s, 0, Math.PI * 2);
      ctx.arc(14 * s,  -84 * s, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // ── Arms / side panels ────────────────────────────────────────────────────
    ctx.fillStyle = "#070f1c";
    ctx.beginPath();
    ctx.roundRect(-42 * s, -2 * s, 14 * s, 26 * s, 6 * s);
    ctx.roundRect(28 * s,  -2 * s, 14 * s, 26 * s, 6 * s);
    ctx.fill();
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 1.4 * s;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.roundRect(-41 * s, -1 * s, 12 * s, 24 * s, 5 * s);
    ctx.roundRect(29 * s,  -1 * s, 12 * s, 24 * s, 5 * s);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Data cable loop on right arm
    ctx.strokeStyle = `rgba(112,245,255,0.35)`;
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.arc(35 * s, 10 * s, 4 * s, Math.PI * 0.6, Math.PI * 2.4);
    ctx.stroke();

    // ── Feet / base ───────────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(112,245,255,0.22)";
    ctx.beginPath();
    ctx.roundRect(-8 * s, 44 * s, 16 * s, 10 * s, 4 * s);
    ctx.fill();

    ctx.restore();
  }

  private drawGuideChar(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, blink: boolean, mood: EngineerMood = "confident"): void {
    if (this.level?.chapter === "production_floor") {
      this.drawAiChar(ctx, cx, cy, s, blink, mood);
    } else {
      this.drawDevChar(ctx, cx, cy, s, blink, mood);
    }
  }

  private drawDevDialog(ctx: CanvasRenderingContext2D): void {
    const patch = this.currentPatch();
    const blink = Math.floor(performance.now() / 500) % 4 !== 0;

    // Cap each line at 120 chars so nothing overflows
    const cap = (s: string) => s.length > 120 ? s.slice(0, 117) + "…" : s;
    const rawLines = this.devDialogLines.map(cap);

    // Measure total bubble content height
    const pad = 16;                // inner horizontal padding per side
    const bx = 128, bw = 550;
    const textW = bw - pad * 2;
    const fontSize = 16, lh = 22;
    const nameH = 28;              // "DEV" label + gap
    const hintH = 28;              // "tap to continue" hint
    const dotsH = 24;              // dot row

    // Pre-measure all lines combined
    let textBlockH = 0;
    rawLines.forEach((l, i) => {
      const h = wrappedHeight(ctx, l, textW, lh, fontSize);
      textBlockH += h;
      if (i < rawLines.length - 1) textBlockH += 10; // gap between lines
    });
    textBlockH = Math.max(textBlockH, lh); // at least one row

    const bh = nameH + textBlockH + dotsH + hintH + pad * 2;
    const panelH = bh + 80; // room for char below
    const panelTop = Math.max(40, 270 - panelH / 2);

    // Dark backdrop
    ctx.fillStyle = "rgba(6,9,24,0.88)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Outer panel
    drawPanel(ctx, 110, panelTop, 740, panelH, "rgba(10,15,36,0.97)", "#4a6fa5");

    // Patch badge top-right of panel
    drawTextPill(ctx, `PATCH ${patch.version}`, 710, panelTop + 30, "#111827", severityColor(patch.severity));

    // Dev character — right side of panel, vertically centered
    const charY = panelTop + panelH - 30;
    this.drawDevChar(ctx, 740, charY, 2.2, blink, engineerMoodForPatch(patch.severity));

    // Speech bubble — sized to content
    const by = panelTop + 20;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.strokeStyle = "#4a6fa5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.stroke();
    // Tail toward character
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.strokeStyle = "#4a6fa5";
    ctx.beginPath();
    ctx.moveTo(bx + bw, by + bh / 2 - 10);
    ctx.lineTo(bx + bw + 18, by + bh / 2);
    ctx.lineTo(bx + bw, by + bh / 2 + 10);
    ctx.fill();

    // "DEV" label
    drawText(ctx, "DEV", bx + pad, by + 20, 13, "#4a6fa5", "bold");

    // All lines stacked — setup first, punchline below with a subtle divider
    let textY = by + nameH + pad;
    rawLines.forEach((l, i) => {
      if (i === rawLines.length - 1 && rawLines.length > 1) {
        // Punchline separator
        ctx.fillStyle = "rgba(74,111,165,0.3)";
        ctx.fillRect(bx + pad, textY - 6, bw - pad * 2, 1);
        textY += 6;
      }
      const color = i === rawLines.length - 1 && rawLines.length > 1 ? "#fff5d6" : "#ffffff";
      drawWrappedText(ctx, l, bx + pad, textY, textW, lh, color, fontSize);
      textY += wrappedHeight(ctx, l, textW, lh, fontSize) + (i < rawLines.length - 1 ? 10 : 0);
    });

    // "Tap to continue" hint — pulsing, inside bubble near bottom
    const hintY = by + bh - hintH + 6;
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = pulse;
    drawText(ctx, "▶  TAP TO SHIP PATCH", VIEW_W / 2 - 10, hintY, 13, "#87ffc4", "bold");
    ctx.globalAlpha = 1;
  }

  private drawChapterIntro(ctx: CanvasRenderingContext2D, time: number): void {
    const sweep = (time / 18) % VIEW_W;
    ctx.fillStyle = "rgba(3,7,18,0.94)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(112,245,255,0.11)";
    for (let x = -80; x < VIEW_W + 120; x += 88) {
      ctx.fillRect(x + ((time / 40) % 88), 0, 2, VIEW_H);
    }
    ctx.fillStyle = "rgba(255,79,129,0.14)";
    ctx.fillRect(sweep - 40, 0, 8, VIEW_H);
    ctx.fillStyle = "rgba(255,220,63,0.12)";
    ctx.fillRect(sweep, 0, 3, VIEW_H);
    ctx.restore();

    drawPanel(ctx, 92, 70, 776, 394, "rgba(7, 14, 30, 0.94)", "#70f5ff");
    drawText(ctx, "CHAPTER 2 UNLOCKED", 140, 128, 20, "#70f5ff", "bold");
    drawText(ctx, "THE PRODUCTION FLOOR", 140, 178, 38, "#ffffff", "bold");
    drawWrappedText(
      ctx,
      "The human engineer has handed the build to an AI release overseer. Everything is faster, smoother, brighter, and much more interested in deleting you.",
      140,
      216,
      480,
      20,
      "#cde9ff",
      17,
    );

    const cards = [
      ["LASER GATES", "warns before firing"],
      ["RAZOR RAILS", "moving blade routes"],
      ["DOUBLE JUMP", "unlocks at Patch 4.2"],
    ];
    cards.forEach(([title, body], i) => {
      const x = 140 + i * 168;
      drawPanel(ctx, x, 306, 148, 78, "rgba(12, 22, 42, 0.88)", i === 2 ? "#ffdc3f" : "#58ffd4");
      drawText(ctx, title, x + 12, 330, 13, i === 2 ? "#ffdc3f" : "#70f5ff", "bold");
      drawWrappedText(ctx, body, x + 12, 354, 124, 15, "#fff5d6", 12);
    });

    const blink = Math.floor(time / 460) % 5 !== 0;
    this.drawAiChar(ctx, 736, 338, 2.05, blink, "worried");
    drawTextPill(ctx, "ENTER TO DEPLOY", 480, 426, "#111827", "#70f5ff");
    this.hot(350, 406, 260, 34, () => this.advanceChapterIntro());
  }

  private drawExhibitionIntro(ctx: CanvasRenderingContext2D, time: number): void {
    const sweep = (time / 14) % VIEW_W;
    ctx.fillStyle = "rgba(3,7,18,0.95)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = "rgba(255,220,63,0.10)";
    for (let x = -120; x < VIEW_W + 160; x += 120) {
      ctx.fillRect(x + ((time / 36) % 120), 0, 3, VIEW_H);
    }
    ctx.fillStyle = "rgba(112,245,255,0.10)";
    ctx.fillRect(sweep - 22, 0, 6, VIEW_H);
    ctx.fillStyle = "rgba(255,79,129,0.12)";
    ctx.fillRect(sweep + 24, 0, 3, VIEW_H);
    ctx.restore();

    drawSoftPanel(ctx, 84, 62, 792, 418, "rgba(7, 10, 26, 0.96)", "#ffdc3f");
    drawText(ctx, "JUDGE EXHIBITION", 130, 120, 38, "#ffffff", "bold");
    drawText(ctx, "Seven curated patches. No filler.", 132, 160, 20, "#70f5ff", "bold");
    drawWrappedText(
      ctx,
      "This route shows the joke, the mechanics, Chapter 2, double jump, and the finale without making judges clear all 55 levels first.",
      132,
      196,
      512,
      21,
      "#cde9ff",
      17,
    );

    const route = EXHIBITION_SEQUENCE
      .map((index) => this.run.levels[index]?.version ?? String(index + 1))
      .join("   ");
    drawPanel(ctx, 132, 282, 512, 46, "rgba(12, 22, 42, 0.88)", "#70f5ff");
    drawText(ctx, "EXHIBITION ROUTE", 150, 304, 12, "#70f5ff", "bold");
    drawText(ctx, route, 150, 322, 15, "#fff5d6", "bold");

    const cards = [
      ["PATCH JOKES", "bad updates"],
      ["ARCADE SKILL", "real hazards"],
      ["AI OVERSEER", "Chapter 2 payoff"],
    ];
    cards.forEach(([title, body], i) => {
      const x = 132 + i * 174;
      drawPanel(ctx, x, 346, 154, 66, "rgba(12, 22, 42, 0.88)", i === 1 ? "#ffdc3f" : "#58ffd4");
      drawText(ctx, title, x + 12, 370, 13, i === 1 ? "#ffdc3f" : "#70f5ff", "bold");
      drawText(ctx, body, x + 12, 394, 13, "#fff5d6", "bold");
    });

    const blink = Math.floor(time / 460) % 5 !== 0;
    this.drawAiChar(ctx, 746, 336, 2.1, blink, "proud");
    drawTextPill(ctx, "ENTER  START EXHIBITION", 506, 448, "#111827", "#ffdc3f");
    this.hot(340, 428, 332, 34, () => this.beginExhibition());
  }

  private drawPatchIntro(): void {
    const ctx = this.ctx;
    const patch = this.currentPatch();
    drawSoftPanel(ctx, 132, 116, 696, 300, "rgba(7, 10, 26, 0.94)", severityColor(patch.severity));
    const scanX = 132 + ((performance.now() / 12) % 696);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(scanX, 118, 4, 296);
    drawText(ctx, `PATCH ${patch.version}`, 174, 168, 24, severityColor(patch.severity), "bold");
    drawText(ctx, patch.headline, 174, 216, 33, "#ffffff", "bold");
    drawWrappedText(ctx, patch.note, 176, 258, 500, 18, "#cde9ff");
    drawText(ctx, patch.joke, 176, 330, 17, "#fff5d6", "bold");
    drawText(
      ctx,
      this.bonusChallengeActive ? truncateText(`Challenge Patch: ${this.challengeLabel()}`, 68) : "First pass objective: reach the exit.",
      176,
      362,
      16,
      this.bonusChallengeActive ? "#ff9aa7" : "#87ffc4",
      "bold",
    );
    const blink = Math.floor(performance.now() / 500) % 5 !== 0;
    this.drawGuideChar(ctx, 746, 334, 1.25, blink, engineerMoodForPatch(patch.severity));
    drawTextPill(ctx, "ENTER TO SHIP", 480, 386, "#111827", severityColor(patch.severity));
    this.hot(350, 366, 260, 34, () => this.startPlaying(performance.now()));
  }

  private drawPausedScreen(): void {
    const ctx = this.ctx;
    drawSoftPanel(ctx, 226, 168, 508, 210, "rgba(8, 11, 28, 0.94)", "#70f5ff");
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
    const patch = this.currentPatch();
    drawSoftPanel(ctx, 150, 140, 660, 262, "rgba(7, 10, 26, 0.95)", "#ff4f81");
    drawText(ctx, "GAME OVER", 200, 192, 36, "#ffffff", "bold");
    drawText(ctx, this.lastDeathReason || "Patch rejected", 200, 228, 16, "#ffdc3f", "bold");
    drawText(ctx, `${this.level.title} · ${this.deaths} run deaths`, 200, 252, 14, "#9fc7ff");

    // Dev character on the right side of the panel
    const blink = Math.floor(performance.now() / 500) % 3 !== 0;
    this.drawGuideChar(ctx, 756, 310, 1.8, blink, this.levelDeaths >= 3 ? "exhausted" : "worried");

    // Death line — pick based on levelDeaths, cap at 120 chars
    const deathLines = patch.deathLines ?? [];
    const rawDeath = deathLines.length > 0
      ? deathLines[Math.min(this.levelDeaths - 1, deathLines.length - 1)]
      : this.run.gameOverSummary;
    const deathLine = rawDeath.length > 120 ? rawDeath.slice(0, 117) + "…" : rawDeath;

    // Size bubble to content
    const bx = 168, bw = 522, pad = 12, fontSize = 15, lh = 20;
    const textH = wrappedHeight(ctx, deathLine, bw - pad * 2, lh, fontSize);
    const bh = textH + pad * 2 + 8;
    const by = 262;

    ctx.fillStyle = "rgba(255,79,129,0.08)";
    ctx.strokeStyle = "#ff4f81";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,79,129,0.08)";
    ctx.strokeStyle = "#ff4f81";
    ctx.beginPath();
    ctx.moveTo(bx + bw, by + bh / 2 - 6);
    ctx.lineTo(bx + bw + 14, by + bh / 2);
    ctx.lineTo(bx + bw, by + bh / 2 + 6);
    ctx.fill();
    ctx.stroke();
    drawWrappedText(ctx, deathLine, bx + pad, by + pad + fontSize, bw - pad * 2, lh, "#ffffff", fontSize);

    const btnY = by + bh + 14;
    drawPanel(ctx, 346, btnY, 148, 28, "rgba(0,0,0,0.4)", "#ff4f81");
    drawText(ctx, "Restart →", 358, btnY + 19, 13, "#ff4f81", "bold");
    this.hot(346, btnY, 148, 28, () => { this.resetLevel(); this.startLevelIntro(); });
  }

  private drawLevelComplete(): void {
    const ctx = this.ctx;
    const now = performance.now();
    const patch = this.currentPatch();
    const result = this.results[this.levelIndex];
    const medal = result?.medal ?? "shipped";
    const h = this.bonusChallengeActive ? 230 : 200;
    drawSoftPanel(ctx, 210, 166, 540, h, "rgba(8, 11, 28, 0.96)", medalColor(medal));
    drawText(ctx, "PATCH SHIPPED", 256, 222, 34, "#ffffff", "bold");
    drawText(ctx, `Patch ${patch.version}`, 258, 258, 18, "#cde9ff", "bold");
    drawText(ctx, medal.toUpperCase(), 420, 258, 22, medalColor(medal), "bold");
    if (now < this.medalRevealUntil) {
      const t = clamp((this.medalRevealUntil - now) / 920, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.24 + t * 0.36;
      ctx.strokeStyle = medalColor(medal);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(518, 250, 18 + (1 - t) * 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (result) {
      drawText(ctx, `${result.seconds.toFixed(1)}s  ·  ${result.coins} coins  ·  ${result.deaths}d`, 258, 284, 15, "#fff5d6");
    }
    if (this.bonusChallengeActive) {
      const cleared = Boolean(result?.challenge);
      drawText(
        ctx,
        cleared ? "CHALLENGE STAR EARNED" : "Challenge missed",
        258, 312, 15,
        cleared ? "#ffdc3f" : "#7c8dbb",
        "bold",
      );
      if (cleared && now < this.medalRevealUntil) {
        drawText(ctx, "★", 538, 314, 22 + Math.sin(now / 80) * 2, "#ffdc3f", "bold");
      }
    }
    const unlockVisible = this.level.id === 28 && now < this.doubleJumpUnlockUntil;
    if (unlockVisible) {
      drawPanel(ctx, 258, this.bonusChallengeActive ? 328 : 300, 318, 34, "rgba(12, 22, 42, 0.92)", "#70f5ff");
      drawText(ctx, "DOUBLE JUMP UNLOCKED", 276, this.bonusChallengeActive ? 350 : 322, 15, "#70f5ff", "bold");
      drawJumpPip(ctx, 526, this.bonusChallengeActive ? 338 : 310, true);
      drawJumpPip(ctx, 542, this.bonusChallengeActive ? 338 : 310, true);
    }
    const nextY = unlockVisible ? (this.bonusChallengeActive ? 388 : 360) : this.bonusChallengeActive ? 352 : 322;
    drawText(ctx, this.highlightRunActive ? "R replay   Enter next exhibition level" : "R replay   Enter continue", 258, nextY, 15, "#9fc7ff", "bold");
    this.hot(210, nextY - 18, 210, 26, () => { this.resetLevel(); this.startLevelIntro(); this.audio.play("restart"); });
    this.hot(420, nextY - 18, 330, 26, () => this.advanceLevel());

    // Dev character with joke bubble at bottom-right of complete panel
    const blink = Math.floor(performance.now() / 500) % 8 !== 0;
    const devX = 820, devY = this.bonusChallengeActive ? 440 : 420;
    this.drawGuideChar(ctx, devX, devY, 1.6, blink, "proud");
    // Joke bubble — auto-sized, capped at 120 chars
    const rawJoke = patch.devLines?.[patch.devLines.length - 1] ?? patch.joke;
    const joke = rawJoke.length > 120 ? rawJoke.slice(0, 117) + "…" : rawJoke;
    const jpad = 10, jfs = 13, jlh = 18, jbw = 224;
    const jbx = devX - jbw - 18;
    const jtextH = wrappedHeight(ctx, joke, jbw - jpad * 2, jlh, jfs);
    const jbh = jtextH + jpad * 2 + 4;
    const jby = devY - 40 - jbh / 2;
    ctx.fillStyle = "rgba(10,15,36,0.92)";
    ctx.strokeStyle = medalColor(medal);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(jbx, jby, jbw, jbh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(10,15,36,0.92)";
    ctx.strokeStyle = medalColor(medal);
    ctx.beginPath();
    ctx.moveTo(jbx + jbw, jby + jbh / 2 - 6);
    ctx.lineTo(jbx + jbw + 12, jby + jbh / 2);
    ctx.lineTo(jbx + jbw, jby + jbh / 2 + 6);
    ctx.fill();
    ctx.stroke();
    drawWrappedText(ctx, joke, jbx + jpad, jby + jpad + jfs, jbw - jpad * 2, jlh, "#fff5d6", jfs);
  }

  private drawWinScreen(): void {
    const ctx = this.ctx;
    const now = performance.now();
    const runPauseAdjust = this.runPauseStart > 0 ? now - this.runPauseStart : 0;
    const measuredSeconds = Math.max(0, (now - this.runStartedAt - this.runPausedMs - runPauseAdjust) / 1000);
    const completedResults = this.results.filter((result): result is LevelResult => Boolean(result));
    const resultSeconds = completedResults.reduce((total, result) => total + result.seconds, 0);
    const totalSecondsValue = this.highlightRunActive && resultSeconds > 0 ? resultSeconds : measuredSeconds;
    const totalSeconds = totalSecondsValue.toFixed(1);
    const score = scoreRun({
      seconds: totalSecondsValue,
      deaths: this.deaths,
      coins: this.totalCoins,
      reports: this.totalReports,
      results: completedResults,
    });
    if (score > this.bestScore) {
      this.bestScore = score;
      saveBestScore(score);
    }
    const grade = releaseGrade(score);
    const gradeColor = grade === "S" ? "#ffdc3f" : grade === "A" ? "#87ffc4" : grade === "B" ? "#cde9ff" : "#ff9a3d";

    drawSoftPanel(ctx, 54, 26, 852, 488, "rgba(7, 10, 26, 0.96)", "#87ffc4");
    drawText(ctx, this.highlightRunActive ? "EXHIBITION COMPLETE" : "ALL PATCHES DEPLOYED", 100, 82, 36, "#ffffff", "bold");

    const starDenom = this.highlightRunActive ? HIGHLIGHT_SEQUENCE.length : levels.length;
    drawText(ctx, `Grade ${grade}`, 100, 122, 22, gradeColor, "bold");
    drawText(ctx, `Score ${score}`, 248, 122, 20, "#ffdc3f", "bold");
    drawText(ctx, `Best ${this.bestScore}`, 510, 122, 16, "#87ffc4", "bold");
    drawText(ctx, `Stars ${this.totalReports}/${starDenom}`, 700, 122, 16, "#ff9aa7", "bold");
    drawText(ctx, `Time ${totalSeconds}s   Deaths ${this.deaths}   Coins ${this.totalCoins}`, 100, 148, 15, "#cde9ff", "bold");

    drawText(ctx, this.highlightRunActive ? "Exhibition Route" : "Release Record", 100, 176, 14, "#ffffff", "bold");
    // Grid: 8 cols × up to 7 rows fits 55 results in 168px (gridY 194 → 362), leaving room for report at 368.
    const columns = 8;
    const colW = 104;
    const gridX = 100;
    const gridY = 194;
    const rowH = 16;
    const recordResults = this.highlightRunActive ? completedResults : this.results.filter((result): result is LevelResult => Boolean(result));
    for (let i = 0; i < recordResults.length && i < levels.length; i++) {
      const result = recordResults[i];
      const col = i % columns;
      const row = Math.floor(i / columns);
      const rx = gridX + col * colW;
      const ry = gridY + row * rowH;
      drawText(ctx, result.patch, rx, ry, 11, "#9fc7ff", "bold");
      drawText(ctx, result.medal.slice(0, 3).toUpperCase(), rx + 32, ry, 10, medalColor(result.medal), "bold");
      if (result.challenge) drawText(ctx, "★", rx + 58, ry, 10, "#ffdc3f", "bold");
    }

    const stability = this.deaths === 0 && this.totalReports >= starDenom ? "stable, suspiciously" : this.deaths <= 3 ? "stable enough to demo" : "stable after several negotiations";
    const productionReport = this.level?.chapter === "production_floor";
    const failure = this.lastDeathReason || (this.deaths === 0 ? (productionReport ? "No notable crashes. The AI is suspicious." : "No notable crashes. The engineer is unsettled.") : "Unlabeled regression");
    const failureSummary = this.deaths === 0 ? "none logged" : truncateText(failure, 28);
    const routeSummary = EXHIBITION_SEQUENCE.map((index) => this.run.levels[index]?.version ?? String(index + 1)).join(" -> ");
    const reportLines = this.highlightRunActive
      ? [
          "AI exhibition report: seven curated patches deployed.",
          `Route ${routeSummary}.`,
          `Deaths ${this.deaths}. Favorite failure: ${failureSummary}.`,
        ]
      : [
          `${productionReport ? "AI release report" : "Engineer report"}: release is ${stability}.`,
          `Stars ${this.totalReports}/${starDenom}. Deaths ${this.deaths}. Favorite failure: ${failureSummary}.`,
          this.run.recapPrompts[0] ?? "The release notes say everything is fine. Nobody signed them.",
        ];
    let ry = 330;
    for (const line of reportLines) {
      drawText(ctx, truncateText(line, 66), 100, ry, 13, "#fff5d6");
      ry += 20;
    }
    const blink = Math.floor(now / 500) % 8 !== 0;
    this.drawGuideChar(ctx, 826, 390, 1.12, blink, this.deaths <= 1 ? "proud" : "exhausted");

    drawText(ctx, this.highlightRunActive ? "Choose Level opens every patch, including the full Production Floor finale." : this.shareUrl, 100, 414, 11, "#9fc7ff", "bold");

    drawTextPill(ctx, "R  NEW RUN", 228, 462, "#111827", "#ffdc3f");
    this.hot(116, 442, 224, 34, () => { this.startRunAt(0); this.audio.play("start"); });
    drawTextPill(ctx, "ENTER  CHOOSE LEVEL", 680, 462, "#111827", "#87ffc4");
    this.hot(488, 442, 384, 34, () => { this.setMode("releaseBoard"); this.audio.play("start"); });
  }

  private drawCenteredPanel(title: string, subtitle: string): void {
    const ctx = this.ctx;
    drawSoftPanel(ctx, 260, 196, 440, 150, "rgba(8, 11, 28, 0.94)", "#70f5ff");
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
    if (code === "Escape") {
      if (this.resetConfirmPending) { this.resetConfirmPending = false; return; }
      this.setMode(this.settingsPrevMode);
      return;
    }
    if (this.settingsRow === 6) {
      if (code === "ArrowLeft")  { this.jumpToLevelValue = Math.max(1, this.jumpToLevelValue - 1); return; }
      if (code === "ArrowRight") { this.jumpToLevelValue = Math.min(levels.length, this.jumpToLevelValue + 1); return; }
    }
    if (code === "ArrowUp")   { this.resetConfirmPending = false; this.settingsRow = (this.settingsRow - 1 + SETTINGS_ROWS) % SETTINGS_ROWS; return; }
    if (code === "ArrowDown") { this.resetConfirmPending = false; this.settingsRow = (this.settingsRow + 1) % SETTINGS_ROWS; return; }
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
      case 6:
        this.startRunAt(this.jumpToLevelValue - 1);
        this.audio.play("start");
        break;
      case 7:
        if (this.resetConfirmPending) {
          // Confirmed — wipe all game data and reload
          try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith("escapePatch")) keysToRemove.push(k);
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
          } catch {}
          window.location.reload();
        } else {
          this.resetConfirmPending = true;
        }
        break;
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

    drawPanel(ctx, 80, 26, 800, 520, "rgba(7, 10, 26, 0.95)", "#7767ff");
    drawText(ctx, "SETTINGS", 118, 80, 30, "#ffffff", "bold");
    drawPanel(ctx, 746, 58, 112, 28, "rgba(0,0,0,0.4)", "#9fc7ff");
    drawText(ctx, "← Back", 758, 77, 13, "#9fc7ff", "bold");
    this.hot(746, 58, 112, 28, () => { this.resetConfirmPending = false; this.setMode(this.settingsPrevMode); });

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

    if (row === 6) {
      ctx.fillStyle = "rgba(119,103,255,0.16)";
      ctx.fillRect(98, 428, 764, 44);
    }
    drawText(ctx, "Jump to Level", 118, 454, 14, row === 6 ? "#ffffff" : "#cde9ff", "bold");
    // ← [N] → picker
    const jtl = this.jumpToLevelValue;
    const jtlPatch = this.run.levels[jtl - 1];
    const jtlSelected = row === 6;
    drawPanel(ctx, 296, 433, 24, 22, "rgba(0,0,0,0.4)", jtlSelected ? "#7767ff" : "#40517f");
    drawText(ctx, "‹", 302, 449, 14, jtlSelected ? "#cde9ff" : "#40517f", "bold");
    drawPanel(ctx, 324, 433, 72, 22, "rgba(0,0,0,0.4)", jtlSelected ? "#ffdc3f" : "#40517f");
    drawText(ctx, String(jtl), 348, 449, 13, "#ffffff", "bold");
    drawPanel(ctx, 400, 433, 24, 22, "rgba(0,0,0,0.4)", jtlSelected ? "#7767ff" : "#40517f");
    drawText(ctx, "›", 406, 449, 14, jtlSelected ? "#cde9ff" : "#40517f", "bold");
    if (jtlPatch) {
      drawText(ctx, `${jtlPatch.version} — ${jtlPatch.headline.slice(0, 38)}`, 436, 449, 12, "#cde9ff");
    }
    if (jtlSelected) drawText(ctx, "Enter to launch", 436, 463, 11, "#7767ff");
    this.hot(296, 433, 24, 22, () => { this.jumpToLevelValue = Math.max(1, jtl - 1); this.settingsRow = 6; });
    this.hot(400, 433, 24, 22, () => { this.jumpToLevelValue = Math.min(levels.length, jtl + 1); this.settingsRow = 6; });
    this.hot(324, 433, 72, 22, () => { this.settingsRow = 6; this.activateSettingsRow(); });

    // ── Factory Reset ─────────────────────────────────────────
    const resetY = 476;
    if (row === 7) {
      ctx.fillStyle = "rgba(255,79,129,0.10)";
      ctx.fillRect(98, resetY, 764, 34);
    }
    drawText(ctx, "Factory Reset", 118, resetY + 22, 14, row === 7 ? "#ff4f81" : "#cde9ff", "bold");
    if (this.resetConfirmPending) {
      drawPanel(ctx, 296, resetY + 4, 440, 24, "rgba(0,0,0,0.5)", "#ff4f81");
      drawText(ctx, "Erase all progress? Enter to confirm · Esc to cancel", 304, resetY + 20, 12, "#ff9aa7", "bold");
    } else {
      drawPanel(ctx, 296, resetY + 4, 180, 24, "rgba(0,0,0,0.45)", row === 7 ? "#ff4f81" : "#40517f");
      drawText(ctx, "Reset all progress", 304, resetY + 20, 12, row === 7 ? "#ff4f81" : "#7c8dbb", "bold");
      if (row === 7) drawText(ctx, "Enter to reset", 490, resetY + 20, 11, "#7767ff");
    }
    this.hot(98, resetY, 764, 34, () => { this.settingsRow = 7; });

    drawText(ctx, "↑ ↓  navigate     Enter  activate     Esc  back", 118, 524, 12, "rgba(156,199,255,0.4)");
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
      startExhibition: () => {
        this.startExhibitionRun();
        return this.debugSnapshot();
      },
      startHighlights: () => {
        this.startHighlightRun();
        return this.debugSnapshot();
      },
      completeLevel: (seconds?: number) => {
        const challengePar = this.bonusChallengeActive ? this.level.challenge?.parTime : undefined;
        const elapsed = seconds ?? Math.max(1, (challengePar ?? this.currentPatch().targetTime) * 0.8);
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
        for (const coin of this.level.coins) {
          coin.collected = true;
        }
        this.levelCoins = this.level.coins.reduce((total, coin) => total + coin.value, 0);
        this.sensorTrips = 0;
        this.rollbackUses = 0;
        this.secondJumpUsed = false;
        this.exitedPadIndex = 0;
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
      highlightRunActive: this.highlightRunActive,
      doubleJumpUnlocked: this.hasDoubleJumpUnlocked(),
      challengeComplete: this.bonusChallengeActive && this.isChallengeComplete(this.levelElapsed(performance.now())),
      reportVisible: Boolean(this.bonusChallengeActive && this.challengeType() === "bug_report" && this.level.bugReport && !this.level.bugReport.collected),
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

    const candidate = await response.json();
    return isCompatibleRun(candidate) ? candidate : fallback;
  } catch {
    return fallback;
  }
}

function isCompatibleRun(value: unknown): value is PatchRun {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as PatchRun).levels) &&
    (value as PatchRun).levels.length === levels.length
  );
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

function truncateText(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function boardPageRange(selection: number, totalLevels: number): { page: number; totalPages: number; start: number; end: number } {
  const totalPages = totalLevels > CHAPTER_TWO_START_INDEX ? 2 : 1;
  const page = clamp(selection >= CHAPTER_TWO_START_INDEX ? 1 : 0, 0, totalPages - 1);
  const start = page === 0 ? 0 : CHAPTER_TWO_START_INDEX;
  const end = page === 0 ? Math.min(CHAPTER_TWO_START_INDEX - 1, totalLevels - 1) : totalLevels - 1;
  return { page, totalPages, start, end };
}

function previousBoardPageStart(selection: number, totalLevels: number): number {
  const range = boardPageRange(selection, totalLevels);
  const page = clamp(range.page - 1, 0, range.totalPages - 1);
  return page === 0 ? 0 : CHAPTER_TWO_START_INDEX;
}

function nextBoardPageStart(selection: number, totalLevels: number): number {
  const range = boardPageRange(selection, totalLevels);
  const page = clamp(range.page + 1, 0, range.totalPages - 1);
  return page === 0 ? 0 : CHAPTER_TWO_START_INDEX;
}

function boardColumnsForRange(range: { start: number; end: number }): number {
  return range.end - range.start + 1 > 10 ? 5 : 2;
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
    case "wide_world":
      return "Two-screen wide";
    case "tall_world":
      return "Two-screen tall";
    case "moving_platforms_h":
      return "Moving platforms";
    case "headwind":
      return "Headwind active";
    case "production_intro":
      return "Conveyors";
    case "security_lasers":
      return "Laser gates";
    case "double_jump_unlock":
      return "Double jump";
    case "razor_rails":
      return "Razor rails";
    case "sweep_lasers":
      return "Sweep lasers";
    case "crusher_panels":
      return "Crushers";
    case "tesla_arcs":
      return "Tesla arcs";
    case "security_sensors":
      return "Sensors";
    case "plasma_vents":
      return "Plasma vents";
    case "production_finale":
      return "Production finale";
  }
}

function chapterLabelForLevel(level: LevelDefinition | undefined): string {
  return level?.chapter === "production_floor" ? "Chapter 2: The Production Floor" : "Chapter 1: The Patch Train";
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

function shrinkRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x + amount,
    y: rect.y + amount,
    w: Math.max(0, rect.w - amount * 2),
    h: Math.max(0, rect.h - amount * 2),
  };
}

function teslaHitbox(arc: TeslaArc): Rect {
  const thickness = arc.thickness ?? 16;
  const minX = Math.min(arc.x1, arc.x2) - thickness / 2;
  const minY = Math.min(arc.y1, arc.y2) - thickness / 2;
  const maxX = Math.max(arc.x1, arc.x2) + thickness / 2;
  const maxY = Math.max(arc.y1, arc.y2) + thickness / 2;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function plasmaBeamRect(vent: PlasmaVent): Rect {
  switch (vent.direction) {
    case "up":
      return { x: vent.x, y: vent.y - vent.length, w: vent.w, h: vent.length };
    case "down":
      return { x: vent.x, y: vent.y + vent.h, w: vent.w, h: vent.length };
    case "left":
      return { x: vent.x - vent.length, y: vent.y, w: vent.length, h: vent.h };
    case "right":
      return { x: vent.x + vent.w, y: vent.y, w: vent.length, h: vent.h };
  }
}

function drawRect(ctx: CanvasRenderingContext2D, rect: Rect, fill: string, stroke: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, Math.min(5, rect.h / 2, rect.w / 2));
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, Math.min(4, rect.h / 2, rect.w / 2));
  ctx.stroke();
}

function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 7);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 5, w - 16, 2, 1);
  ctx.fill();
}

function drawSoftPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke: string): void {
  ctx.save();
  ctx.shadowColor = stroke;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 7;
  drawPanel(ctx, x, y, w, h, fill, stroke);
  ctx.restore();
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

// Splits text into wrapped lines that fit within maxWidth at the given fontSize.
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] {
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color: string,
  fontSize = 15,
): void {
  const lines = wrapLines(ctx, text, maxWidth, fontSize);
  lines.forEach((l, i) => drawText(ctx, l, x, y + i * lineHeight, fontSize, color));
}

// Returns total pixel height consumed by drawWrappedText for the given text.
function wrappedHeight(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number, fontSize = 15): number {
  const n = wrapLines(ctx, text, maxWidth, fontSize).length;
  return Math.max(1, n) * lineHeight;
}

function drawTextPill(ctx: CanvasRenderingContext2D, text: string, centerX: number, centerY: number, color: string, fill: string): void {
  ctx.font = "bold 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const width = Math.ceil(ctx.measureText(text).width + 34);
  const x = centerX - width / 2;
  const y = centerY - 20;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, 34, 7);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, width - 2, 32, 6);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, x + 17, y + 23);
}

function drawJumpPip(ctx: CanvasRenderingContext2D, x: number, y: number, available: boolean): void {
  ctx.fillStyle = available ? "#70f5ff" : "rgba(112,245,255,0.18)";
  ctx.fillRect(x, y, 10, 10);
  ctx.strokeStyle = "#70f5ff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 9, 9);
}

function severityLabel(severity: LevelPatch["severity"]): string {
  return severity === "stable" ? "STABLE" : severity === "rollback" ? "ROLLBACK" : `${severity.toUpperCase()} PATCH`;
}

function engineerMoodForPatch(severity: LevelPatch["severity"]): EngineerMood {
  if (severity === "critical") return "exhausted";
  if (severity === "major") return "worried";
  if (severity === "stable") return "proud";
  return "confident";
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

function isMobileUA(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isTouchEnabled(): boolean {
  try {
    const stored = localStorage.getItem("escapePatchNotesTouch");
    if (stored !== null) return stored === "true";
    return isMobileUA();
  } catch { return isMobileUA(); }
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

  // Five music themes — each has lead (32 notes), bass (16 notes), beat interval
  private static readonly THEMES = {
    // tense: C Aeolian, default for standard levels
    tense: {
      lead: [392, 523, 622, 784,   831, 784, 622, 587,   523, 622, 698, 784,   698, 622, 587, 523,
             784, 831, 784, 698,   622, 698, 784, 0,     523, 587, 622, 784,   698, 622, 587, 523],
      bass: [262, 392,   415, 311,   262, 349,   392, 0,   262, 311,   349, 392,   415, 392,   262, 262],
      beat: 0.165,
    },
    // frantic: faster, chromatic urgency — coin magnet, crumbling, finales
    frantic: {
      lead: [523, 587, 622, 784,   831, 784, 622, 523,   622, 784, 831, 932,   831, 784, 622, 523,
             784, 831, 932, 831,   698, 784, 831, 698,   622, 698, 784, 831,   784, 622, 523, 622],
      bass: [262, 415,   466, 311,   262, 415,   392, 311,   311, 466,   415, 466,   466, 392,   262, 415],
      beat: 0.128,
    },
    // eerie: whole-tone intervals, spacious — rotated gravity, async, wide/tall
    eerie: {
      lead: [415, 523, 659, 784,   0, 784, 659, 523,   523, 659, 831, 0,     932, 831, 659, 523,
             659, 784, 932, 784,   659, 523, 415, 0,   523, 415, 554, 659,   784, 659, 554, 415],
      bass: [207, 311,   415, 554,   207, 415,   554, 0,   311, 415,   554, 415,   311, 207,   311, 207],
      beat: 0.200,
    },
    // rolling: driving arpeggios — moving platforms, moving exit
    rolling: {
      lead: [523, 659, 784, 523,   659, 784, 880, 659,   784, 880, 932, 784,   880, 784, 659, 523,
             622, 784, 932, 784,   622, 523, 415, 523,   659, 784, 880, 784,   659, 523, 622, 523],
      bass: [262, 392,   523, 392,   311, 466,   523, 466,   262, 392,   466, 392,   349, 523,   466, 349],
      beat: 0.148,
    },
    // wind: wavering suspended harmony — headwind levels
    wind: {
      lead: [466, 523, 587, 523,   466, 415, 466, 523,   587, 622, 587, 523,   466, 415, 392, 415,
             466, 523, 587, 622,   587, 523, 466, 415,   392, 415, 466, 523,   587, 523, 466, 392],
      bass: [233, 349,   392, 311,   233, 311,   349, 233,   311, 349,   392, 349,   311, 233,   311, 233],
      beat: 0.178,
    },
  } as const;

  themeKey: keyof typeof AudioBus.THEMES = "tense";
  get currentThemeKey() { return this.themeKey; }
  private bassGain?: GainNode;
  private bassBeat = 0;
  private bassNextTime = 0;

  switchTheme(modifier: PatchModifier): void {
    const key = AudioBus.themeKeyFor(modifier);
    if (key === this.themeKey) return;
    this.themeKey = key;
    // Reset beat counters — pumpMusic will pick up the new arrays on next tick
    // (notes already queued in the audio buffer play out naturally, ~0.4s max)
    this.musicBeat = 0;
    this.bassBeat = 0;
  }

  private static themeKeyFor(mod: PatchModifier): keyof typeof AudioBus.THEMES {
    if (mod === "coin_spike_magnet" || mod === "crumbling_platforms" || mod === "finale_combo") return "frantic";
    if (mod === "rotated_gravity" || mod === "async_platforms" || mod === "wide_world" || mod === "tall_world" || mod === "tesla_arcs" || mod === "plasma_vents") return "eerie";
    if (mod === "moving_platforms_h" || mod === "moving_exit" || mod === "production_intro" || mod === "sweep_lasers" || mod === "razor_rails") return "rolling";
    if (mod === "headwind" || mod === "security_lasers" || mod === "security_sensors" || mod === "crusher_panels" || mod === "production_finale") return "wind";
    return "tense";
  }

  toggle(): void {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.06);
    }
  }

  startMusic(): void {
    if (this.musicRunning || !this.ctx || !this.masterGain) return;
    this.musicRunning = true;
    const t = this.ctx.currentTime + 0.2;

    // Lead voice — square wave melody
    const mg = this.ctx.createGain();
    mg.gain.value = 0.020;
    mg.connect(this.masterGain);
    this.musicGain = mg;
    this.musicBeat = 0;
    this.musicNextTime = t;

    // Bass voice — triangle wave, half speed
    const bg = this.ctx.createGain();
    bg.gain.value = 0.016;
    bg.connect(this.masterGain);
    this.bassGain = bg;
    this.bassBeat = 0;
    this.bassNextTime = t;

    this.pumpMusic();
  }

  private pumpMusic(): void {
    if (!this.ctx || !this.musicGain || !this.musicRunning) return;
    const ahead = 0.4;
    const theme = AudioBus.THEMES[this.themeKey];
    const { beat } = theme;
    const lead = theme.lead as readonly number[];
    const bass = theme.bass as readonly number[];

    // Schedule lead notes
    while (this.musicNextTime < this.ctx.currentTime + ahead) {
      const freq = lead[this.musicBeat % lead.length];
      if (freq > 0) this.scheduleNote(this.musicNextTime, freq, beat * 0.74, this.musicGain!, "square");
      this.musicBeat++;
      this.musicNextTime += beat;
    }

    // Schedule bass notes at 2× beat interval
    if (this.bassGain) {
      while (this.bassNextTime < this.ctx.currentTime + ahead) {
        const freq = bass[this.bassBeat % bass.length];
        if (freq > 0) this.scheduleNote(this.bassNextTime, freq, beat * 1.7, this.bassGain, "triangle");
        this.bassBeat++;
        this.bassNextTime += beat * 2;
      }
    }

    this.musicTimer = window.setTimeout(() => this.pumpMusic(), 110);
  }

  private scheduleNote(time: number, freq: number, dur: number, dest: GainNode, type: OscillatorType): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(1, time + 0.010);
    env.gain.setValueAtTime(1, time + dur * 0.52);
    env.gain.linearRampToValueAtTime(0.0001, time + dur);
    osc.connect(env).connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  play(kind: "start" | "jump" | "doubleJump" | "coin" | "rollback" | "break" | "die" | "error" | "restart" | "complete" | "win" | "intro"): void {
    this.ensureCtx();
    if (!this.musicRunning) this.startMusic();
    if (this.muted || !this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const freqs: Record<string, number> = {
      start: 440, jump: 520, doubleJump: 880, coin: 760, rollback: 320,
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
