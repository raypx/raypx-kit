import { describe, expect, it } from "vite-plus/test";
import { defineConfig, mergeConfig } from "vite-plus/test/config";
import { baseLint, strictLint } from "../src/lint.js";
import { bunTestDefaults } from "../src/testing.js";

describe("consumer-owned configuration", () => {
  it("lets native Vite configuration override strict rules and own paths", () => {
    const config = mergeConfig(
      { lint: strictLint },
      {
        lint: { ignorePatterns: ["generated/**"], rules: { "react/no-danger": "off" } },
      },
    );
    expect(config.lint?.rules?.["react/no-danger"]).toBe("off");
    expect(config.lint?.rules?.["react/rules-of-hooks"]).toBe("error");
    expect(config.lint?.ignorePatterns).toEqual(["generated/**"]);
    expect(strictLint.rules["react/no-danger"]).toBe("error");
    expect(baseLint).not.toHaveProperty("ignorePatterns");
  });

  it("keeps suite selection and DOM setup local without mutating the defaults", () => {
    const config = mergeConfig(
      bunTestDefaults,
      defineConfig({
        test: {
          environment: "jsdom",
          include: ["tests/component/**/*.test.tsx"],
          setupFiles: ["./tests/setup.ts"],
          maxWorkers: 2,
        },
      }),
    );
    expect(config.test?.environment).toBe("jsdom");
    expect(config.test?.maxWorkers).toBe(2);
    expect(config.test?.execArgv).toEqual(["--no-env-file", "--no-install"]);
    expect(config.test?.include).toEqual(["tests/component/**/*.test.tsx"]);
    expect(config.test?.setupFiles).toEqual(["./tests/setup.ts"]);
    expect(bunTestDefaults.test.environment).toBe("node");
    expect(bunTestDefaults.test).not.toHaveProperty("include");
    expect(bunTestDefaults.test).not.toHaveProperty("setupFiles");
  });
});
