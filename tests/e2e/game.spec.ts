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
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "levelIntro");
  await expect(page.locator("body")).toHaveAttribute("data-bonus-challenge", "locked");
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "playing");
  await expect(page.locator("body")).toHaveAttribute("data-level", "1");

  await page.keyboard.press("KeyR");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "levelIntro");
  await expect(page.locator("body")).toHaveAttribute("data-bonus-challenge", "locked");

  await page.evaluate(() => localStorage.setItem("escapePatchNotesLevelCompletions", JSON.stringify({ 1: true })));
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "title");
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "releaseBoard");
  await expect(page.locator("body")).toHaveAttribute("data-bonus-challenge", "active");
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute("data-game-state", "levelIntro");
  await expect(page.locator("body")).toHaveAttribute("data-bonus-challenge", "active");
});
