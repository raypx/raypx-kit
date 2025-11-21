import { beforeEach, describe, expect, it } from "vitest";
import { createI18n } from "../src/runtime";

describe("runtime", () => {
  const messages = {
    en: {
      hello: "Hello",
      greeting: "Hello, {name}!",
      nested: {
        key: "Nested Value",
      },
    },
    zh: {
      hello: "你好",
      greeting: "你好，{name}！",
      nested: {
        key: "嵌套值",
      },
    },
  };

  let i18n: ReturnType<typeof createI18n>;

  beforeEach(() => {
    i18n = createI18n({
      locale: "en",
      messages,
    });
  });

  it("should translate simple key", () => {
    expect(i18n.t("hello")).toBe("Hello");
  });

  it("should translate nested key", () => {
    expect(i18n.t("nested.key")).toBe("Nested Value");
  });

  it("should interpolate parameters", () => {
    expect(i18n.t("greeting", { name: "World" })).toBe("Hello, World!");
  });

  it("should return key for missing translation", () => {
    expect(i18n.t("missing.key")).toBe("missing.key");
  });

  it("should switch locale", () => {
    expect(i18n.t("hello")).toBe("Hello");
    i18n.setLocale("zh");
    expect(i18n.t("hello")).toBe("你好");
  });

  it("should get current locale", () => {
    expect(i18n.getLocale()).toBe("en");
    i18n.setLocale("zh");
    expect(i18n.getLocale()).toBe("zh");
  });

  it("should list available locales", () => {
    const locales = i18n.availableLocales();
    expect(locales).toContain("en");
    expect(locales).toContain("zh");
  });
});
