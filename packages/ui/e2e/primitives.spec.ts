import { expect, test } from "@playwright/test";

let browserErrors: string[];

test.beforeEach(async ({ page }) => {
  browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("./");
  await expect(page.getByLabel("Hydration status")).toHaveText("Ready");
});

test.afterEach(() => {
  expect(browserErrors).toEqual([]);
});

test("dialog keyboard navigation stays inside, Escape closes and restores focus", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Edit profile", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Edit profile" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription("Change the name shown on your account.");
  const input = dialog.getByRole("textbox", { name: "Display name" });
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  await expect(input).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("tabs expose their selected panel and support keyboard activation", async ({ page }) => {
  const account = page.getByRole("tab", { name: "Account", exact: true });
  const delivery = page.getByRole("tab", { name: "Delivery", exact: true });
  await account.focus();
  await page.keyboard.press("ArrowRight");
  await expect(delivery).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(delivery).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Delivery", exact: true })).toHaveText(
    "Delivery preferences apply to new messages.",
  );
  await expect(page.getByRole("tabpanel", { name: "Account", exact: true })).toBeHidden();
  await expect(page.getByRole("tab", { name: "Billing", exact: true })).toBeDisabled();
  await page.keyboard.press("Home");
  await expect(account).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tabpanel", { name: "Account", exact: true })).toBeVisible();
});

test("form actions do not submit by default, and native fields submit and reset", async ({
  page,
}) => {
  const preview = page.getByRole("button", { name: "Preview changes" });
  await preview.click();
  await preview.press("Enter");
  await expect(page.getByLabel("Preview count")).toHaveText("2");
  await expect(page.getByLabel("Submission")).toHaveText("Not submitted");
  await expect(page.getByRole("button", { name: "Unavailable" })).toBeDisabled();

  const name = page.getByRole("textbox", { name: "Account name" });
  const frequency = page.getByRole("combobox", { name: "Message frequency" });
  await name.fill("Grace");
  await frequency.selectOption("daily");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByLabel("Submission")).toHaveText("Grace / daily");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(name).toHaveValue("Ada");
  await expect(frequency).toHaveValue("weekly");
});

test("published styles keep a 320px form and open dialog within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.getByText("Ready to edit", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Message frequency" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit profile" });
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box !== null && box.x >= 0 && box.x + box.width <= 320;
    })
    .toBe(true);
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeInViewport();
});

test("reduced motion disables skeleton and dialog animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByLabel("Loading bar")).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("button", { name: "Preview changes" })).toHaveCSS(
    "transition-property",
    "none",
  );
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit profile" })).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Edit profile" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toBeFocused();
});
