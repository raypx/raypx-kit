import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ThemeProvider, ThemeScript, readStoredTheme, storeTheme, useTheme } from "../src/index.js";

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <span data-testid="theme">
        {theme}:{resolvedTheme}
      </span>
      <button onClick={() => setTheme("dark")}>Dark</button>
      <button onClick={() => setTheme("light")}>Light</button>
      <button onClick={() => setTheme("system")}>System</button>
    </>
  );
}

function mediaQuery(matches = false): MediaQueryList {
  return Object.assign(new window.EventTarget(), {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });
}

beforeEach(() => {
  localStorage.clear();
  for (const cookie of document.cookie.split(";"))
    document.cookie = `${cookie.split("=")[0]?.trim()}=; Path=/; Max-Age=0`;
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
  document.head.innerHTML = "";
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mediaQuery()),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("React themes", () => {
  it("hydrates from the server snapshot before reconciling local preferences", async () => {
    localStorage.setItem("theme", "dark");
    const snapshots: string[] = [];
    function HydrationProbe() {
      const { theme, resolvedTheme } = useTheme();
      snapshots.push(`${theme}:${resolvedTheme}`);
      return <Probe />;
    }
    const element = (
      <ThemeProvider initialTheme="system">
        <HydrationProbe />
      </ThemeProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.append(container);
    expect(container.textContent).toContain("system:light");
    snapshots.length = 0;
    const onRecoverableError = vi.fn();
    render(element, { container, hydrate: true, onRecoverableError });
    expect(snapshots[0]).toBe("system:light");
    await waitFor(() => expect(screen.getByTestId("theme").textContent).toBe("dark:dark"));
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
  });

  it("follows system changes, retains explicit choices, and cleans subscriptions", () => {
    const media = mediaQuery();
    vi.mocked(window.matchMedia).mockReturnValue(media);
    const add = vi.spyOn(media, "addEventListener");
    const remove = vi.spyOn(media, "removeEventListener");
    const { unmount } = render(
      <ThemeProvider storageKey={false}>
        <Probe />
      </ThemeProvider>,
    );
    act(() => {
      Object.assign(media, { matches: true });
      media.dispatchEvent(new window.Event("change"));
    });
    expect(screen.getByTestId("theme").textContent).toBe("system:dark");
    fireEvent.click(screen.getByText("Light"));
    act(() => {
      media.dispatchEvent(new window.Event("change"));
    });
    expect(screen.getByTestId("theme").textContent).toBe("light:light");
    expect(localStorage.getItem("theme")).toBeNull();
    unmount();
    expect(remove.mock.calls).toEqual(add.mock.calls);
  });

  it("supports blocked storage, encoded cookie keys, and cross-tab clear events", () => {
    storeTheme("dark", "custom;key");
    expect(document.cookie).toContain("custom%3Bkey=dark");
    localStorage.setItem("custom;key", "invalid");
    expect(readStoredTheme("light", "custom;key")).toBe("dark");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(
      <ThemeProvider initialTheme="light" storageKey="blocked">
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Dark"));
    expect(screen.getByTestId("theme").textContent).toBe("dark:dark");
    expect(document.cookie).toContain("blocked=dark");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "blocked", newValue: "system" }));
    });
    expect(screen.getByTestId("theme").textContent).toBe("system:light");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null }));
    });
    expect(screen.getByTestId("theme").textContent).toBe("light:light");
  });

  it("renders a CSP nonce and a first-paint script even for memory-only themes", () => {
    const markup = renderToStaticMarkup(
      <ThemeScript nonce="test-nonce" storageKey={false} initialTheme="dark" />,
    );
    expect(markup).toContain('nonce="test-nonce"');
    expect(markup).toContain('"fallback":"dark"');
    expect(markup.match(/<script/g)).toHaveLength(1);
  });
});
