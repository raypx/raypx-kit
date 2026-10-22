import assert from "node:assert/strict";
import { createNoopAnalytics } from "@raypx-kit/analytics";
import { createBrowserAnalytics } from "@raypx-kit/analytics/browser";
import { AnalyticsProvider } from "@raypx-kit/analytics/react";
assert.equal(typeof AnalyticsProvider, "function");
const client = createBrowserAnalytics({
  token: "token",
  host: "https://analytics.example.com",
  environment: "test",
  release: "abc",
  assetOrigins: [],
  policy: () => ({}),
});
client.setConsent({ usage: true, errors: true });
client.capture("server-import");
client.dispose();
createNoopAnalytics().reset();
