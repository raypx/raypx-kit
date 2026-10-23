/** Keeps the theme preference apart from applications on the same origin. */
export const themeStorageKey = "raypx-email-theme";

export type PreviewView = "preview" | "html" | "text";
type PreviewViewport = "desktop" | "mobile";

export interface PreviewSearch {
  template?: string;
  view: PreviewView;
  viewport: PreviewViewport;
}

export function validatePreviewSearch(search: Record<string, unknown>): PreviewSearch {
  return {
    ...(typeof search.template === "string" && search.template.length > 0
      ? { template: search.template }
      : {}),
    view: search.view === "html" || search.view === "text" ? search.view : "preview",
    viewport: search.viewport === "mobile" ? "mobile" : "desktop",
  };
}

export async function fetchPreviewData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const body = await response.text();
  signal.throwIfAborted();
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    // Errors outside the API routes (such as the CLI fallback) are plain text.
    if (response.ok) throw new Error("The preview server returned an invalid response.");
  }
  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "object" &&
      data.error !== null &&
      "message" in data.error &&
      typeof data.error.message === "string"
        ? data.error.message
        : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

export function outputFilename(id: string, view: PreviewView): string {
  const name =
    id
      .split("/")
      .at(-1)
      ?.replace(/\.[^.]+$/, "") || "email";
  return `${name}.${view === "text" ? "txt" : "html"}`;
}

/**
 * Templates reference local assets as `/static/...`. When the preview is mounted
 * below a prefix such as `/__email/`, point the sandboxed preview at that prefix.
 * Copied and downloaded HTML keeps the template's original URLs.
 */
export function withPreviewBase(html: string, base: string): string {
  if (base === "/") return html;
  return html.replace(/(["'(]\s*)\/static\//g, `$1${base}static/`);
}
