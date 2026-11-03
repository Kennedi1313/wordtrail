import { chromium } from "playwright";
import fs from "node:fs/promises";

const originalUrl =
  process.env.WORDTRAIL_ORIGINAL_URL || "http://127.0.0.1:5173";
const migratedUrl =
  process.env.WORDTRAIL_MIGRATED_URL || "http://127.0.0.1:3000";
const output = process.env.WORDTRAIL_SCREENSHOT_DIR || ".screenshots";
const routes = ["home", "reading", "practice", "vocabulary"];

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = {
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
};
const seededState = {
  words: [
    {
      term: "bright",
      normalized: "bright",
      definition: "giving out light",
      translation: "brilhante",
      lookups: 2,
      dueAt: new Date(0).toISOString(),
    },
    {
      term: "quiet",
      normalized: "quiet",
      definition: "making little noise",
      translation: "silencioso",
      lookups: 1,
      dueAt: new Date(0).toISOString(),
    },
  ],
  readingSessions: [
    {
      id: "seed-session",
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      date: new Date().toISOString().slice(0, 10),
      pages: 12,
      seconds: 600,
      durationSeconds: 600,
      minutes: 10,
      lookups: [],
    },
  ],
  reviews: [],
  activeReadingSession: null,
};
async function seed(page) {
  await page.addInitScript((state) => {
    localStorage.setItem("wordtrail-data-v1", JSON.stringify(state));
    localStorage.setItem(
      "wordtrail-settings-v1",
      JSON.stringify({ dailyGoal: 30 }),
    );
  }, seededState);
}

async function capture(name, baseUrl, route, page = null) {
  const ownedPage = page || (await browser.newPage(context));
  await seed(ownedPage);
  await ownedPage.goto(route === "home" ? baseUrl : `${baseUrl}/${route}`, {
    waitUntil: "networkidle",
  });
  await ownedPage.waitForTimeout(500);
  if (page && route !== "home") {
    const selector = {
      reading: '.nav-link[data-page="reading"]',
      practice: '.nav-link[data-page="practice"]',
      vocabulary: '.nav-link[data-page="words"]',
    }[route];
    await ownedPage.locator(selector).click();
    await ownedPage.waitForTimeout(250);
  }
  await ownedPage.screenshot({
    path: `${output}/${name}-${route}.png`,
    fullPage: true,
  });
  if (!page) await ownedPage.close();
}

const originalPage = await browser.newPage(context);
await seed(originalPage);
await originalPage.goto(originalUrl, { waitUntil: "networkidle" });
for (const route of routes) {
  await capture("original", originalUrl, route, originalPage);
  await capture("migrated", migratedUrl, route);
}
await originalPage.close();

const migrated = await browser.newPage(context);
await migrated.goto(`${migratedUrl}/reading`, { waitUntil: "networkidle" });
await migrated.waitForTimeout(500);
await migrated.getByRole("button", { name: /Iniciar leitura/ }).click();
await migrated.getByRole("button", { name: /Finalizar/ }).click();
await migrated.screenshot({
  path: `${output}/migrated-reading-finished.png`,
  fullPage: true,
});

const originalSettings = await browser.newPage(context);
await seed(originalSettings);
await originalSettings.goto(originalUrl, { waitUntil: "networkidle" });
await originalSettings.waitForTimeout(500);
await originalSettings.locator(".settings-button").click();
await originalSettings.screenshot({
  path: `${output}/original-settings.png`,
  fullPage: true,
});
await originalSettings.close();

const migratedSettings = await browser.newPage(context);
await seed(migratedSettings);
await migratedSettings.goto(migratedUrl, { waitUntil: "networkidle" });
await migratedSettings.waitForTimeout(500);
await migratedSettings.locator(".settings-button").click();
await migratedSettings.locator('[role="dialog"]').waitFor();
await migratedSettings.screenshot({
  path: `${output}/migrated-settings.png`,
  fullPage: true,
});
await migratedSettings.close();
await browser.close();
console.log(`Screenshots saved to ${output}`);
