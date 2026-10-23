import { expect, test, type BrowserContext, type Page } from "@playwright/test";

function entry(userId: string) {
  return {
    id: `message-${userId}`,
    __cursor: `cursor-${userId}`,
    actors: [],
    blocks: [
      {
        name: "body",
        type: "markdown",
        content: `${userId}'s report is ready`,
        rendered: `<p>${userId}'s report is ready</p>`,
      },
    ],
    inserted_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    read_at: null as string | null,
    seen_at: null as string | null,
    clicked_at: null,
    interacted_at: null,
    link_clicked_at: null,
    archived_at: null,
    total_actors: 0,
    data: null,
    source: { key: "report-ready", version_id: "test-version", categories: [] },
    tenant: null,
  };
}

async function localKnock(context: BrowserContext, page: Page) {
  const state = {
    mode: "ready" as "ready" | "empty" | "error",
    entries: new Map([
      ["user-a", entry("user-a")],
      ["user-b", entry("user-b")],
    ]),
    requests: [] as { method: string; path: string; userToken: string | undefined }[],
    external: [] as string[],
    errors: [] as string[],
    sockets: [] as string[],
    heldResponse: undefined as Promise<void> | undefined,
  };
  page.on("pageerror", (error) => state.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("hydration"))
      state.errors.push(message.text());
  });
  await context.routeWebSocket("**/ws/v1/**", (socket) => {
    state.sockets.push(new URL(socket.url()).origin);
    socket.onMessage((message) => {
      const [joinRef, ref, topic, event] = JSON.parse(message.toString()) as unknown[];
      if (event === "phx_join" || event === "heartbeat" || event === "phx_leave") {
        socket.send(
          JSON.stringify([joinRef, ref, topic, "phx_reply", { status: "ok", response: {} }]),
        );
      }
    });
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.protocol.startsWith("http") &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "localhost"
    ) {
      state.external.push(url.origin);
      await route.abort();
      return;
    }
    if (!url.pathname.startsWith("/v1/")) {
      await route.continue();
      return;
    }
    const headers = await request.allHeaders();
    state.requests.push({
      method: request.method(),
      path: url.pathname,
      userToken: headers["x-knock-user-token"],
    });
    const respond = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/settings")) {
      await respond({ features: { branding_required: false } });
    } else if (request.method() === "GET" && url.pathname.includes("/feeds/")) {
      if (state.mode === "error") {
        await respond({ code: "test_unavailable", message: "Local test API unavailable" }, 403);
        return;
      }
      const userId = url.pathname.split("/")[3]!;
      const item = state.entries.get(userId)!;
      if (state.heldResponse) await state.heldResponse;
      const responseItem =
        url.searchParams.get("tenant") === "workspace-b"
          ? {
              ...item,
              blocks: [
                {
                  name: "body",
                  type: "markdown",
                  content: "Workspace B notification",
                  rendered: `<p>${userId}'s workspace B notification</p>`,
                },
              ],
            }
          : item;
      const status = url.searchParams.get("status");
      const filtered =
        status === "read" ? !item.read_at : status === "unread" ? !!item.read_at : false;
      await respond({
        entries: state.mode === "empty" || filtered ? [] : [responseItem],
        meta: {
          total_count: state.mode === "empty" ? 0 : 1,
          unread_count: state.mode === "empty" || item.read_at ? 0 : 1,
          unseen_count: state.mode === "empty" || item.seen_at ? 0 : 1,
        },
        page_info: { before: null, after: null, page_size: 50 },
      });
    } else if (url.pathname.includes("/messages/bulk/")) {
      const token = headers["x-knock-user-token"];
      const item = state.entries.get(token?.endsWith("user-b") ? "user-b" : "user-a")!;
      if (url.pathname.endsWith("/read")) item.read_at = new Date().toISOString();
      if (url.pathname.endsWith("/seen")) item.seen_at = new Date().toISOString();
      await respond({ id: "bulk-local", status: "completed" });
    } else if (request.method() === "PUT" && /^\/v1\/users\/[^/]+$/.test(url.pathname)) {
      await respond({ id: url.pathname.split("/").at(-1), ...request.postDataJSON() });
    } else {
      await respond({});
    }
  });
  return state;
}

