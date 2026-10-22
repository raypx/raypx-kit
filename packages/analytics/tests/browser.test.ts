/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createBrowserAnalytics } from "../src/browser.js";
import { sanitizeException, createNoopAnalytics } from "../src/index.js";
const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  captureException: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  opt_out_capturing: vi.fn(),
  opt_in_capturing: vi.fn(),
}));
vi.mock("posthog-js/no-external", () => ({
  PostHog: class {
    init = mocks.init;
    capture = mocks.capture;
    captureException = mocks.captureException;
    identify = mocks.identify;
    reset = mocks.reset;
    opt_out_capturing = mocks.opt_out_capturing;
    opt_in_capturing = mocks.opt_in_capturing;
  },
}));
const clients: ReturnType<typeof createBrowserAnalytics>[] = [];
const fetch = vi.fn(async () => new Response("{}"));
beforeEach(() => vi.stubGlobal("fetch", fetch));
function delivered(before: (event: unknown) => null, event: unknown) {
  expect(before(event)).toBeNull();
  const init = (fetch.mock.calls.at(-1) as unknown as [unknown, RequestInit])[1];
  return JSON.parse(init.body as string).batch[0];
}
function client() {
  const value = createBrowserAnalytics({
    token: "test-token",
    host: "https://analytics.example.com",
    environment: "test",
    release: "abc123",
    assetOrigins: ["https://app.example.com", "views://main"],
    policy: (name, props) => (name === "opened" ? { surface: props.surface ?? "web" } : null),
  });
  clients.push(value);
  return value;
}
afterEach(() => {
  for (const instance of clients.splice(0)) instance.dispose();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it("does not load or buffer before consent, gates categories independently and resets identities", async () => {
  const value = client();
  value.capture("opened");
  value.captureException(new Error("secret"));
  value.identify("account-a");
  await Promise.resolve();
  expect(mocks.init).not.toHaveBeenCalled();
  value.setConsent({ usage: false, errors: true });
  await vi.waitFor(() => expect(mocks.init).toHaveBeenCalledTimes(1));
  expect(mocks.capture).not.toHaveBeenCalled();
  expect(mocks.identify).not.toHaveBeenCalled();
  value.captureException(new Error("secret"));
  await vi.waitFor(() => expect(mocks.captureException).toHaveBeenCalledTimes(1));
  expect(mocks.captureException.mock.calls[0]![0].message).toBe("UNEXPECTED_ERROR");
  value.setConsent({ usage: true, errors: false });
  value.capture("opened", { surface: "desktop" });
  await vi.waitFor(() => expect(mocks.capture).toHaveBeenCalledTimes(1));
  expect(mocks.identify).toHaveBeenCalledWith("account-a");
  value.identify("account-b");
  expect(mocks.reset).toHaveBeenCalled();
  value.reset();
  value.setConsent({ usage: false, errors: false });
  value.capture("opened");
  await Promise.resolve();
  expect(mocks.capture).toHaveBeenCalledTimes(1);
});
it("rebuilds SDK payloads without URLs, identity attributes, inputs or exception text", async () => {
  const value = client();
  value.setConsent({ usage: true, errors: true });
  await vi.waitFor(() => expect(mocks.init).toHaveBeenCalled());
  const config = mocks.init.mock.calls[0]![1];
  const event = delivered(config.before_send, {
    event: "opened",
    $set_once: { private_url: "secret" },
    properties: {
      distinct_id: "id",
      surface: "web",
      $current_url: "https://app/?token=secret",
      password: "secret",
      prompt: "private",
    },
  });
  expect(event.$set_once).toBeUndefined();
  expect(event.properties).toEqual({
    distinct_id: "id",
    surface: "web",
    environment: "test",
    release: "abc123",
    $geoip_disable: true,
  });
  expect(config.before_send({ event: "unknown", properties: {} })).toBeNull();
  value.setConsent({ usage: false, errors: true });
  expect(config.before_send({ event: "opened", properties: {} })).toBeNull();
  const exception = delivered(config.before_send, {
    event: "$exception",
    properties: {
      $exception_list: [
        {
          type: "Error",
          value: "private text",
          stacktrace: {
            frames: [
              { filename: "file:///Users/private/code.js", lineno: 1 },
              { filename: "views://main/assets/app-123.js?secret=1", lineno: 2, colno: 3 },
            ],
          },
        },
      ],
    },
  });
  expect(JSON.stringify(exception)).not.toContain("private");
  expect(JSON.stringify(exception)).not.toContain("secret");
  expect(exception.properties.$exception_list[0].stacktrace.frames).toEqual([
    { filename: "views://main/assets/app-123.js", lineno: 2, colno: 3, platform: "javascript" },
  ]);
});
it("keeps only application frames and never reads a thrown object's message or cause", () => {
  const error = new TypeError("Bearer secret");
  error.stack =
    "TypeError: secret\n at work (https://app.example.com/assets/app-123.js?token=secret:12:4)\n at file:///Users/private/a.js:1:2\nhttps://other.example.com/assets/third.js:3:4\nfn@views://main/assets/entry.js:7:8";
  const safe = sanitizeException(error, ["https://app.example.com", "views://main"]);
  expect(safe.name).toBe("TypeError");
  expect(safe.stack).toContain("app-123.js:12:4");
  expect(safe.stack).toContain("views://main/assets/entry.js:7:8");
  expect(safe.stack).not.toMatch(/secret|private|other/);
  const thrown = {
    get message() {
      throw new Error("accessed");
    },
    get cause() {
      throw new Error("accessed");
    },
  };
  expect(sanitizeException(thrown, []).message).toBe("UNEXPECTED_ERROR");
  createNoopAnalytics().capture("ignored");
});
it("removes global handlers on revoke/dispose and never emits queued work after identity changes", async () => {
  const value = client();
  value.setConsent({ usage: true, errors: true });
  value.capture("opened");
  value.reset();
  value.dispose();
  const stop = (event: Event) => event.preventDefault();
  window.addEventListener("error", stop);
  window.dispatchEvent(new ErrorEvent("error", { error: new Error("private"), cancelable: true }));
  window.removeEventListener("error", stop);
  await Promise.resolve();
  expect(mocks.capture).not.toHaveBeenCalled();
  expect(mocks.captureException).not.toHaveBeenCalled();
});

it("preserves only safe injected release identifiers for source-map resolution", async () => {
  const value = client();
  value.setConsent({ usage: false, errors: true });
  await vi.waitFor(() => expect(mocks.init).toHaveBeenCalled());
  const before = mocks.init.mock.calls[0]![1].before_send;
  const result = delivered(before, {
    event: "$exception",
    properties: {
      $release_id: "01234567-89ab-cdef-0123-456789abcdef",
      $exception_list: [{ type: "Error", value: "UNEXPECTED_ERROR" }],
    },
  });
  expect(result.properties.$release_id).toBe("01234567-89ab-cdef-0123-456789abcdef");
});

it("isolates synchronous SDK lifecycle failures from product operations", async () => {
  const value = client();
  value.setConsent({ usage: true, errors: false });
  await vi.waitFor(() => expect(mocks.init).toHaveBeenCalled());
  mocks.reset.mockImplementationOnce(() => {
    throw new Error("unavailable");
  });
  expect(() => value.identify("account-b")).not.toThrow();
  mocks.opt_out_capturing.mockImplementationOnce(() => {
    throw new Error("unavailable");
  });
  expect(() => value.dispose()).not.toThrow();
});
