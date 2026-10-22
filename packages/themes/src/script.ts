// Adapted from raypx @ b6f4ca1e72b7a8f7ccd5962f75ce32f2d5dd7738; see NOTICE.
import { parseTheme, THEME_STORAGE_KEY, themeColors } from "./config.js";
import type { UserTheme } from "./config.js";

export interface ThemeScriptOptions {
  /** Persistence key; false ignores both localStorage and cookies. */
  storageKey?: string | false;
  /** Fallback when no valid persisted preference exists. Defaults to system. */
  initialTheme?: UserTheme;
}

/** Pure, React-free script generator. All variable data is escaped for inline HTML. */
export function createThemeScript({
  storageKey = THEME_STORAGE_KEY,
  initialTheme = "system",
}: ThemeScriptOptions = {}): string {
  const options = JSON.stringify({
    key: storageKey,
    fallback: parseTheme(initialTheme, "system"),
    colors: themeColors,
  })
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return `(function(){
  var options = ${options};
  function valid(value) { return value === "light" || value === "dark" || value === "system"; }
  var theme = options.fallback;
  if (options.key !== false) {
    var stored;
    try { stored = window.localStorage.getItem(options.key); } catch(e) {}
    if (valid(stored)) theme = stored;
    else {
      try {
        var parts = document.cookie.split(";");
        var key = encodeURIComponent(options.key);
        for (var i = 0; i < parts.length; i++) {
          var split = parts[i].indexOf("=");
          if (split < 0 || parts[i].slice(0, split).trim() !== key) continue;
          var cookie = decodeURIComponent(parts[i].slice(split + 1).trim());
          if (valid(cookie)) theme = cookie;
          break;
        }
      } catch(e) {}
    }
  }
  if (theme === "system") {
    theme = "light";
    try { if (window.matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark"; } catch(e) {}
  }
  var root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", options.colors[theme]);
})();`;
}
