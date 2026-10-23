import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The Vite environment that evaluates templates, separate from the application's `ssr`. */
export const environmentName = "email_preview";

const entryPrefix = "virtual:email-preview-render:";
const resolvedEntryPrefix = `\0${entryPrefix}`;
// Resolved from this package, which depends on the renderer; the project may not.
// The generated entry imports it by path inside the project's Vite environment, so
// its `react` import resolves to the same React as the template.
const rendererPath = fileURLToPath(import.meta.resolve("@react-email/render"));

export function renderEntryId(template: string): string {
  return `${entryPrefix}${template}`;
}

export function resolveRenderEntry(id: string): string | undefined {
  return id.startsWith(entryPrefix) ? `\0${id}` : undefined;
}

/** Renders one template with its `PreviewProps`, importing React through the project. */
export function loadRenderEntry(id: string): string | undefined {
  if (!id.startsWith(resolvedEntryPrefix)) return;
  const template = id.slice(resolvedEntryPrefix.length);
  return `import { createElement } from "react";
import { render, toPlainText } from ${JSON.stringify(rendererPath)};
import * as email from ${JSON.stringify(template)};
export async function renderEmail() {
  const Component = email.default;
  if (!Component || (typeof Component !== "function" && typeof Component !== "object")) {
    throw new Error("The email template must default-export a React component.");
  }
  const html = await render(createElement(Component, Component.PreviewProps ?? {}));
  return { html, text: toPlainText(html) };
}`;
}

/**
 * Reads the project's manifest straight from disk. Bun caches failed module
 * lookups in-process, so `require.resolve` would miss a later install.
 */
async function readProjectManifest(name: string, from: string): Promise<{ version?: string }> {
  for (let directory = dirname(from); ; directory = dirname(directory)) {
    try {
      return JSON.parse(
        await readFile(join(directory, "node_modules", name, "package.json"), "utf8"),
      );
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    if (dirname(directory) === directory) return {};
  }
}

export async function assertReact(template: string): Promise<void> {
  for (const name of ["react", "react-dom"]) {
    const manifest = await readProjectManifest(name, template);
    if (!manifest.version?.startsWith("19.")) {
      throw new Error(`Install ${name} 19 in the project containing your email templates.`);
    }
  }
}
