import { defineConfig, devices } from "@playwright/test";
import { browserProjects, projectNames } from "./e2e/projects.js";

const selected = projectNames(process.env.RAYPX_E2E_PROJECTS?.split(","));
const ports = new Set(selected.map((name) => browserProjects[name].port));
// Playwright and its fixture servers use the same pinned Bun runtime.
const bun = `'${process.execPath.replaceAll("'", "'\\''")}'`;
// Independent workspace runs must not delete another run's failure traces.
const artifacts =
  selected.length === Object.keys(browserProjects).length
    ? ".artifacts/e2e"
    : `.artifacts/e2e/projects/${[...selected].sort().join("-")}`;

export default defineConfig({
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: `${artifacts}/results`,
  reporter: [
    ["list"],
    ["html", { outputFolder: `${artifacts}/report`, open: "never" }],
    ["junit", { outputFile: `${artifacts}/junit.xml` }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },
  projects: selected.map((name) => {
    const project = browserProjects[name];
    return {
      name,
      testDir: `${project.directory}/e2e`,
      use: {
        baseURL:
          project.port === 4173
            ? `http://127.0.0.1:4173/${project.directory}/e2e/fixture/`
            : `http://127.0.0.1:${project.port}`,
      },
    };
  }),
  webServer: [
    ...(ports.has(4173)
      ? [
          {
            command: "bun --bun vp dev --config e2e/vite.config.ts",
            url: "http://127.0.0.1:4173/__e2e_health",
            reuseExistingServer: false,
            timeout: 60_000,
          },
        ]
      : []),
    ...(ports.has(4174)
      ? [
          {
            command: `${bun} packages/email-preview/e2e/serve.ts --port 4174`,
            url: "http://127.0.0.1:4174/api/templates",
            reuseExistingServer: false,
            timeout: 60_000,
            gracefulShutdown: { signal: "SIGTERM" as const, timeout: 10_000 },
          },
        ]
      : []),
    ...(ports.has(4175)
      ? [
          {
            command: `${bun} docs/scripts/preview.ts --host 127.0.0.1 --port 4175`,
            url: "http://127.0.0.1:4175/docs",
            reuseExistingServer: false,
            timeout: 150_000,
            gracefulShutdown: { signal: "SIGTERM" as const, timeout: 10_000 },
          },
        ]
      : []),
  ],
});
