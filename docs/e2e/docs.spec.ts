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
  await search.fill("93847zqjxv");
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
  await sidebar.getByRole("button", { name: "Dark", exact: true }).focus();
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

test("switches a deep link between languages while preserving its query, anchor and history", async ({
  page,
}) => {
  await page.goto("/docs/intl?view=api#bind-a-controlled-react-client");
  await page.getByRole("button", { name: "Choose a language", exact: true }).click();
  await page.getByRole("button", { name: "简体中文", exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/docs\/intl\?view=api#bind-a-controlled-react-client$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.getByRole("note")).toContainText("此页面尚未提供中文翻译");
  await expect(page.getByRole("link", { name: "在 GitHub 查看源文件" })).toHaveAttribute(
    "href",
    "https://github.com/raypx/raypx-kit/blob/canary/packages/intl/README.md",
  );
  await expect(page.locator("#nd-page .prose")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.getByRole("note")).toContainText("此页面尚未提供中文翻译");
  await page.getByRole("button", { name: "选择语言", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/intl\?view=api#bind-a-controlled-react-client$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("note")).toHaveCount(0);
  await page.goBack();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await page.goForward();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("renders Chinese content before hydration and keeps body links in the selected language", async ({
  browser,
  page,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const serverPage = await context.newPage();
    const response = await serverPage.goto("/zh/docs");
    expect(response?.status()).toBe(200);
    await expect(serverPage.locator("html")).toHaveAttribute("lang", "zh");
    await expect(serverPage.getByRole("heading", { name: "概览", exact: true })).toBeVisible();
    await expect(serverPage.getByRole("heading", { name: /^包使用指南/ })).toBeVisible();
  } finally {
    await context.close();
  }

  await page.goto("/docs#package-guides");
  await page.getByRole("button", { name: "Choose a language", exact: true }).click();
  await page.getByRole("button", { name: "简体中文", exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/docs#package-guides$/);
  await expect(page.locator("#package-guides")).toBeAttached();
  await expect(page.getByRole("heading", { name: "概览", exact: true })).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.locator("#nd-page .prose")).toHaveAttribute("lang", "zh");
  await page
    .getByRole("cell", { name: "Intl", exact: true })
    .getByRole("link", { name: "Intl", exact: true })
    .click();
  await expect(page).toHaveURL(/\/zh\/docs\/intl$/);
  const guide = page
    .locator("#nd-page .prose")
    .getByRole("link", { name: "browser test guide", exact: true });
  // Canonical English bodies are localized at render time, too.
  await expect(guide).toHaveAttribute("href", "/zh/docs/development#browser-e2e-by-workspace");
  await guide.click();
  await expect(page).toHaveURL(/\/zh\/docs\/development#browser-e2e-by-workspace$/);
});

test("filters the multilingual search index and opens Chinese results", async ({
  page,
  request,
}) => {
  for (const locale of ["en", "zh"] as const) {
    const response = await request.get(`/api/search?query=Intl&locale=${locale}`);
    expect(response.ok()).toBe(true);
    const results = (await response.json()) as { url: string }[];
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) expect(result.url.startsWith("/zh/docs")).toBe(locale === "zh");
  }
  await page.goto("/zh/docs");
  await page.getByRole("button", { name: /^搜索/ }).click();
  const search = page.getByRole("combobox", { name: "搜索文档" });
  await search.fill("语言协商");
  const result = page.getByRole("option", { name: "Raypx Kit Intl Intl", exact: true });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/zh\/docs\/intl(?:#.*)?$/);
  await page.getByRole("button", { name: /^搜索/ }).click();
  await search.fill("93847zqjxv");
  await expect(page.getByText("没有找到匹配的页面，请尝试 API 名称或更短的关键词。")).toBeVisible();
  await search.press("Escape");
});

test("supports Chinese mobile navigation and a keyboard-operated language picker", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh/docs");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "打开侧边栏", exact: true }).press("Enter");
  const sidebar = page.locator("#nd-sidebar-mobile");
  await expect(sidebar).toHaveAttribute("data-state", "open");
  await sidebar.getByRole("button", { name: "深色", exact: true }).focus();
  await page.keyboard.press("Space");
  await sidebar.getByRole("button", { name: "选择语言", exact: true }).press("Enter");
  await page.getByRole("button", { name: "English", exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
});

test("recovers in Chinese from missing pages and canonicalizes the English prefix", async ({
  page,
}) => {
  const response = await page.goto("/zh/docs/no-such-package-93847");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "页面未找到", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "浏览文档", exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/docs$/);
  await page.goto("/en/docs/intl?view=api");
  await expect(page).toHaveURL(/\/docs\/intl\?view=api$/);
  const unsupported = await page.goto("/fr/docs");
  expect(unsupported?.status()).toBe(404);
});

test("applies the legacy saved theme before hydration and retains a single theme-color tag", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|didn't match/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  let releaseHydration = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseHydration = resolve;
  });
  await page.route("**/assets/*.js", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    const response = await page.goto("/docs", { waitUntil: "commit" });
    expect(response?.ok()).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await expect(page.getByRole("button", { name: "System", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  } finally {
    releaseHydration();
  }
  await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  expect(hydrationErrors).toEqual([]);
});

test("uses Kit theme preferences across system changes, language navigation and keyboard input", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/docs");
  const root = page.locator("html");
  await expect(page.getByRole("button", { name: "System", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
  await expect
    .poll(() => context.cookies())
    .toEqual(expect.arrayContaining([expect.objectContaining({ name: "theme", value: "dark" })]));
  await page.getByRole("button", { name: "Choose a language", exact: true }).click();
  await page.getByRole("button", { name: "简体中文", exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/docs$/);
  await expect(page.getByRole("button", { name: "深色", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "跟随系统", exact: true }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("d");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /^搜索/ }).click();
  await page.getByRole("combobox", { name: "搜索文档", exact: true }).press("d");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
});
