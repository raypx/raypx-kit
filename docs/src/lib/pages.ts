export const documentationPages = [
  {
    slug: "index",
    sourcePath: "docs/README.md",
    title: "Overview",
    description: "Reusable Raypx Kit libraries, their current APIs and extension designs.",
  },
  {
    slug: "architecture/index",
    sourcePath: "docs/architecture/README.md",
    title: "Architecture",
    description: "Package ownership, dependency boundaries, build outputs and documentation flow.",
  },
  {
    slug: "codemods/index",
    sourcePath: "packages/codemods/README.md",
    title: "Codemods",
    description: "Explicit-file migration runner, dry-run previews and an extensible CLI registry.",
  },
  {
    slug: "devkit/index",
    sourcePath: "packages/devkit/README.md",
    title: "Devkit",
    description:
      "Workspace boundaries, toolchain pins, static catalogs, artifact probes and task helpers.",
  },
  {
    slug: "drizzle/index",
    sourcePath: "packages/drizzle/README.md",
    title: "Drizzle",
    description: "PostgreSQL helpers, JSONB expressions and query diagnostics for postgres.js.",
  },
  {
    slug: "drizzle/drizzle-plus",
    sourcePath: "docs/drizzle/drizzle-plus-capabilities.md",
    title: "drizzle-plus inventory",
    description: "The complete pinned upstream capability inventory and merge recommendations.",
  },
  {
    slug: "drizzle/better-drizzle",
    sourcePath: "docs/drizzle/better-drizzle-capabilities.md",
    title: "better-drizzle inventory",
    description: "The complete pinned upstream API, plugin, rule and error-code inventory.",
  },
  {
    slug: "drizzle/merge-plan",
    sourcePath: "docs/drizzle/merge-plan.md",
    title: "Merge and extension plan",
    description:
      "Module boundaries, shared semantics and acceptance criteria for future extensions.",
  },
  {
    slug: "drizzle/provenance",
    sourcePath: "packages/drizzle/NOTICE.md",
    title: "Source provenance",
    description: "Pinned source revisions, adaptation notices and retained upstream licenses.",
  },
  {
    slug: "drizzle-kit/index",
    sourcePath: "packages/drizzle-kit/README.md",
    title: "Drizzle Kit",
    description: "drizzle-kit's CLI and defineConfig without the unused prebuilt bundles.",
  },
  {
    slug: "env/index",
    sourcePath: "packages/env/README.md",
    title: "Env",
    description:
      "Typed environment validation, nested presets, defaults and guarded client access.",
  },
  {
    slug: "email-preview/index",
    sourcePath: "packages/email-preview/README.md",
    title: "Email Preview",
    description: "React Email previews in a Vite dev server or a standalone CLI.",
  },
  {
    slug: "email-preview/vite-plugin",
    sourcePath: "docs/email-preview/vite-plugin.md",
    title: "Vite plugin design",
    description: "Proposed Vite plugin architecture, isolation limits and migration steps.",
  },
  {
    slug: "intl/index",
    sourcePath: "packages/intl/README.md",
    title: "Intl",
    description:
      "Locale negotiation, typed ICU translation, Intl formatting and controlled React providers.",
  },
  {
    slug: "intl/migration",
    sourcePath: "docs/intl/migration.md",
    title: "Controlled provider migration",
    description: "Runtime ownership, typed messages, platform preferences and alpha migration.",
  },
  {
    slug: "analytics/index",
    sourcePath: "packages/analytics/README.md",
    title: "Analytics",
    description: "Consent-controlled PostHog events, sanitized errors and optional React bindings.",
  },
  {
    slug: "logger/index",
    sourcePath: "packages/logger/README.md",
    title: "Logger",
    description: "evlog structured logging, wide events and request context for Node.",
  },
  {
    slug: "notifications/index",
    sourcePath: "packages/notifications/README.md",
    title: "Notifications",
    description: "Knock workflows, signed user tokens and optional React notification feeds.",
  },
  {
    slug: "security/index",
    sourcePath: "packages/security/README.md",
    title: "Security",
    description:
      "Nosecone security headers and optional Arcjet protection with caller-owned rules.",
  },
  {
    slug: "storage/index",
    sourcePath: "packages/storage/README.md",
    title: "Storage",
    description:
      "Object storage for S3-compatible services, the filesystem and memory with signed URLs.",
  },
  {
    slug: "themes/index",
    sourcePath: "packages/themes/README.md",
    title: "Themes",
    description: "Theme tokens, pre-hydration scripts and optional React preference state.",
  },
  {
    slug: "ui/index",
    sourcePath: "packages/ui/README.md",
    title: "UI",
    description: "shadcn-style React primitives built on Base UI with shared theme tokens.",
  },
  {
    slug: "tsconfig/index",
    sourcePath: "packages/tsconfig/README.md",
    title: "TSConfig",
    description:
      "Strict TypeScript presets for ESM libraries, browser applications and Node runtimes.",
  },
  {
    slug: "development/index",
    sourcePath: "docs/development/README.md",
    title: "Development",
    description: "Repository setup, commands, verification and adding a package.",
  },
  {
    slug: "development/dependencies",
    sourcePath: "docs/development/dependencies.md",
    title: "Dependency maintenance",
    description: "Version ranges, runtime pins, compatibility checks and upgrade procedure.",
  },
  {
    slug: "development/changesets",
    sourcePath: "docs/development/changesets.md",
    title: "Changesets workflow",
    description: "Independent versions, initial publication and subsequent release preparation.",
  },
  {
    slug: "development/publishing",
    sourcePath: "docs/development/publishing.md",
    title: "Publishing",
    description: "Setup, alpha releases, CI publication, stable graduation and recovery.",
  },
];

