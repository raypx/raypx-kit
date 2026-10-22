import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createThemeScript } from "../src/script.js";
import { themeColors } from "../src/config.js";

function run(script: string): string | undefined {
  // oxlint-disable-next-line typescript/no-implied-eval -- Runs the generated first-paint program as a browser would.
  new Function(script)();
  return document.documentElement.dataset.theme;
}

beforeEach(() => {
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  for (const cookie of document.cookie.split(";"))
    document.cookie = `${cookie.split("=")[0]?.trim()}=; Path=/; Max-Age=0`;
  document.head.innerHTML = "";
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("first-paint script", () => {
  it("uses storage, cookie and initial fallback consistently and creates one meta tag", () => {
    document.cookie = "theme=light";
    localStorage.setItem("theme", "dark");
    expect(run(createThemeScript())).toBe("dark");
    localStorage.setItem("theme", "invalid");
    expect(run(createThemeScript())).toBe("light");
    document.cookie = "theme=%ZZ";
    expect(run(createThemeScript({ initialTheme: "dark" }))).toBe("dark");
    expect([...document.documentElement.classList]).toEqual(["dark"]);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      themeColors.dark,
    );
  });

  it("resolves system without persistence and tolerates blocked storage", () => {
    localStorage.setItem("theme", "light");
    expect(run(createThemeScript({ storageKey: false }))).toBe("dark");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    document.cookie = "theme=light";
    expect(run(createThemeScript())).toBe("light");
  });

  it("keeps hostile persistence keys inside data rather than script markup", () => {
    const key = "</script><script>globalThis.compromised = true</script>\u2028";
    localStorage.setItem(key, "dark");
    const script = createThemeScript({ storageKey: key });
    expect(script).not.toMatch(/<\/script/i);
    expect(script).not.toContain("\u2028");
    expect(run(script)).toBe("dark");
    expect("compromised" in globalThis).toBe(false);
  });
});
