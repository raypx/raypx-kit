"use client";

// Adapted from raypx @ b6f4ca1e72b7a8f7ccd5962f75ce32f2d5dd7738; see NOTICE.

export {
  THEME_STORAGE_KEY,
  parseTheme,
  readThemeCookie,
  themeColors,
  themeMeta,
  themeTokens,
} from "./config.js";
export type { AppTheme, ThemeToken, UserTheme } from "./config.js";
export { createThemeScript } from "./script.js";
export type { ThemeScriptOptions } from "./script.js";
export { ThemeProvider, ThemeScript, readStoredTheme, storeTheme, useTheme } from "./provider.js";
export type { ThemeContextValue, ThemeProviderProps, ThemeScriptProps } from "./provider.js";
