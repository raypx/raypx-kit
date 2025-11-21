import { describe, expect, it } from "vitest";
import { createContext, flattenMessages, getNestedValue } from "../src/core/context";
import { resolveOptions } from "../src/core/options";

describe("createContext", () => {
  it("should create context with options and root", () => {
    const options = resolveOptions();
    const ctx = createContext(options, "/test/root");

    expect(ctx.options).toBe(options);
    expect(ctx.root).toBe("/test/root");
    expect(ctx.localeData).toBeInstanceOf(Map);
    expect(ctx.translationKeys).toBeInstanceOf(Set);
  });
});

describe("getNestedValue", () => {
  const messages = {
    app: {
      title: "Hello",
      nested: {
        deep: "Deep Value",
      },
    },
    simple: "Simple",
  };

  it("should get simple key", () => {
    expect(getNestedValue(messages, "simple")).toBe("Simple");
  });

  it("should get nested key", () => {
    expect(getNestedValue(messages, "app.title")).toBe("Hello");
  });

  it("should get deeply nested key", () => {
    expect(getNestedValue(messages, "app.nested.deep")).toBe("Deep Value");
  });

  it("should return undefined for missing key", () => {
    expect(getNestedValue(messages, "missing")).toBeUndefined();
    expect(getNestedValue(messages, "app.missing")).toBeUndefined();
  });
});

describe("flattenMessages", () => {
  it("should flatten nested messages", () => {
    const messages = {
      app: {
        title: "Hello",
        nested: {
          deep: "Deep",
        },
      },
      simple: "Simple",
    };

    const flattened = flattenMessages(messages);

    expect(flattened).toEqual({
      "app.title": "Hello",
      "app.nested.deep": "Deep",
      simple: "Simple",
    });
  });
});
