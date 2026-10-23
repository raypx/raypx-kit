import { useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "@raypx-kit/themes";
import { storageKey } from "./config.js";

function Preferences() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <main>
      <h1>Appearance preferences</h1>
      <dl>
        <dt>Preference</dt>
        <dd>
          <output aria-label="Theme preference">{theme}</output>
        </dd>
        <dt>Current appearance</dt>
        <dd>
          <output aria-label="Resolved theme">{resolvedTheme}</output>
        </dd>
        <dt>Application state</dt>
        <dd>
          <output aria-label="Hydration status">{hydrated ? "Ready" : "Server rendered"}</output>
        </dd>
      </dl>
      <fieldset>
        <legend>Choose appearance</legend>
        <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
          Light
        </button>
        <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
          Dark
        </button>
        <button type="button" aria-pressed={theme === "system"} onClick={() => setTheme("system")}>
          System
        </button>
      </fieldset>
    </main>
  );
}

export function App() {
  return (
    <ThemeProvider storageKey={storageKey} initialTheme="system">
      <Preferences />
    </ThemeProvider>
  );
}
