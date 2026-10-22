import { createNoopAnalytics } from "@raypx-kit/analytics";
import { createBrowserAnalytics } from "@raypx-kit/analytics/browser";
createNoopAnalytics().capture("test");
createBrowserAnalytics({
  token: "",
  host: "",
  environment: "test",
  release: "test",
  assetOrigins: [],
  policy: () => null,
}).dispose();