export const navigationMetadata = {
  "meta.json": {
    title: "Raypx Kit",
    pages: [
      "index",
      "architecture",
      "codemods",
      "devkit",
      "drizzle",
      "drizzle-kit",
      "email-preview",
      "env",
      "intl",
      "analytics",
      "logger",
      "notifications",
      "security",
      "storage",
      "themes",
      "tsconfig",
      "ui",
      "development",
    ],
  },
  "architecture/meta.json": { title: "Architecture", pages: ["index"] },
  "codemods/meta.json": { title: "Codemods", pages: ["index"] },
  "drizzle/meta.json": {
    title: "Drizzle",
    pages: ["index", "drizzle-plus", "better-drizzle", "merge-plan", "provenance"],
  },
  "devkit/meta.json": { title: "Devkit", pages: ["index"] },
  "drizzle-kit/meta.json": { title: "Drizzle Kit", pages: ["index"] },
  "email-preview/meta.json": { title: "Email Preview", pages: ["index", "vite-plugin"] },
  "env/meta.json": { title: "Env", pages: ["index"] },
  "intl/meta.json": { title: "Intl", pages: ["index", "migration"] },
  "analytics/meta.json": { title: "Analytics", pages: ["index"] },
  "logger/meta.json": { title: "Logger", pages: ["index"] },
  "notifications/meta.json": { title: "Notifications", pages: ["index"] },
  "security/meta.json": { title: "Security", pages: ["index"] },
  "storage/meta.json": { title: "Storage", pages: ["index"] },
  "themes/meta.json": { title: "Themes", pages: ["index"] },
  "ui/meta.json": { title: "UI", pages: ["index"] },
  "tsconfig/meta.json": { title: "TSConfig", pages: ["index"] },
  "development/meta.json": {
    title: "Development",
    pages: ["index", "dependencies", "changesets", "publishing"],
  },
};

export function getDocumentationPath(slug: string) {
  return `/docs${slug === "index" ? "" : `/${slug.replace(/\/index$/, "")}`}`;
}

const repositorySource = new URL("https://github.com/raypx/raypx-kit/blob/canary/");

export function getSourceUrl(sourcePath: string) {
  return `${repositorySource.href}${sourcePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function getContentUrl(href: string, sourcePath: string) {
  if (href.startsWith("#") || href.startsWith("?") || /^\/docs(?:\/|$)/.test(href)) return href;

  const url = new URL(href, getSourceUrl(sourcePath));
  if (url.origin !== repositorySource.origin || !url.pathname.startsWith(repositorySource.pathname))
    return href;

  const target = decodeURIComponent(url.pathname.slice(repositorySource.pathname.length));
  const page = documentationPages.find((entry) => entry.sourcePath === target);
  return page ? `${getDocumentationPath(page.slug)}${url.search}${url.hash}` : url.href;
}
