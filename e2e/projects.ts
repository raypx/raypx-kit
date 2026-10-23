/** Each React workspace owns its browser scenarios and consumer fixture. */
export const browserProjects = {
  analytics: { directory: "packages/analytics", workspace: "@raypx-kit/analytics", port: 4173 },
  notifications: {
    directory: "packages/notifications",
    workspace: "@raypx-kit/notifications",
    port: 4173,
  },
  intl: { directory: "packages/intl", workspace: "@raypx-kit/intl", port: 4173 },
  themes: { directory: "packages/themes", workspace: "@raypx-kit/themes", port: 4173 },
  ui: { directory: "packages/ui", workspace: "@raypx-kit/ui", port: 4173 },
  "email-preview": {
    directory: "packages/email-preview",
    workspace: "@raypx-kit/email-preview",
    port: 4174,
  },
  docs: { directory: "docs", workspace: "docs", port: 4175 },
} as const;

export type BrowserProject = keyof typeof browserProjects;

export function projectNames(names?: string[]): BrowserProject[] {
  const selected = names?.length ? names : Object.keys(browserProjects);
  for (const name of selected) {
    if (!Object.hasOwn(browserProjects, name)) {
      throw new Error(
        `Unknown E2E project ${name}; choose ${Object.keys(browserProjects).join(", ")}`,
      );
    }
  }
  return [...new Set(selected)] as BrowserProject[];
}
