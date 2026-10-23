# @raypx-kit/analytics

Consent-controlled product analytics and sanitized browser errors backed by PostHog.
ESM; Node 22.21+ for imports and Bun consumers. Browser delivery requires a browser.
The external `posthog-js` dependency uses its no-external entry, so the SDK never
loads recorder, survey or other scripts from a CDN. React 19 is an optional peer.

## Entries

- Root: `AnalyticsClient`, `AnalyticsConsent`, `AnalyticsProperties`, `EventPolicy`,
  `DEFAULT_ANALYTICS_CONSENT`, `createNoopAnalytics`, `sanitizeException`, `applicationFrame`.
- `/browser`: `createBrowserAnalytics`, `BrowserAnalyticsOptions`.
- `/react`: `AnalyticsProvider`, `useAnalytics`, `AnalyticsErrorBoundary`.

Every entry is safe to import during SSR. Importing does not initialize PostHog.
Optional static `properties` attach safe application context (such as surface) to all
events, including exceptions. Never include credentials or business content.

Applications own environment parsing, event schemas, identity, preference storage,
release assets and error UI. No application configuration is read by this package.

```ts
import { createBrowserAnalytics } from "@raypx-kit/analytics/browser";
const analytics = createBrowserAnalytics({
  token: "your-project-token",
  host: "https://us.i.posthog.com",
  environment: "production",
  release: "your-commit",
  assetOrigins: ["https://app.example.com"],
  policy: (event, properties) =>
    event === "view_opened" ? { page: properties.page === "settings" ? "settings" : "home" } : null,
});
analytics.setConsent({ usage: true, errors: false }); // only after user action
analytics.identify("internal-user-id");
analytics.capture("view_opened", { page: "settings" });
```

Both categories start disabled. `capture` and `identify` require usage consent;
`captureException` and global error/rejection listeners require error consent.
Errors-only mode remains anonymous. No events are retained before consent or
replayed when consent is granted later. Unknown events fail closed through the
application policy. SDK loading and delivery are best effort and never reject a
product operation. A failed load is retried on a future operation, not in a loop.

`identify(null)` / `reset()` clears SDK identity and invalidates in-flight work;
call before changing accounts. `setConsent` controls each category independently.
`dispose` permanently stops the client and removes global listeners. SDK state is
memory-only. Applications persist consent separately; cross-device correlation
uses the internal user ID, never email or name. The SDK's separate persisted consent
is synchronized from the application's current choice after initialization.
Anonymous pre-login IDs are not
merged into identified profiles, avoiding unbounded alias creation with memory-only
persistence. Already sent events are not deleted
when consent is withdrawn.

The SDK formats events; the final sanitized payload is handed to this package's
single-attempt fetch transport. SDK dispatch and retry queues receive no events.
Requests omit credentials and referrers, disable keepalive, and time out after ten
seconds. HTTP errors, network failures and timeouts are dropped without retries,
offline queues or unload beacons. Consent changes, account changes, reset and dispose
abort pending requests and discard stale work. Delivery is best effort; aborting a
request cannot retract data that already reached the server.

## Errors and data boundaries

Error messages become a machine code or `UNEXPECTED_ERROR`. Causes, arbitrary
thrown objects, function text and local paths are not transmitted. Only frames in
`/assets/*.js` or `.mjs` on an explicitly permitted HTTP(S) or `views:` origin are
retained; query strings and fragments are removed. Unknown frames are discarded.
The final SDK event is rebuilt so default URL, referrer, campaign and person
properties cannot bypass the application policy. Do not include private content
in allowed custom properties: the application owns that policy.

Automatic clicks, pageviews, console/network capture, heatmaps, surveys, flags and
session recording are disabled. Manual page events must use application route
identifiers, never raw URLs. No server or native crash collection is provided.

## React

```tsx
import { AnalyticsProvider, AnalyticsErrorBoundary } from "@raypx-kit/analytics/react";
<AnalyticsProvider client={analytics}>
  <AnalyticsErrorBoundary client={analytics} fallback={<p>Unable to open this view.</p>}>
    <App />
  </AnalyticsErrorBoundary>
</AnalyticsProvider>;
```

The provider borrows its client; the application owns its lifetime. This avoids
reinitialization in React Strict Mode. `useAnalytics()` is a no-op without a provider.

For readable production frames, generate hidden source maps, inject PostHog chunk
metadata, upload maps and ship those same injected assets. Upload credentials
belong only in the release environment; maps must not be public app assets.
See [PostHog source maps](https://posthog.com/docs/error-tracking/upload-source-maps/cli).

## Development

Run the package tests and check, then the repository `bun run verify`. Packed
consumer fixtures cover public declarations and SSR imports with and without React.

## Browser E2E

React consent controls, revocation, local SDK request delivery and error-boundary fallback.

Run `bun run test:e2e:install` once at the repository root, then
`bun run --cwd packages/analytics test:e2e`. The package owns its scenarios in
`e2e/`; see the [browser test guide](../../docs/development/README.md#browser-e2e-by-workspace)
for project selection, reports and CI behavior.
