import { afterEach, expect, it, vi } from "vite-plus/test";
import { createBrowserAnalytics } from "../src/browser.js";
const clients: ReturnType<typeof createBrowserAnalytics>[] = [];
const fetch = vi.fn<(url: URL | string, init?: RequestInit) => Promise<Response>>();
function client() {
  fetch.mockImplementation(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  Object.defineProperty(window, "fetch", { configurable: true, value: fetch });
  const value = createBrowserAnalytics({
    token: "phc_test",
    host: "https://analytics.example.com",
    environment: "test",
    release: "abc123",
    assetOrigins: ["https://app.example.com"],
    policy: (event, p) => (event === "opened" ? { surface: p.surface ?? "web" } : null),
  });
  clients.push(value);
  return value;
}
function events(): { event: string; properties: Record<string, unknown> }[] {
  return fetch.mock.calls.flatMap(([, init]) => JSON.parse(init!.body as string).batch);
}
async function ready(value: ReturnType<typeof client>) {
  value.setConsent({ usage: true, errors: true });
  value.capture("opened");
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  fetch.mockClear();
}
afterEach(() => {
  for (const value of clients.splice(0)) value.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetch.mockReset();
  localStorage.clear();
});
it("sends only opted-in, sanitized SDK events through the single-attempt transport", async () => {
  const value = client();
  value.capture("opened", { surface: "before" });
  expect(fetch).not.toHaveBeenCalled();
  value.setConsent({ usage: true, errors: true });
  value.capture("opened", { surface: "web", prompt: "private-task" });
  const error = new Error("private-task");
  error.stack = "Error: private-task\n at work (https://app.example.com/assets/app-123.js:4:8)";
  value.captureException(error);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  const bodies = JSON.stringify(events());
  expect(bodies).not.toContain("private-task");
  expect(bodies).toContain("opened");
  expect(bodies).toContain("$exception");
  expect(bodies).toContain("app-123.js");
  for (const [url, init] of fetch.mock.calls) {
    expect(String(url)).toBe("https://analytics.example.com/e/");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: false,
    });
    expect(JSON.parse(init!.body as string)).toMatchObject({ api_key: "phc_test" });
  }
  value.setConsent({ usage: false, errors: false });
  value.capture("opened");
  value.captureException(new Error("after revoke"));
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each(["http", "network", "timeout"] as const)(
  "drops a %s failure without retries or unload beacons",
  async (failure) => {
    const value = client();
    await ready(value);
    vi.useFakeTimers();
    fetch.mockImplementation(async (_url, init) => {
      if (failure === "http") return new Response("{}", { status: 500 });
      if (failure === "network") throw new TypeError("Network unavailable");
      return new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });
    const beacon = vi.fn();
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    value.capture("opened");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const signal = fetch.mock.calls[0]![1]!.signal!;
    await vi.advanceTimersByTimeAsync(10_000);
    if (failure === "timeout") expect(signal.aborted).toBe(true);
    value.setConsent({ usage: false, errors: false });
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(beacon).not.toHaveBeenCalled();
  },
);

it.each(["revoke", "account", "reset", "dispose"] as const)(
  "aborts pending requests and discards queued work on %s",
  async (transition) => {
    const value = client();
    await ready(value);
    value.identify("account-a");
    await vi.waitFor(() =>
      expect(events().some((event) => event.event === "$identify")).toBe(true),
    );
    fetch.mockClear();
    fetch.mockImplementation(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    value.capture("opened");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const signal = fetch.mock.calls[0]![1]!.signal!;
    value.capture("opened");
    if (transition === "revoke") value.setConsent({ usage: false, errors: true });
    else if (transition === "account") value.identify("account-b");
    else if (transition === "reset") value.reset();
    else value.dispose();
    expect(signal.aborted).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(events().filter((event) => event.event === "opened")).toHaveLength(1);
    if (transition === "revoke") {
      value.captureException(new Error("anonymous error"));
      await vi.waitFor(() =>
        expect(events().some((event) => event.event === "$exception")).toBe(true),
      );
      expect(events().at(-1)!.properties.distinct_id).not.toBe("account-a");
    }
  },
);

it.each([
  { usage: true, errors: false },
  { usage: false, errors: true },
  { usage: true, errors: true },
])("restores fresh consent after a previous instance opted out: %j", async (consent) => {
  const previous = client();
  await ready(previous);
  previous.setConsent({ usage: false, errors: false });
  previous.dispose();
  expect(localStorage.getItem("__ph_opt_in_out_phc_test")).toBe("0");
  const next = client();
  next.setConsent(consent);
  next.capture("opened");
  next.captureException(new Error("fresh error"));
  await vi.waitFor(() =>
    expect(fetch).toHaveBeenCalledTimes(Number(consent.usage) + Number(consent.errors)),
  );
  expect(events().some((event) => event.event === "opened")).toBe(consent.usage);
  expect(events().some((event) => event.event === "$exception")).toBe(consent.errors);
});
