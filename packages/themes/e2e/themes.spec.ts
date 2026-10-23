import { expect, test, type Page } from "@playwright/test";
import { storageKey } from "./fixture/config.js";

let browserErrors: string[];

function watchErrors(page: Page) {
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
}

async function expectTheme(page: Page, preference: string, resolved = preference) {
  await expect(page.getByLabel("Theme preference")).toHaveText(preference);
  await expect(page.getByLabel("Resolved theme")).toHaveText(resolved);
  await expect(page.locator("html")).toHaveAttribute("data-theme", resolved);
  await expect(page.locator("html")).toHaveCSS("color-scheme", resolved);
}

test.beforeEach(async ({ page }) => {
  browserErrors = [];
  watchErrors(page);
  await page.emulateMedia({ colorScheme: "light" });
});

test.afterEach(() => {
  expect(browserErrors).toEqual([]);
});

test("SSR content and first-paint script precede error-free hydration", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "dark"), storageKey);
  let releaseHydration: () => void = () => {};
  const hydrationGate = new Promise<void>((resolve) => {
    releaseHydration = resolve;
  });
  await page.route("**/main.tsx", async (route) => {
    await hydrationGate;
    await route.continue();
  });
  try {
    const response = await page.goto("./", { waitUntil: "commit" });
    expect(response?.ok()).toBe(true);
    await expect(page.getByLabel("Hydration status")).toHaveText("Server rendered");
    await expect(page.getByLabel("Theme preference")).toHaveText("system");
    await expect(page.getByLabel("Resolved theme")).toHaveText("light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  } finally {
    releaseHydration();
  }
  await expect(page.getByLabel("Hydration status")).toHaveText("Ready");
  await expectTheme(page, "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
});

test("explicit choices survive reload in localStorage and the cookie mirror", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Hydration status")).toHaveText("Ready");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expectTheme(page, "dark");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toBe("dark");
  await expect
    .poll(() => page.context().cookies())
    .toEqual(
      expect.arrayContaining([expect.objectContaining({ name: storageKey, value: "dark" })]),
    );
  await page.reload();
  await expect(page.getByLabel("Hydration status")).toHaveText("Ready");
  await expectTheme(page, "dark");
  await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("real storage events synchronize two tabs, including removal", async ({ page, context }) => {
  await page.goto("./");
  await expect(page.getByLabel("Hydration status")).toHaveText("Ready");
  const second = await context.newPage();
  watchErrors(second);
  await second.emulateMedia({ colorScheme: "light" });
  await second.goto(page.url());
  await expect(second.getByLabel("Hydration status")).toHaveText("Ready");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expectTheme(second, "dark");
  await second.getByRole("button", { name: "Light", exact: true }).click();
  await expectTheme(page, "light");
  await page.evaluate((key) => localStorage.removeItem(key), storageKey);
  await expectTheme(second, "system", "light");
  await second.close();
});

test("system mode follows media changes while explicit choices remain stable", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Hydration status")).toHaveText("Ready");
  await expectTheme(page, "system", "light");
  const lightBackground = await page
    .locator("body")
    .evaluate((body) => getComputedStyle(body).backgroundColor);
  await page.emulateMedia({ colorScheme: "dark" });
  await expectTheme(page, "system", "dark");
  await expect(page.locator("body")).not.toHaveCSS("background-color", lightBackground);
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expectTheme(page, "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expectTheme(page, "light");
  await page.getByRole("button", { name: "System", exact: true }).click();
  await expectTheme(page, "system", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "system", "light");
});

test("blocked localStorage falls back to cookies and still persists a changed choice", async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL) throw new Error("The Themes browser project requires a baseURL.");
  await context.addCookies([{ name: storageKey, value: "dark", url: new URL(baseURL).origin }]);
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem"]) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() {
          throw new DOMException("Storage is unavailable", "SecurityError");
        },
      });
    }
  });
  await page.goto("./");
  await expect(page.getByLabel("Hydration status")).toHaveText("Ready");
  await expectTheme(page, "dark");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expectTheme(page, "light");
  await page.reload();
  await expect(page.getByLabel("Hydration status")).toHaveText("Ready");
  await expectTheme(page, "light");
});