test("loads the real SDK feed, marks unread items read and filters read notifications", async ({
  page,
  context,
}) => {
  const api = await localKnock(context, page);
  await page.goto("./");
  await expect(page.getByRole("status", { name: "Unread count", exact: true })).toHaveText(
    "1 unread",
  );
  const trigger = page.getByRole("button", { name: "Notifications", exact: true });
  await expect(trigger.getByRole("status")).toHaveAttribute("aria-label", /1.*unread/i);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("user-a's report is ready")).toBeVisible();
  await dialog.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("status", { name: "Unread count", exact: true })).toHaveText(
    "0 unread",
  );
  await expect(trigger.getByRole("status")).toHaveCount(0);
  await expect
    .poll(() => api.requests.some((request) => request.path.endsWith("/messages/bulk/read")))
    .toBe(true);
  await dialog.getByRole("combobox").selectOption("read");
  await expect(dialog.getByText("user-a's report is ready")).toBeVisible();
  await dialog.getByRole("combobox").selectOption("unread");
  await expect(dialog.getByRole("heading", { name: "No notifications yet" })).toBeVisible();
  expect(
    api.requests
      .filter((request) => request.path.includes("/users/user-a/"))
      .every((request) => request.userToken === "test-signed-token-user-a"),
  ).toBe(true);
  expect(api.sockets).toContain("ws://127.0.0.1:4173");
  expect(api.external).toEqual([]);
  expect(api.errors).toEqual([]);
});

test("supports keyboard opening, visible focus, Escape return and outside dismissal on a small screen", async ({
  page,
  context,
}) => {
  const api = await localKnock(context, page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("./");
  const trigger = page.getByRole("button", { name: "Notifications", exact: true });
  await expect(page.getByRole("status", { name: "Unread count", exact: true })).toHaveText(
    "1 unread",
  );
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(dialog).toBeFocused();
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(async () => {
      const bounds = await dialog.boundingBox();
      return (
        !!bounds &&
        bounds.x >= 0 &&
        bounds.x + bounds.width <= 375 &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= 667
      );
    })
    .toBe(true);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS("outline-style", "solid");
  await expect(dialog).toBeHidden();
  await page.keyboard.press("Space");
  await expect(dialog).toBeVisible();
  await page.getByRole("heading", { name: "Notifications browser contract" }).click();
  await expect(dialog).toBeHidden();
  expect(api.external).toEqual([]);
  expect(api.errors).toEqual([]);
});

test("distinguishes an empty feed from an API failure and retries through the SDK", async ({
  page,
  context,
}) => {
  const api = await localKnock(context, page);
  api.mode = "empty";
  await page.goto("./");
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(dialog.getByRole("heading", { name: "No notifications yet" })).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  api.mode = "error";
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Refresh feed" }).click();
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Notifications could not be loaded.");
  await expect(dialog.getByRole("heading", { name: "No notifications yet" })).toHaveCount(0);
  api.mode = "ready";
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByText("user-a's report is ready")).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  expect(api.external).toEqual([]);
  expect(api.errors).toEqual([]);
});

test("replaces identity and feed state on user changes and disconnects without retaining private items", async ({
  page,
  context,
}) => {
  const api = await localKnock(context, page);
  await page.goto("./");
  const trigger = page.getByRole("button", { name: "Notifications", exact: true });
  await expect(page.getByRole("status", { name: "Unread count", exact: true })).toHaveText(
    "1 unread",
  );
  await trigger.click();
  await expect(page.getByText("user-a's report is ready")).toBeVisible();
  await page.getByRole("button", { name: "Switch user" }).click();
  await expect(page.getByText("Signed in as user-b")).toBeVisible();
  await expect(page.getByText("user-a's report is ready")).toHaveCount(0);
  await trigger.click();
  await expect(page.getByText("user-b's report is ready")).toBeVisible();
  expect(
    api.requests
      .filter((request) => request.path.includes("/users/user-b/"))
      .every((request) => request.userToken === "test-signed-token-user-b"),
  ).toBe(true);
  let releaseResponse = () => {};
  api.heldResponse = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const workspaceRequest = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get("tenant") === "workspace-b",
  );
  await page.getByRole("button", { name: "Switch workspace" }).click();
  await workspaceRequest;
  try {
    await expect(page.getByText("user-b's report is ready")).toHaveCount(0);
  } finally {
    releaseResponse();
  }
  await trigger.click();
  await expect(page.getByText("user-b's workspace B notification")).toBeVisible();
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("user-b's workspace B notification")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Unread count", exact: true })).toHaveText(
    "0 unread",
  );
  const requestCount = api.requests.length;
  await page.getByRole("button", { name: "Refresh feed" }).click();
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Notifications", exact: true })).toBeVisible();
  expect(api.requests).toHaveLength(requestCount);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await trigger.click();
  await expect(page.getByText("user-b's workspace B notification")).toBeVisible();
  expect(api.external).toEqual([]);
  expect(api.errors).toEqual([]);
});
