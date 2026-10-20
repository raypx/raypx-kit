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
    "packages/intl": {
      ...library,
    },
    "packages/logger": {
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
