import { test, expect, type Page } from "@playwright/test";
import { createFallbackRun } from "../../src/shared/run";

interface DebugSnapshot {
  mode: string;
  level: number;
  bonusChallenge: boolean;
  highlightRunActive: boolean;
  doubleJumpUnlocked: boolean;
  challengeComplete: boolean;
  reportVisible: boolean;
  reportCollected: boolean;
  progress: Record<string, { completed: boolean; reportCollected?: boolean; challengeCompleted?: boolean; bestMedal?: string; bestTime?: number }>;
}

test("clears every level normally and then with its replay challenge", async ({ page }) => {
  const totalLevels = createFallbackRun("full-playtest").levels.length;
  await stubRunApi(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__patchNotesDebug));

  for (let level = 1; level <= totalLevels; level += 1) {
    const normalStart = await page.evaluate((currentLevel) => window.__patchNotesDebug!.startLevel(currentLevel), level);
    expect(normalStart.level).toBe(level);
    expect(normalStart.bonusChallenge).toBe(false);
    expect(normalStart.reportVisible).toBe(false);

    const normalComplete = await page.evaluate(() => window.__patchNotesDebug!.completeLevel());
    expect(normalComplete.progress[level]?.completed).toBe(true);
    expect(normalComplete.progress[level]?.reportCollected).toBe(false);

    const replayStart = await page.evaluate((currentLevel) => window.__patchNotesDebug!.startLevel(currentLevel), level);
    expect(replayStart.bonusChallenge).toBe(true);
    expect(replayStart.reportVisible).toBe(level <= 30);

    const reportCollected = await page.evaluate(() => window.__patchNotesDebug!.collectReport());
    expect(reportCollected.challengeComplete).toBe(true);

    const replayComplete = await page.evaluate(() => window.__patchNotesDebug!.completeLevel());
    expect(replayComplete.progress[level]?.completed).toBe(true);
    expect(replayComplete.progress[level]?.challengeCompleted).toBe(true);
    expect(replayComplete.progress[level]?.bestMedal).toBeDefined();
    expect(replayComplete.progress[level]?.bestTime).toBeGreaterThan(0);
  }
});

async function stubRunApi(page: Page): Promise<void> {
  await page.route("**/api/run", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...createFallbackRun("full-playtest"), source: "openai" }),
    });
  });
}
