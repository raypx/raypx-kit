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
  const data: unknown = await response.json();
  signal.throwIfAborted();
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
