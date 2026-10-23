import { expect, test } from "@playwright/test";

test("hydrates the server snapshot before restoring a different stored locale", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("intl_e2e_preference", "de"));
  const response = await page.goto("./");
  expect(await response?.text()).toContain("Hello Ada");
  await expect(page.getByTestId("hydrated")).toHaveText("true");
  await expect(page.getByTestId("greeting")).toHaveText("Hallo Ada");
  await expect(page.locator("html")).toHaveAttribute("data-ssr-locale", "en");
  await expect(page.locator("html")).toHaveAttribute("data-hydration-errors", "[]");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  expect(errors).toEqual([]);
});

test("switches ICU content, persists across reload and clears its cookie for system language", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await expect(page.getByTestId("items")).toHaveText("1 item");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByTestId("items")).toHaveText("2 items");
  await page.getByRole("button", { name: "German", exact: true }).click();
  await expect(page.getByTestId("items")).toHaveText("2 Artikel");
  await expect(page.getByTestId("rich").locator("strong")).toHaveText("Ada");
  await expect(page.getByTestId("rich")).toHaveText("Willkommen Ada");
  await expect
    .poll(
      async () =>
        (await context.cookies()).find((cookie) => cookie.name === "intl_e2e_locale")?.value,
    )
    .toBe("de");
  expect(await page.evaluate(() => localStorage.getItem("intl_e2e_preference"))).toBe("de");
  await page.reload();
  await expect(page.getByTestId("greeting")).toHaveText("Hallo Ada");
  await expect(page.locator("html")).toHaveAttribute("data-hydration-errors", "[]");
  await page.getByRole("button", { name: "System language", exact: true }).click();
  await expect(page.getByTestId("preference")).toHaveText("system");
  await expect(page.getByTestId("locale")).toHaveText("en");
  await expect
    .poll(async () => (await context.cookies()).some((cookie) => cookie.name === "intl_e2e_locale"))
    .toBe(false);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("synchronizes real localStorage events between tabs and persists a cross-tab reset", async ({
  page,
  context,
}) => {
  await page.goto("./");
  const other = await context.newPage();
  await other.goto("./");
  await expect(page.getByTestId("hydrated")).toHaveText("true");
  await expect(other.getByTestId("hydrated")).toHaveText("true");
  await page.getByRole("button", { name: "German", exact: true }).click();
  await expect(other.getByTestId("greeting")).toHaveText("Hallo Ada");
  await expect(other.locator("html")).toHaveAttribute("lang", "de");
  await other.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByTestId("greeting")).toHaveText("Hello Ada");
  await other.evaluate(() => localStorage.removeItem("intl_e2e_preference"));
  await expect(page.getByTestId("preference")).toHaveText("system");
  await page.reload();
  await expect(page.getByTestId("preference")).toHaveText("system");
  await expect(page.getByTestId("hydrated")).toHaveText("true");
});

test("keeps controlled provider changes independent from browser preference state", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "German", exact: true }).click();
  await expect(page.getByTestId("greeting")).toHaveText("Hallo Ada");
  await expect(page.getByTestId("controlled-greeting")).toHaveText("Hello Grace");
  await page.getByRole("button", { name: "Switch controlled language", exact: true }).click();
  await expect(page.getByTestId("controlled-greeting")).toHaveText("Hallo Grace");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByTestId("greeting")).toHaveText("Hello Ada");
  await expect(page.getByTestId("controlled-greeting")).toHaveText("Hallo Grace");
  await expect(page.getByTestId("preference")).toHaveText("en");
});
