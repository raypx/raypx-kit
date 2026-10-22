# @raypx-kit/analytics

```sh
bun add @raypx-kit/analytics
```

PostHog (no-external bundle: no CDN scripts) behind explicit consent.

```ts
import { createBrowserAnalytics } from "@raypx-kit/analytics/browser";

const analytics = createBrowserAnalytics({
  token,
  host,
  environment: "production",
  release: commitSha,
  assetOrigins: [location.origin],
  policy: (event, properties) =>
    event === "page_viewed" ? { page: properties.page === "settings" ? "settings" : "home" } : null,
});
analytics.setConsent({ usage: true, errors: false }); // only after a user choice
analytics.identify(internalUserId); // never email or name
analytics.capture("page_viewed", { page: "settings" });
```

- `usage` consent gates `capture`/`identify`; `errors` gates `captureException` and
  global error listeners (errors-only stays anonymous). Nothing is queued before consent.
- The `policy` is an allowlist: unknown events return `null` and are dropped.
- Call `reset()` before switching accounts; `dispose()` stops the client.
- Errors are reduced to a code plus same-origin `/assets/*.js` frames.
- Autocapture, pageviews, replay, flags, surveys and console/network capture are off.
- `@raypx-kit/analytics/react`: `AnalyticsProvider`, `useAnalytics`,
  `AnalyticsErrorBoundary` (the provider borrows your client).

For readable stack traces upload hidden source maps with the PostHog CLI and ship the
same injected assets; never serve maps publicly.

Full guide: [README](https://github.com/raypx/raypx-kit/blob/canary/packages/analytics/README.md)
