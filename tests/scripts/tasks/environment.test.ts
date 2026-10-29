import { expect, it } from "vite-plus/test";
import { taskEnvironment } from "../../../scripts/tasks/environment.js";

it("preserves build inputs and CI guards while removing per-job and agent metadata", () => {
  const inputs = {
    PATH: "/bin",
    HOME: "/home/test",
    CI: "true",
    GITHUB_ACTIONS: "true",
    NODE_ENV: "production",
    VITE_SITE_URL: "https://kit.test",
    TOOLKIT_DOCS_PRESET: "bun",
    CUSTOM_TOKEN: "test-fixture",
    SSH_AUTH_SOCK: "/tmp/test-agent",
    NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/",
  };
  const one = taskEnvironment({
    ...inputs,
    CODEX_TOOL_CALL_ID: "one",
    SHLVL: "1",
    XPC_SERVICE_NAME: "one",
    npm_lifecycle_event: "verify",
    GITHUB_JOB: "javascript",
    GITHUB_ENV: "/tmp/one",
    RUNNER_TRACKING_ID: "one",
    ACTIONS_RUNTIME_TOKEN: "test-fixture",
  });
  const two = taskEnvironment({
    ...inputs,
    CODEX_TOOL_CALL_ID: "two",
    SHLVL: "2",
    XPC_SERVICE_NAME: "two",
    npm_lifecycle_event: "docs:build",
    GITHUB_JOB: "browser",
    GITHUB_ENV: "/tmp/two",
    RUNNER_TRACKING_ID: "two",
  });
  expect(one).toEqual(inputs);
  expect(two).toEqual(one);
});
