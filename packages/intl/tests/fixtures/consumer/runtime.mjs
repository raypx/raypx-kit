import assert from "node:assert/strict";
import { createFormatter, createLocaleRuntime, createTranslator } from "@raypx-kit/intl";
import { createIntlClient } from "@raypx-kit/intl/client";
import { createIntlServer } from "@raypx-kit/intl/server";

const runtime = createLocaleRuntime({ locales: ["en", "zh"], defaultLocale: "en" });
const server = createIntlServer(runtime);
assert.equal(
  server.resolveRequestLocale({
    get: (name) => (name === "accept-language" ? "fr, zh-CN;q=0.9" : null),
  }),
  "zh",
);
const translate = createTranslator({
  locale: "en",
  messages: { greeting: "Hello {name}", count: "{count, plural, one {# item} other {# items}}" },
});
assert.equal(translate("greeting", { name: "Kit" }), "Hello Kit");
assert.equal(translate("count", { count: 2 }), "2 items");
assert.equal(createFormatter({ locale: "en" }).number(1234), "1,234");
const client = createIntlClient()(runtime);
assert.equal(typeof client.IntlProvider, "function");
assert.equal(typeof client.useTranslations, "function");
