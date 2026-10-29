import type { ThemeScriptOptions } from "@raypx-kit/themes/script";

/** Retain the preference key used by the previous Fumadocs theme provider. */
export const docsTheme = {
  storageKey: "theme",
  initialTheme: "system",
} satisfies ThemeScriptOptions;
