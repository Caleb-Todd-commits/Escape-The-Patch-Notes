import OpenAI from "openai";
import { canonicalPatches, createFallbackRun, runJsonSchema, sanitizeRun, type PatchRun } from "./_shared.js";

interface VercelRequestLike {
  method?: string;
  body?: unknown;
}

interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  json(value: unknown): void;
  end(): void;
}

const SYSTEM_PROMPT = [
  "You write safe, funny patch notes for a browser platformer called Escape the Patch Notes.",
  "The deterministic game engine already owns all layouts, hazards, physics, controls, and scoring.",
  "Return only flavor copy: run title, patch-note copy, severity labels, level jokes, dev dialogue, finale recap, and game-over summary.",
  "Never invent collision boxes, enemy movement, physics values, layouts, win rules, loss rules, player modifiers, or mechanics.",
  "No gore, harassment, hate, profanity, sexual content, secrets, credentials, or references to real private people.",
  "Keep the tone playful, concise, and competition-ready.",
  "For each level, write devLines: short lines spoken by the (slightly guilty, overworked) developer who shipped this patch.",
  "Levels 1-3 get 2 devLines each — a setup and a punchline. All other levels get exactly 1 short devLine.",
  "devLines are 1-2 sentences, casual, first-person, dry humor. The dev is responsible for all the chaos but stays upbeat.",
  "For each level, also write deathLines: 2-3 short lines the dev says when the player dies on that level.",
  "deathLines reference the specific patch mechanic that killed them. Dry, deadpan, 1 sentence each. No gore.",
].join(" ");

export default async function handler(req: VercelRequestLike, res: VercelResponseLike): Promise<void> {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = readBody(req.body);
  const seed = typeof body.seed === "string" ? body.seed : "";
  const difficulty: PatchRun["difficulty"] = body.difficulty === "chaos" ? "chaos" : "normal";

  if (!process.env.OPENAI_API_KEY) {
    res.status(200).json(createFallbackRun(seed, difficulty));
    return;
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const fixedOrder = canonicalPatches
      .map((patch) => `Level ${patch.levelId}: Patch ${patch.version}, ${patch.modifier}`)
      .join("; ");

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            "Generate one run of patch-note flavor.",
            `Seed: ${seed || "random"}.`,
            `Difficulty label: ${difficulty}.`,
            `Fixed level order, for context only: ${fixedOrder}.`,
            "Do not output mechanics, numeric gameplay values, positions, layouts, or win/loss rules.",
            "Make each headline readable in a small HUD, each note useful as patch-note copy, and each joke a short one-liner.",
          ].join(" "),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "patch_run",
          schema: runJsonSchema,
          strict: true,
        },
      },
      max_tokens: 8000,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    res.status(200).json(sanitizeRun(parsed, seed, "openai", difficulty));
  } catch (error) {
    console.error("OpenAI run generation failed", error);
    res.status(200).json(createFallbackRun(seed, difficulty));
  }
}

function readBody(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
