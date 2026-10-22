import { createNoopAnalytics, type AnalyticsClient } from "@raypx-kit/analytics";
const client: AnalyticsClient = createNoopAnalytics();
client.setConsent({ usage: false, errors: false });
