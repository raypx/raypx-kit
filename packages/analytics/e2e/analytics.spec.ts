import { expect, test, type BrowserContext } from "@playwright/test";

interface CapturedEvent {
  event: string;
  properties: Record<string, unknown>;
}
interface Delivery {
  events: CapturedEvent[];
  headers: Record<string, string>;
  body: string;
}

test.beforeEach(async ({ page }) => {
  // PostHog intentionally drops webdriver and HeadlessChrome traffic. Exercise
  // human-browser consent behavior without changing the real SDK or its config.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => false });
    const hints = (
      navigator as Navigator & {
        userAgentData?: { brands: { brand: string; version: string }[] };
      }
    ).userAgentData;
    if (hints) {
      const brands = hints.brands.map((entry) =>
        entry.brand === "HeadlessChrome" ? { ...entry, brand: "Google Chrome" } : entry,
      );
      // Chromium may return a fresh NavigatorUAData object for each access.
      Object.defineProperty(Object.getPrototypeOf(hints), "brands", {
        configurable: true,
        get: () => brands,
      });
    }
  });
});

async function intercept(context: BrowserContext) {
  const deliveries: Delivery[] = [];
  const external: string[] = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
        external.push(url.origin);
        await route.abort();
        return;
      }
    }
    if (url.pathname.startsWith("/__analytics_e2e/")) {
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as { batch: CapturedEvent[] };
        deliveries.push({
          events: payload.batch,
          headers: await request.allHeaders(),
          body: request.postData() ?? "",
        });
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }
    await route.continue();
  });
  return { deliveries, external, events: () => deliveries.flatMap((delivery) => delivery.events) };
}

test("keeps both consent categories disabled until granted and never replays earlier attempts", async ({
  page,
  context,
}) => {
  const captured = await intercept(context);
  await context.addCookies([
    { name: "session", value: "private-session", url: "http://127.0.0.1:4173" },
  ]);
  await page.goto("./?private_query=do-not-send");
  await expect(page.getByTestId("consent")).toHaveText("usage:false;errors:false;disposed:false");
  await page.getByRole("button", { name: "Track view", exact: true }).click();
  await expect(page.getByTestId("attempts")).toHaveText("1");
  await page.getByRole("button", { name: "Crash product view", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Recover product view", exact: true }).click();
  await expect(page.getByText("Product view is healthy", { exact: true })).toBeVisible();
  expect(captured.events()).toEqual([]);
  await page.getByRole("button", { name: "Allow usage", exact: true }).click();
  await page.getByRole("button", { name: "Track unknown event", exact: true }).click();
  await page.getByRole("button", { name: "Track view", exact: true }).click();
  await expect.poll(() => captured.events().length).toBe(1);
  expect(captured.events()[0]).toMatchObject({
    event: "view_opened",
    properties: { attempt: 2, surface: "fixture" },
  });
  const delivery = captured.deliveries[0]!;
  expect(delivery.headers.cookie).toBeUndefined();
  expect(delivery.headers.referer).toBeUndefined();
  expect(delivery.body).not.toContain("private@example.com");
  expect(delivery.body).not.toContain("private_query");
  expect(delivery.body).not.toContain("$current_url");
  expect(captured.external).toEqual([]);
});

test("revokes delivery, drops withdrawn actions and restores consent on a fresh client", async ({
  page,
  context,
}) => {
  const captured = await intercept(context);
  await page.goto("./");
  await page.getByRole("button", { name: "Allow usage", exact: true }).click();
  await page.getByRole("button", { name: "Track view", exact: true }).click();
  await expect.poll(() => captured.events().length).toBe(1);
  await page.getByRole("button", { name: "Revoke consent", exact: true }).click();
  await page.getByRole("button", { name: "Track view", exact: true }).click();
  await expect(page.getByTestId("attempts")).toHaveText("2");
  await page.getByRole("button", { name: "Create new client", exact: true }).click();
  await expect(page.getByTestId("consent")).toHaveText("usage:false;errors:false;disposed:false");
  await page.getByRole("button", { name: "Allow usage", exact: true }).click();
  await page.getByRole("button", { name: "Track view", exact: true }).click();
  await expect.poll(() => captured.events().length).toBe(2);
  expect(captured.events().map((event) => event.properties.attempt)).toEqual([1, 3]);
  expect(captured.external).toEqual([]);
});

test("collects real browser errors and unhandled rejections anonymously with error-only consent", async ({
  page,
  context,
}) => {
  const captured = await intercept(context);
  await page.goto("./");
  await page.getByRole("button", { name: "Allow errors only", exact: true }).click();
  await page.getByRole("button", { name: "Identify user", exact: true }).click();
  await page.getByRole("button", { name: "Track view", exact: true }).click();
  await page.getByRole("button", { name: "Throw browser error", exact: true }).click();
  await expect.poll(() => captured.events().length).toBe(1);
  await page.getByRole("button", { name: "Reject browser promise", exact: true }).click();
  await expect.poll(() => captured.events().length).toBe(2);
  expect(captured.events().every((event) => event.event === "$exception")).toBe(true);
  for (const event of captured.events()) {
    expect(event.properties.distinct_id).not.toBe("internal-e2e-user");
    expect(event.properties.$exception_list).toMatchObject([{ value: "UNEXPECTED_ERROR" }]);
  }
  const body = captured.deliveries.map((delivery) => delivery.body).join("\n");
  expect(body).not.toContain("private-browser-error");
  expect(body).not.toContain("private-rejection-error");
  expect(captured.external).toEqual([]);
});

test("renders the error-boundary fallback and keeps product recovery available after disposal", async ({
  page,
  context,
}) => {
  const captured = await intercept(context);
  await page.goto("./");
  await page.getByRole("button", { name: "Allow both", exact: true }).click();
  await page.getByRole("button", { name: "Crash product view", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("The product view could not load.");
  await expect
    .poll(() => captured.events().filter((event) => event.event === "$exception").length)
    .toBe(1);
  expect(captured.deliveries[0]!.body).not.toContain("private-render-error");
  await page.getByRole("button", { name: "Recover product view", exact: true }).click();
  await expect(page.getByText("Product view is healthy", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dispose analytics", exact: true }).click();
  await page.getByRole("button", { name: "Track view", exact: true }).click();
  await page.getByRole("button", { name: "Crash product view", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Recover product view", exact: true }).click();
  await expect(page.getByText("Product view is healthy", { exact: true })).toBeVisible();
  expect(captured.events()).toHaveLength(1);
  expect(captured.external).toEqual([]);
});
