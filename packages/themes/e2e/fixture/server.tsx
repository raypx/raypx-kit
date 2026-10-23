import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { ThemeScript } from "@raypx-kit/themes";
import { App } from "./app.js";
import { storageKey } from "./config.js";

export function render() {
  return {
    head: renderToStaticMarkup(<ThemeScript storageKey={storageKey} initialTheme="system" />),
    body: renderToString(<App />),
  };
}
