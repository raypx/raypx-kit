import type { KnipConfig } from "knip";

// Archive contracts run in their own installed tarball environments, not source workspaces.
const libraryProject = [
  "src/**/*.ts",
  "tests/**/*.{ts,tsx}",
  "*.config.ts",
  "!tests/fixtures/consumer/**",
];
const library = {
  // tsdown.config.ts declares public source entries and CLI binaries.
  // Its plugin roots those APIs without treating every implementation file as public.
  entry: [],
  project: libraryProject,
  vitest: true,
  tsdown: true,
  typescript: { config: ["tsconfig.json", "tsconfig.build.json"] },
};

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: [
        // Bun receives this preload through a computed execArgv path in Intl's test config.
        "tests/setup/jsdom-preload.ts",
      ],
      // package.json scripts provide the CLI, pack and release entry points.
      project: ["scripts/**/*.ts", "tests/**/*.ts", "*.ts"],
      includeEntryExports: true,
    },
    "packages/devkit": {
      ...library,
    },
    "packages/codemods": {
      ...library,
    },
    "packages/drizzle": {
      ...library,
      // The CI-only suite uses its own configuration and global setup.
      vitest: { config: ["vitest.config.ts", "vitest.integration.config.ts"] },
    },
    "packages/env": {
      ...library,
    },
    "packages/email-preview": {
      // Nitro and Start load these custom-directory entries; the CLI loads templates.
      entry: [
        "src/http/entry.ts",
        "src/app/router.tsx",
        // shadcn resolves this utility through components.json when generating components.
        "src/app/lib/utils.ts",
        "src/app/routes/**/*.{ts,tsx}",
        "examples/**/*.{tsx,jsx}",
      ],
      project: [
        ...libraryProject,
        "src/**/*.tsx",
        "src/**/*.css",
        "build/**/*.ts",
        "examples/**/*.{ts,tsx,jsx}",
        "!src/app/routeTree.gen.ts",
      ],
      vitest: true,
      tsdown: true,
      "tanstack-router": true,
      typescript: { config: ["tsconfig.json", "tsconfig.build.json"] },
      // Resolved with createRequire and embedded into the consumer template compiler input.
      ignoreDependencies: ["@react-email/render"],
    },
    "packages/intl": {
      ...library,
    },
    "packages/analytics": { ...library, project: [...libraryProject, "src/**/*.tsx"] },
    "packages/logger": {
      ...library,
    },
    "packages/security": {
      ...library,
    },
    "packages/drizzle-kit": {
      project: libraryProject,
      // The build script roots extract.ts; the upstream CLI loads these schema fixtures.
      entry: ["tests/fixtures/schema/{drizzle.config,schema}.ts"],
      vitest: true,
      typescript: true,
      // The extractor copies upstream's CLI unchanged; these imports live in that bundle.
      ignoreDependencies: [
        "@drizzle-team/brocli",
        "@js-temporal/polyfill",
        "esbuild",
        "get-tsconfig",
        "jiti",
        // Upstream's copied declarations reference its optional PGlite adapter type,
        // while upstream declares that driver only as a development dependency.
        // Keep the slim distribution's upstream files and runtime dependency mirror intact.
        "@electric-sql/pglite",
      ],
    },
    "packages/tsconfig": {
      // package.json exports root the five JSON presets; TypeScript follows their extends.
      entry: [],
      project: ["tests/**/*.ts"],
      vitest: true,
      typescript: true,
    },
    "packages/themes": {
      ...library,
      project: [...libraryProject, "src/**/*.tsx", "scripts/**/*.ts"],
    },
    "packages/ui": {
      ...library,
      project: [...libraryProject, "src/**/*.tsx"],
      // Compiled by the installed archive fixture, which has its own dependency environment.
      ignoreDependencies: ["@tailwindcss/node", "tailwindcss"],
    },
    docs: {
      // Nitro spawns the prerender preview wrapper by path from vite.config.ts.
      entry: ["scripts/preview.ts"],
      project: ["scripts/**/*.ts", "src/**/*.{ts,tsx,css,mdx}", "tests/**/*.ts"],
      includeEntryExports: true,
      // Fumadocs' macro replaces the conventional source.config.ts in this application.
      fumadocs: { entry: ["src/lib/source.ts"] },
      "tanstack-router": true,
      vitest: { entry: ["tests/**/*.test.ts"] },
    },
  },
};

export default config;
