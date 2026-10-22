import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  ThemeProvider,
  ThemeScript,
  readStoredTheme,
  storeTheme,
  useTheme,
} from "@raypx-kit/themes";
import { readThemeCookie, themeTokens } from "@raypx-kit/themes/config";
import { createThemeScript } from "@raypx-kit/themes/script";

function Probe() {
  const state = useTheme();
  return createElement("p", null, `${state.theme}:${state.resolvedTheme}`);
}
assert.match(
  renderToString(createElement(ThemeProvider, { initialTheme: "dark" }, createElement(Probe))),
  /dark:dark/,
);
assert.match(
  renderToString(createElement(ThemeScript, { nonce: "archive", storageKey: false })),
  /nonce="archive"/,
);
assert.equal(readStoredTheme("light"), "light");
storeTheme("dark");
assert.equal(readThemeCookie("theme=dark"), "dark");
assert.equal(typeof createThemeScript(), "string");
const styles = await readFile(new URL(import.meta.resolve("@raypx-kit/themes/styles.css")), "utf8");
const tailwind = await readFile(
  new URL(import.meta.resolve("@raypx-kit/themes/tailwind.css")),
  "utf8",
);
assert.ok(styles.includes(themeTokens.dark.background));
assert.match(styles, /prefers-color-scheme: dark/);
assert.match(tailwind, /@theme inline/);
assert.doesNotMatch(tailwind, /@import ["']tailwindcss/);
