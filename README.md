# Escape the Patch Notes

**A platformer slowly ruined by updates.**

**Play now: https://escape-the-patch-notes.vercel.app**

Escape the Patch Notes is a browser platformer where every level introduces a new suspicious patch note. The first level behaves like a normal coin-and-exit platformer. Then the updates arrive: jump height gets nerfed, coins attract spikes, gravity rotates, platforms crumble, exits charge fees, and the final release bundles the previous mistakes together.

## What I Made

- A playable Vite + TypeScript + Canvas game with 10 short levels plus a finale (Patch 1.0 through 2.0).
- Deterministic platformer physics, fixed level layouts, restarts, pause, Release Board level select, win screen, scoring, medals, persistent progress, and shareable run seeds.
- Chiptune background music (Web Audio lookahead scheduler), pitch-shifted intro sounds per patch, particle bursts, and screen shake for each meaningful event.
- Release-train progress indicator in the HUD showing all 11 patches by medal color as you advance.
- Per-level patch completion cards with time, coins, deaths, and bug-report status at a glance.
- Full release report on the win screen: all 11 level medals, time, deaths, coins, and recap prompts.
- Completion-gated bug-report replay challenge: once you beat a level, replaying shows a hidden bug-report collectible that improves medal scoring.
- A Vercel serverless API route at `POST /api/run` that uses the OpenAI Responses API to generate funny run-specific patch-note flavor via Structured Outputs.
- A safe deterministic fallback run, so the game is fully playable without an API key.

## How Codex Helped

Codex was used throughout the build to rapidly prototype, iterate, and finish the game:

- **Architecture decisions** — Codex proposed keeping all gameplay state (physics, levels, win/loss) deterministic and local, with AI touching only flavor copy. This made the game testable and fair regardless of API availability.
- **Game loop and physics** — Codex implemented the canvas render loop, AABB collision with per-axis resolution, modifier system (crumbling platforms, spike magnet, async platforms, rollback tokens), and the gravity-rotation mechanic.
- **Level design and tuning** — All 11 level layouts, coin placements, and spike positions were generated and tuned by Codex based on playtest feedback (shorter target times, less punishing mechanics, clearer paths).
- **OpenAI integration** — Codex wrote the `/api/run` Vercel serverless function using the Responses API with a JSON Schema for Structured Outputs, the sanitizer that falls back gracefully on any bad output, and the seed-based run-ID system for shareable links.
- **Tests** — Codex wrote the full Vitest unit suite (physics, scoring, progress, run sanitizer) and the Playwright end-to-end sweep across all 11 levels including replay-challenge paths.
- **Polish** — Chiptune music, release-train HUD, win-screen layout, medal grid for all 11 levels, per-patch transition sounds, and particle variations were all implemented or refined with Codex.

## How to Play

- Move: `A/D` or left/right arrows
- Jump: `Space`, `W`, or up arrow
- Restart level: `R`
- Pause: `Esc`
- Mute: `M`
- Release Board: `B`
- Board select: arrow keys
- Board deploy selected patch: `Enter` or `Space`

Collect coins, dodge spikes, and reach the exit. Some exits charge a coin fee. Rollback tokens briefly suppress the current patch effect.

The Release Board shows every patch, whether it has been cleared, whether the replay challenge is unlocked, the best medal, bug-report state, and best time. The first time you play a level, the objective is simple: reach the exit and ship the patch. Once you successfully complete that level, replaying it unlocks an extra bug-report challenge. Collecting reports and finishing quickly with few deaths earns better release medals. The final screen grades the full run and stores your best score locally.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## OpenAI API Setup

The game works without the OpenAI API. To enable AI-generated run flavor on Vercel, add these environment variables in Vercel project settings:

```bash
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-4o-mini   # or gpt-4o, gpt-4.1-mini, etc.
```

Do not commit real `.env` files, API keys, tokens, or secrets. The `.gitignore` already excludes `.env`.

The AI route uses the Responses API with Structured Outputs (JSON Schema). The schema contains **only flavor fields** — headline, patch note, joke, severity label, finale recap, and game-over summary. The AI cannot touch collision boxes, physics values, level layouts, win/loss rules, player modifiers, or coin placements. Any malformed AI output falls back to the deterministic copy silently.

## Tests

```bash
npm test
npm run build
npm run test:browser
```

The browser test suite smoke-tests the Release Board and runs a full normal-clear plus replay-challenge sweep across all 10 patches and the finale.

## Submission Blurb

**Escape the Patch Notes** is a browser platformer slowly ruined by its own updates. Each of the 11 levels ships a new patch note: jump height nerfed for balance, coins now attract spikes, gravity rotated 90 degrees, platforms have a durability budget, and Patch 2.0 bundles all previous mistakes into one confidence-building release. Beat a level once to ship the patch; replay it to file the hidden bug report. Finish the run and get a full release report graded from SHIP? to S.

The OpenAI Responses API generates the run's flavor — patch-note copy, severity labels, jokes, finale recap — via Structured Outputs. All gameplay is deterministic and fully playable with the fallback copy when no API key is present. The entire game was designed and built with Codex.
