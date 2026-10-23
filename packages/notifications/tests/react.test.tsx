import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  NotificationInbox,
  NotificationsProvider,
  type NotificationsProviderProps,
} from "../src/react.js";

const props: NotificationsProviderProps = {
  apiKey: "pk_test_notifications",
  feedId: "00000000-0000-4000-8000-000000000001",
  user: { id: "user-a" },
  userToken: "server-signed-user-token",
};

afterEach(() => vi.unstubAllGlobals());

describe("React notifications", () => {
  it("defers SDK requests and BroadcastChannels during Node and Bun SSR", () => {
    const fetch = vi.fn();
    const broadcastChannel = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("self", globalThis);
    vi.stubGlobal("BroadcastChannel", broadcastChannel);
    const html = renderToString(
      <NotificationsProvider {...props}>
        <NotificationInbox />
      </NotificationsProvider>,
    );
    expect(html).toBe("");
    expect(fetch).not.toHaveBeenCalled();
    expect(broadcastChannel).not.toHaveBeenCalled();
  });

  it.each(["apiKey", "feedId", "userToken"] as const)("rejects an empty %s", (key) => {
    expect(() => renderToString(<NotificationsProvider {...props} {...{ [key]: " " }} />)).toThrow(
      `non-empty ${key}`,
    );
  });

  it("requires an authenticated user id and rejects secret browser keys", () => {
    expect(() => renderToString(<NotificationsProvider {...props} user={{ id: "" }} />)).toThrow(
      "non-empty userId",
    );
    expect(() => renderToString(<NotificationsProvider {...props} apiKey="sk_secret" />)).toThrow(
      "secret API key",
    );
  });

  it("renders an application-owned fallback before hydration", () => {
    const html = renderToString(
      <NotificationsProvider {...props} fallback={<span>Loading notifications</span>}>
        <NotificationInbox label="Activity inbox" />
      </NotificationsProvider>,
    );
    expect(html).toBe("<span>Loading notifications</span>");
  });
});
