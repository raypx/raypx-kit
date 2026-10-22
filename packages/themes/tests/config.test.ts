import { describe, expect, it } from "vite-plus/test";
import { parseTheme, readThemeCookie, themeColors, themeTokens } from "../src/config.js";

describe("theme config", () => {
  it("accepts only supported themes and reads cookie boundaries safely", () => {
    expect(parseTheme("sepia", "dark")).toBe("dark");
    expect(readThemeCookie("other=dark; theme=system")).toBe("system");
    expect(readThemeCookie("other-theme=dark;theme=light")).toBe("light");
    expect(readThemeCookie("theme=%ZZ")).toBeNull();
    expect(readThemeCookie("theme=dark=extra")).toBeNull();
    expect(readThemeCookie("custom%3Bkey=dark", "custom;key")).toBe("dark");
  });

  it("keeps both palettes and browser chrome colors aligned", () => {
    expect(Object.keys(themeTokens.light).sort()).toEqual(Object.keys(themeTokens.dark).sort());
    expect(themeColors.light).toBe(themeTokens.light.background);
    expect(themeColors.dark).toBe(themeTokens.dark.background);
    expect(themeTokens.light["destructive-text"]).not.toBe(themeTokens.light.destructive);
  });
});
