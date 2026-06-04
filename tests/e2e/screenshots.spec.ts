import { test, type Page } from "@playwright/test";
import { createFallbackRun } from "../../src/shared/run";

test("captures README screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await stubRunApi(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__patchNotesDebug));
  await page.screenshot({ path: "public/screenshots/title.png" });

  await page.keyboard.press("Enter");
  await page.screenshot({ path: "public/screenshots/choose-level-chapter-1.png" });

  await page.keyboard.press("KeyE");
  await page.screenshot({ path: "public/screenshots/choose-level-chapter-2.png" });

  await page.evaluate(() => window.__patchNotesDebug!.startLevel(31));
  await page.screenshot({ path: "public/screenshots/chapter-2-intro.png" });

  await page.evaluate(() => window.__patchNotesDebug!.resetProgress());
  await page.evaluate(() => window.__patchNotesDebug!.startLevel(33));
  await page.evaluate(() => window.__patchNotesDebug!.completeLevel(4));
  await page.screenshot({ path: "public/screenshots/double-jump-unlock.png" });

  await page.evaluate(() => window.__patchNotesDebug!.startLevel(40));
  await advanceToGameplay(page);
  await page.screenshot({ path: "public/screenshots/production-finale.png" });

  await page.evaluate(() => window.__patchNotesDebug!.startHighlights());
  for (let i = 0; i < 5; i += 1) {
    await page.evaluate(() => window.__patchNotesDebug!.completeLevel(3));
    await page.keyboard.press("Enter");
  }
  await page.screenshot({ path: "public/screenshots/win-screen.png" });
});

async function advanceToGameplay(page: Page): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    const state = await page.locator("body").getAttribute("data-game-state");
    if (state === "playing") {
      return;
    }
    await page.keyboard.press("Enter");
  }
}

async function stubRunApi(page: Page): Promise<void> {
  await page.route("**/api/run", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...createFallbackRun("screenshots"), source: "openai" }),
    });
  });
}
