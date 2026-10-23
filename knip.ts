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

const browserLibrary = {
  ...library,
  // Vite loads consumer HTML modules and the shared server loads optional SSR entries.
  entry: ["e2e/fixture/main.tsx", "e2e/fixture/server.tsx"],
  project: [...libraryProject, "e2e/**/*.{ts,tsx}"],
  typescript: { config: ["tsconfig.json", "tsconfig.build.json", "e2e/tsconfig.json"] },
};

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: [
        // Bun receives this preload through a computed execArgv path in Intl's test config.
        "tests/setup/jsdom-preload.ts",
      ],
      // package.json scripts provide the CLI, pack and release entry points.
      project: ["scripts/**/*.ts", "tests/**/*.ts", "e2e/**/*.ts", "*.ts"],
      includeEntryExports: true,
      vite: { config: ["vite.config.ts", "e2e/vite.config.ts"] },
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
      entry: [
        // shadcn resolves this utility through components.json when generating components.
        "src/ui/lib/utils.ts",
        "examples/**/*.{tsx,jsx}",
        "examples/vite.config.ts",
        // Playwright starts this fixture through the selected Node executable.
        "e2e/serve.ts",
      ],
      project: [
        ...libraryProject,
        "src/**/*.tsx",
        "src/**/*.css",
        "e2e/**/*.{ts,tsx}",
        "build/**/*.ts",
        "examples/**/*.{ts,tsx,jsx}",
      ],
      vitest: true,
      tsdown: true,
      typescript: { config: ["tsconfig.json", "tsconfig.build.json", "e2e/tsconfig.json"] },
    },
    "packages/intl": {
      ...browserLibrary,
    },
    "packages/analytics": {
      ...browserLibrary,
      entry: ["e2e/fixture/main.tsx"],
      project: [...browserLibrary.project, "src/**/*.tsx"],
    },
    "packages/logger": {
      ...library,
    },
    "packages/notifications": {
      ...browserLibrary,
      project: [...browserLibrary.project, "src/**/*.tsx"],
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
      ...browserLibrary,
      project: [...browserLibrary.project, "src/**/*.tsx", "scripts/**/*.ts"],
    },
    "packages/ui": {
      ...browserLibrary,
      project: [...browserLibrary.project, "src/**/*.tsx"],
      // Compiled by the installed archive fixture, which has its own dependency environment.
      ignoreDependencies: ["@tailwindcss/node", "tailwindcss"],
    },
    docs: {
      // Nitro spawns the prerender preview wrapper by path from vite.config.ts.
      entry: ["scripts/preview.ts"],
      project: ["scripts/**/*.ts", "src/**/*.{ts,tsx,css,mdx}", "tests/**/*.ts", "e2e/**/*.ts"],
      includeEntryExports: true,
      // Fumadocs' macro replaces the conventional source.config.ts in this application.
      fumadocs: { entry: ["src/lib/source.ts"] },
      "tanstack-router": true,
      vitest: { entry: ["tests/**/*.test.ts"] },
    },
  },
};

export default config;
