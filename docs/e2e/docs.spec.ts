import { expect, test as base } from "@playwright/test";

const test = base.extend<{ noPageErrors: void }>({
  noPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      expect(errors, "Documentation must not throw browser errors").toEqual([]);
    },
    { auto: true },
  ],
});

test("loads deep links and navigates canonical package guides with browser history", async ({
  page,
}) => {
  await page.goto("/docs/security");
  await expect(page).toHaveTitle("Security | Raypx Kit");
  await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View source on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/raypx/raypx-kit/blob/canary/packages/security/README.md",
  );
  await page.locator("#nd-sidebar").getByRole("button", { name: "UI", exact: true }).click();
  await page.locator("#nd-sidebar").getByRole("link", { name: "UI", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/ui$/);
  await expect(page.getByRole("heading", { name: "UI", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "UI", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "UI", exact: true })).toBeVisible();
});

test("searches the built local index and opens results with the keyboard", async ({ page }) => {
  await page.goto("/docs");
  await page.getByRole("button", { name: /^Search/ }).click();
  const search = page.getByRole("combobox", { name: "Search documentation" });
  await expect(search).toBeFocused();
  await search.fill("Security");
  const result = page.getByRole("option", { name: "Raypx Kit Security Security", exact: true });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("aria-selected", "true");
  await search.press("ArrowDown");
  await expect(result).toHaveAttribute("aria-selected", "false");
  await search.press("ArrowUp");
  await expect(result).toHaveAttribute("aria-selected", "true");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/docs\/security(?:#.*)?$/);
  await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Search/ }).click();
  await search.fill("no-such-api-93847");
  await expect(
    page.getByText("No matching pages. Try an API name or a shorter search."),
  ).toBeVisible();
  await search.press("Escape");
  await expect(search).not.toBeVisible();
});

test("operates mobile navigation and persists keyboard-selected dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/docs");
  const open = page.getByRole("button", { name: "Open Sidebar", exact: true });
  await open.focus();
  await open.press("Enter");
  const sidebar = page.locator("#nd-sidebar-mobile");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveAttribute("data-state", "open");
  await sidebar.getByRole("button", { name: "Toggle Theme" }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await open.press("Enter");
  await sidebar.getByRole("button", { name: "Env", exact: true }).press("Enter");
  await sidebar.getByRole("link", { name: "Env", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/env$/);
  await expect(page.getByRole("heading", { name: "Env", exact: true })).toBeVisible();
  await expect(sidebar).toHaveAttribute("data-state", "closed");
});

test("recovers from an unknown page and keeps navigation usable when search fails", async ({
  page,
}) => {
  const response = await page.goto("/docs/no-such-package-93847");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Browse documentation" }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await page.route("**/api/search?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Test-owned unavailable search" }),
    }),
  );
  await page.getByRole("button", { name: /^Search/ }).click();
  const search = page.getByRole("combobox", { name: "Search documentation" });
  await search.fill("security");
  await expect(page.getByRole("alert")).toContainText("Search is unavailable.");
  await search.press("Escape");
  await page.locator("#nd-sidebar").getByRole("button", { name: "Security", exact: true }).click();
  await page.locator("#nd-sidebar").getByRole("link", { name: "Security", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible();
});
