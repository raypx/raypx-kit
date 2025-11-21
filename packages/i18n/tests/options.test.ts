import { describe, expect, it } from "vitest";
import { resolveOptions } from "../src/core/options";

describe("resolveOptions", () => {
  it("should return default options when no options provided", () => {
    const options = resolveOptions();

    expect(options.localesDir).toBe("locales");
    expect(options.defaultLocale).toBe("en");
    expect(options.functionName).toBe("t");
    expect(options.strictMode).toBe(false);
    expect(options.generateTypes).toBe(true);
  });

  it("should merge user options with defaults", () => {
    const options = resolveOptions({
      defaultLocale: "zh",
      strictMode: true,
    });

    expect(options.defaultLocale).toBe("zh");
    expect(options.strictMode).toBe(true);
    expect(options.localesDir).toBe("locales");
  });

  it("should normalize include/exclude to arrays", () => {
    const options = resolveOptions({
      include: "**/*.ts",
      exclude: "dist/**",
    });

    expect(options.include).toEqual(["**/*.ts"]);
    expect(options.exclude).toEqual(["dist/**"]);
  });

  it("should keep arrays as arrays", () => {
    const options = resolveOptions({
      include: ["**/*.ts", "**/*.vue"],
      exclude: ["dist/**", "node_modules/**"],
    });

    expect(options.include).toEqual(["**/*.ts", "**/*.vue"]);
    expect(options.exclude).toEqual(["dist/**", "node_modules/**"]);
  });
});
