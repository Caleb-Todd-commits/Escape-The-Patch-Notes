import { test, expect } from "@playwright/test";
import { createFallbackRun } from "../../src/shared/run";

test("loads and starts a playable run", async ({ page }) => {
  await page.route("**/api/run", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...createFallbackRun("browser-test"), source: "openai" }),
    });
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("canvas#game")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "title");

  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "releaseBoard");
  await expect(page.locator("body")).toHaveAttribute("data-board-selection", "1");
  await expect(page.locator("body")).toHaveAttribute("data-bonus-challenge", "locked");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("body")).toHaveAttribute("data-board-selection", "2");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("body")).toHaveAttribute("data-board-selection", "1");
  await page.keyboard.press("KeyE");
  await expect(page.locator("body")).toHaveAttribute("data-board-selection", "31");
  await page.keyboard.press("KeyQ");
  await expect(page.locator("body")).toHaveAttribute("data-board-selection", "1");
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "devDialog");
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "levelIntro");
  await expect(page.locator("body")).toHaveAttribute("data-bonus-challenge", "locked");
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "playing");
  await expect(page.locator("body")).toHaveAttribute("data-level", "1");

  await page.keyboard.press("KeyR");
  await advanceDevDialogIfOpen(page);
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "levelIntro");
  await expect(page.locator("body")).toHaveAttribute("data-bonus-challenge", "locked");

  await page.evaluate(() => localStorage.setItem("escapePatchNotesLevelCompletions", JSON.stringify({ 1: true })));
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "title");
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "releaseBoard");
  await expect(page.locator("body")).toHaveAttribute("data-bonus-challenge", "active");
  await page.keyboard.press("Enter");
  await advanceDevDialogIfOpen(page);
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "levelIntro");
  await expect(page.locator("body")).toHaveAttribute("data-bonus-challenge", "active");
});

test("supports judge highlights, Chapter 2 intro, and double-jump unlock state", async ({ page }) => {
  await page.route("**/api/run", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...createFallbackRun("judge-flow"), source: "openai" }),
    });
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__patchNotesDebug));

  const chapterIntro = await page.evaluate(() => window.__patchNotesDebug!.startLevel(31));
  expect(chapterIntro.mode).toBe("chapterIntro");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "chapterIntro");
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "levelIntro");

  await page.evaluate(() => window.__patchNotesDebug!.resetProgress());
  const beforeUnlock = await page.evaluate(() => window.__patchNotesDebug!.startLevel(33));
  expect(beforeUnlock.doubleJumpUnlocked).toBe(false);
  const afterUnlock = await page.evaluate(() => window.__patchNotesDebug!.completeLevel(4));
  expect(afterUnlock.doubleJumpUnlocked).toBe(true);
  await expect(page.locator("body")).toHaveAttribute("data-double-jump", "unlocked");

  const highlightStart = await page.evaluate(() => window.__patchNotesDebug!.startHighlights());
  expect(highlightStart.highlightRunActive).toBe(true);
  await expect(page.locator("body")).toHaveAttribute("data-highlight-run", "active");

  for (const expectedLevel of [3, 4, 30, 33, 40]) {
    const current = await page.evaluate(() => window.__patchNotesDebug!.snapshot());
    expect(current.level).toBe(expectedLevel);
    await page.evaluate(() => window.__patchNotesDebug!.completeLevel(3));
    await page.keyboard.press("Enter");
  }

  await expect(page.locator("body")).toHaveAttribute("data-game-state", "gameComplete");
});

async function advanceDevDialogIfOpen(page: import("@playwright/test").Page): Promise<void> {
  if (await page.locator("body").getAttribute("data-game-state") === "devDialog") {
    await page.keyboard.press("Enter");
  }
}
