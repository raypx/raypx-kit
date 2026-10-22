// Adapted from raypx @ b6f4ca1e72b7a8f7ccd5962f75ce32f2d5dd7738; see NOTICE.
import { themeTokens } from "./tokens.js";

export { themeTokens, type ThemeToken } from "./tokens.js";
export type UserTheme = "light" | "dark" | "system";
export type AppTheme = "light" | "dark";
export const THEME_STORAGE_KEY = "theme";

export const themeColors: Readonly<Record<AppTheme, string>> = {
  light: themeTokens.light.background,
  dark: themeTokens.dark.background,
};

/** Theme-color belongs to the script/provider to avoid duplicate React 19 head metadata. */
export const themeMeta = [{ name: "color-scheme", content: "light dark" }] as const;

export function parseTheme(raw: string | null | undefined, fallback: UserTheme): UserTheme {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : fallback;
}

/** Reads a theme from a Cookie header; custom persistence keys use URL encoding. */
export function readThemeCookie(
  cookie: string | null | undefined,
  storageKey: string = THEME_STORAGE_KEY,
): UserTheme | null {
  const name = encodeURIComponent(storageKey);
  for (const part of (cookie ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      return value === "light" || value === "dark" || value === "system" ? value : null;
    } catch {
      return null;
    }
  }
  return null;
}
