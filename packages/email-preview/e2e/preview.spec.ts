import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as base, type Page } from "@playwright/test";

const test = base.extend<{ noPageErrors: void }>({
  noPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      expect(errors, "The preview must not throw browser errors").toEqual([]);
    },
    { auto: true },
  ],
});

interface FixtureState {
  emails: string;
  welcomeSource: string;
  footerSource: string;
  markSource: string;
}

const stateFile = fileURLToPath(
  new URL("../../../.artifacts/email-preview-e2e/state.json", import.meta.url),
);
let fixture: FixtureState;
const previewFrame = (page: Page) =>
  page.frameLocator('iframe[title="Email preview: welcome.tsx"]');

// The real file watcher is shared by this project; edits must not overlap.
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  fixture = JSON.parse(await readFile(stateFile, "utf8")) as FixtureState;
});
test.beforeEach(async () => {
  await Promise.all([
    writeFile(join(fixture.emails, "welcome.tsx"), fixture.welcomeSource),
    writeFile(join(fixture.emails, "_components/footer.tsx"), fixture.footerSource),
    writeFile(join(fixture.emails, "static/mark.svg"), fixture.markSource),
  ]);
});

test("filters templates, selects nested paths and restores selection through browser history", async ({
  page,
}) => {
  await page.goto("/?template=welcome.tsx");
  await expect(
    previewFrame(page).getByRole("heading", { name: "Welcome, Browser Reader." }),
  ).toBeVisible();
  const library = page.locator(".desktop-library");
  // The connection notice only appears while the dev server is unreachable.
  await expect(library.getByRole("status")).toBeEmpty();
  await library
    .getByRole("searchbox", { name: "Filter templates by path" })
    .fill("no-such-template");
  await expect(library.getByText("No matching templates.")).toBeVisible();
  await library.getByRole("button", { name: "Clear filter" }).click();
  await library.getByRole("searchbox", { name: "Filter templates by path" }).fill("account/");
  await expect(library.getByRole("button", { name: "welcome", exact: true })).toHaveCount(0);
  await library.getByRole("button", { name: "password-reset", exact: true }).click();
  await expect(page).toHaveURL(/template=account%2Fpassword-reset\.jsx/);
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/template=welcome\.tsx/);
  await expect(
    previewFrame(page).getByRole("heading", { name: "Welcome, Browser Reader." }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "password-reset", exact: true })).toBeVisible();
});

test("renders sandboxed emails and local assets at desktop and mobile widths", async ({ page }) => {
  await page.goto("/?template=welcome.tsx");
  const frame = page.locator("iframe");
  await expect(frame).toHaveAttribute("sandbox", "");
  await expect(frame).toHaveCSS("width", "800px");
  const logo = previewFrame(page).getByRole("img", { name: "Raypx" });
  await expect(logo).toBeVisible();
  await expect
    .poll(() =>
      logo.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
    )
    .toBe(true);
  await page.getByRole("radio", { name: "Mobile", exact: true }).check();
  await expect(frame).toHaveCSS("width", "375px");
  await expect(page).toHaveURL(/viewport=mobile/);
  await page.reload();
  await expect(frame).toHaveCSS("width", "375px");
  await page.getByRole("radio", { name: "Desktop", exact: true }).check();
  await expect(frame).toHaveCSS("width", "800px");
});

test("formats HTML while copying raw HTML and downloading the matching text output", async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?template=welcome.tsx");
  await expect(
    previewFrame(page).getByRole("heading", { name: "Welcome, Browser Reader." }),
  ).toBeVisible();
  const response = await request.get("/api/preview?template=welcome.tsx");
  expect(response.ok()).toBe(true);
  const output = (await response.json()) as { html: string; text: string };
  await page.getByRole("tab", { name: "HTML", exact: true }).click();
  const source = page.getByLabel("Rendered HTML");
  await expect(source).toContainText("Browser Reader");
  await expect(source.locator(".source-line")).not.toHaveCount(1);
  await page.getByRole("button", { name: "Copy HTML", exact: true }).click();
  await expect(page.getByText("HTML copied", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(output.html);
  const htmlDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML", exact: true }).click();
  const html = await htmlDownload;
  expect(html.suggestedFilename()).toBe("welcome.html");
  expect(await readFile((await html.path())!, "utf8")).toBe(output.html);
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await expect(page.getByLabel("Plain text output")).toHaveText(output.text);
  const textDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download text", exact: true }).click();
  const text = await textDownload;
  expect(text.suggestedFilename()).toBe("welcome.txt");
  expect(await readFile((await text.path())!, "utf8")).toBe(output.text);
});

test("updates shared source and assets, recovers from syntax errors and handles deletion", async ({
  page,
}) => {
  await page.goto("/?template=welcome.tsx");
  await expect(
    previewFrame(page).getByRole("heading", { name: "Welcome, Browser Reader." }),
  ).toBeVisible();
  await writeFile(
    join(fixture.emails, "_components/footer.tsx"),
    fixture.footerSource.replace("A little space for your next idea.", "Live browser update."),
  );
  await expect(
    previewFrame(page).getByText("Raypx · Live browser update.", { exact: true }),
  ).toBeVisible();
  const originalFrame = await page.locator("iframe").elementHandle();
  const assetRequest = page.waitForResponse(
    (response) => response.url().endsWith("/static/mark.svg") && response.ok(),
  );
  await writeFile(
    join(fixture.emails, "static/mark.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><title>Updated browser mark</title><circle cx="18" cy="18" r="16" fill="purple" /></svg>',
  );
  expect(await (await assetRequest).text()).toContain("Updated browser mark");
  await expect.poll(() => originalFrame!.evaluate((element) => element.isConnected)).toBe(false);
  await writeFile(join(fixture.emails, "welcome.tsx"), "export default function Broken( {");
  await expect(page.getByRole("heading", { name: "This email could not render" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy HTML", exact: true })).toBeDisabled();
  await writeFile(
    join(fixture.emails, "welcome.tsx"),
    fixture.welcomeSource.replace("Browser Reader", "Recovered Reader"),
  );
  await expect(
    previewFrame(page).getByRole("heading", { name: "Welcome, Recovered Reader." }),
  ).toBeVisible();
  await rm(join(fixture.emails, "welcome.tsx"));
  await expect(page.getByRole("heading", { name: "Template not found" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Open first template" }).click();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
});

test("supports the mobile library, Escape focus restoration, keyboard tabs and persisted theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?template=welcome.tsx");
  await expect(
    previewFrame(page).getByRole("heading", { name: "Welcome, Browser Reader." }),
  ).toBeVisible();
  const browse = page.getByRole("button", { name: "Browse templates" });
  await browse.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Browse email templates" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(browse).toBeFocused();
  await browse.press("Enter");
  await drawer.getByRole("button", { name: "password-reset", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "password-reset", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Preview", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "HTML", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Rendered HTML")).toContainText("Reset your password");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Text", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Plain text output")).toContainText(/reset your password/i);
  await page.getByRole("combobox", { name: "Color theme" }).selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Color theme" })).toHaveValue("dark");
  await expect(page.getByRole("tab", { name: "Text", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("html")).toHaveClass(/dark/);
});
