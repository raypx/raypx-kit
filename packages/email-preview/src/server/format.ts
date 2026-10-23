import * as html from "prettier/plugins/html";
import { format } from "prettier/standalone";

/**
 * Indents rendered HTML for the source view. The preview, clipboard and downloads
 * keep the original output, so markup Prettier cannot parse is shown unchanged.
 */
export async function formatHtml(source: string): Promise<string> {
  try {
    return await format(source, {
      parser: "html",
      plugins: [html],
      endOfLine: "lf",
      tabWidth: 2,
      bracketSameLine: true,
    });
  } catch {
    return source;
  }
}
