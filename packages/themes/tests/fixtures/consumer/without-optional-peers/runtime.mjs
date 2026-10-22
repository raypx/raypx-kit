import assert from "node:assert/strict";
import { parseTheme, readThemeCookie, themeTokens } from "@raypx-kit/themes/config";
import { createThemeScript } from "@raypx-kit/themes/script";

assert.equal(parseTheme("unknown", "system"), "system");
assert.equal(readThemeCookie("theme=dark"), "dark");
assert.equal(typeof themeTokens.light.background, "string");
assert.doesNotMatch(createThemeScript({ storageKey: "</script>" }), /<\/script/i);
