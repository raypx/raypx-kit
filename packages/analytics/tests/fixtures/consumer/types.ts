import { createNoopAnalytics, type AnalyticsClient } from "@raypx-kit/analytics";
import { createBrowserAnalytics } from "@raypx-kit/analytics/browser";
import { AnalyticsProvider, useAnalytics } from "@raypx-kit/analytics/react";
const client: AnalyticsClient = createBrowserAnalytics({
  token: "token",
  host: "https://analytics.example.com",
  environment: "test",
  release: "abc",
  assetOrigins: [],
  policy: () => null,
});
client.setConsent({ usage: false, errors: false });
void [createNoopAnalytics(), AnalyticsProvider, useAnalytics];
