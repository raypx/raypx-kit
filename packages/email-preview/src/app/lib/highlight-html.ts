import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import html from "shiki/langs/html.mjs";
import dark from "shiki/themes/github-dark.mjs";
import light from "shiki/themes/github-light.mjs";

let highlighter: ReturnType<typeof createHighlighterCore> | undefined;

const darkTheme = {
  ...dark,
  tokenColors: [
    ...(dark.tokenColors ?? []),
    // Keep comments readable against the workspace's neutral dark surface.
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#8b949e" } },
  ],
};

export async function highlightHtml(source: string) {
  highlighter ??= createHighlighterCore({
    langs: [html],
    themes: [light, darkTheme],
    engine: createJavaScriptRegexEngine(),
  }).catch((error: unknown) => {
    highlighter = undefined;
    throw error;
  });
  return (await highlighter).codeToTokens(source, {
    lang: "html",
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  }).tokens;
}
