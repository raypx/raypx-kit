# @raypx-kit/security

Security headers for Fetch responses and optional Arcjet request protection for
Node and Bun servers. Applications own their configuration, keys, trusted client
IPs, rules and failure policy. Importing either entry does not send requests.

## Install

```sh
bun add @raypx-kit/security
# Only needed for request detection:
bun add @arcjet/node
```

The root entry works without Arcjet. The `/arcjet` entry requires the optional
`@arcjet/node` peer, starting at version 1.14.1. Both SDKs remain external.
Supported Node versions follow Nosecone and Arcjet:
`>=22.21.0 <23 || >=24.5.0`. Repository verification uses Node 22.21.0,
Node 24.22.0 and Bun 1.4.4. The Arcjet entry uses Node APIs and is not an edge
Worker or browser entry. There is no Next.js or TanStack runtime dependency.

## Response headers

```ts
import {
  applySecurityHeaders,
  createSecurityHeaders,
  type SecurityHeadersOptions,
} from "@raypx-kit/security";

const options: SecurityHeadersOptions = {
  // Enable after confirming that this deployment is HTTPS-only.
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: false,
    preload: false,
  },
};

const headers = createSecurityHeaders(options);
const response = applySecurityHeaders(new Response("Hello"), options);
```

Options use [Nosecone's configuration](https://docs.arcjet.com/nosecone/reference).
Defaults include `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy: no-referrer`, and same-origin opener/resource policies.
**CSP, HSTS and COEP are disabled by default** and must be enabled by the
application. OAuth popups may need `crossOriginOpenerPolicy: { policy:
"same-origin-allow-popups" }`; public assets may need a different resource policy.

`contentSecurityPolicy: true` enables Nosecone's strict defaults. A custom
`contentSecurityPolicy.directives` object replaces the default directives in
full; it does not merge them. Applications must supply all required directives
and coordinate script nonces with their renderer. Enabling CSP alone does not
configure TanStack Start's scripts or development server.

`applySecurityHeaders` returns a standard `Response`, preserving its status,
ordinary headers, individual `Set-Cookie` values and body stream. Generated
security headers replace existing values with the same name. Disabling a policy
does not remove a header already set by the application. The input is not mutated
or buffered, but the returned response shares its body: consume the returned
response only. Already consumed or locked bodies are rejected. Custom response
subclass properties and nonstandard responses such as WebSocket upgrades are
outside this helper's contract.

## Optional Arcjet protection

Create a client once in server-owned code and pass a Fetch request at the boundary:

```ts
import { detectBot, shield, tokenBucket } from "@arcjet/node";
import { createArcjetSecurity } from "@raypx-kit/security/arcjet";

export function createApplicationSecurity(
  key: string,
  getClientIp: (request: Request) => string | undefined,
) {
  return createArcjetSecurity({
    key,
    getClientIp,
    onError: "deny",
    rules: [
      shield({ mode: "LIVE" }),
      detectBot({ mode: "LIVE", allow: ["CATEGORY:SEARCH_ENGINE"] }),
      tokenBucket({ mode: "LIVE", refillRate: 10, interval: 60, capacity: 20 }),
    ],
  });
}

// In a handler, using an application-configured instance:
// const result = await security.protect(request, { requested: 1 });
// if (!result.allowed) return new Response("Forbidden", { status: 403 });
```

Rules come directly from `@arcjet/node`. Their required properties and custom
`characteristics` retain the SDK's types: token-bucket rules require `requested`,
email rules require `email`, and a `userId` characteristic requires `userId`.
Per-request `metadata` and `correlationId` are supported. `client` and `log` can
be provided when constructing the client, including a mock transport for tests.

`getClientIp` is required and may be asynchronous. Return a bare IPv4 or IPv6
address from trusted server/platform metadata. The wrapper passes this as the
SDK's explicit IP override and strips IP-forwarding headers from the adapted
request. Callers cannot override that IP through rule properties. Missing or
invalid IPs produce an error result; local/private IPs are accepted by the SDK's
explicit override. A Fetch request alone cannot prove the connection's IP.
Implement proxy trust at the server boundary; do not simply copy an arbitrary
`X-Forwarded-For` header into this callback.

| Result status | allowed         | Meaning                                                                           |
| ------------- | --------------- | --------------------------------------------------------------------------------- |
| allow         | true            | Arcjet allowed the request; includes decision.                                    |
| deny          | false           | Arcjet denied or challenged the request; includes decision.                       |
| error         | Follows onError | IP resolution, SDK or transport failed; includes error and an available decision. |

`onError` is required: `"deny"` blocks on failure and `"allow"` permits handling
to continue. There is no silent fallback for a missing key; client creation
throws. A challenge is treated as denied because this adapter does not implement
a challenge flow. Applications choose their HTTP status/body and logging policy;
for example, use 429 for a rate-limit denial, 403 for other denials and 503 for a
failed check with `onError: "deny"`. In `DRY_RUN`, a rule may report a detection
without denying it; enforcement follows the SDK decision.

The error policy covers invalid IPs, thrown checks, the SDK's top-level `ERROR`
or returned rule errors, and this adapter's failed automatic body inspection.
An explicit denial or challenge takes precedence over an error. Arcjet can
discard some local rule errors when returning a successful remote decision;
this wrapper cannot observe those discarded errors. Custom rules must expose
their failure outcomes explicitly rather than rely on an internally swallowed
exception to block a request.

The wrapper never consumes the Fetch request body. For text-inspecting rules,
provide explicit rule data such as `sensitiveInfoValue`; attempted automatic body
inspection produces an error result instead of inspecting an empty body. This package
does not read environment variables. The upstream SDK retains its own defaults
for logging, platform detection and remote API configuration; supply an explicit
`client`/`log` where needed. Cloud checks require an Arcjet account and may send
request metadata to Arcjet according to its rules and SDK behavior.

## TanStack Start

Use request middleware in the application's `src/start.ts`. The following
example adds response headers, including to successful server-function responses:

```ts
import { createMiddleware, createStart } from "@tanstack/react-start";
import { applySecurityHeaders } from "@raypx-kit/security";

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next();
  return { ...result, response: applySecurityHeaders(result.response) };
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}));
```

To add detection, invoke your configured client before `next()`:

```ts
import { createMiddleware } from "@tanstack/react-start";
import { applySecurityHeaders } from "@raypx-kit/security";
import { security } from "./security.server"; // Application-owned client and trusted IP resolver.

export const requestProtection = createMiddleware().server(async ({ request, next }) => {
  const result = await security.protect(request, { requested: 1 });
  if (!result.allowed) {
    const status =
      result.status === "error" ? 503 : result.decision.reason.isRateLimit() ? 429 : 403;
    return applySecurityHeaders(new Response("Request blocked", { status }));
  }
  const response = await next();
  return { ...response, response: applySecurityHeaders(response.response) };
});
```

Register `requestProtection` as the request middleware when using this combined
version. Static assets and responses produced by an outer proxy or error handler
need headers at that layer too. Keep the client in server-only code and provide
the deployment adapter's trusted connection metadata to the IP resolver.

## Scope and reference

The design follows the separation in
[next-forge's security package](https://github.com/vercel/next-forge/tree/f189de79ceef7c1ef69f61f12e272f99b4cdb699/packages/security):
Nosecone for response headers and Arcjet for request detection. This package is an
original Fetch-based implementation; it does not include next-forge source,
Next.js middleware, environment loading, a global SDK client or product rules.
It does not replace authentication, authorization, CSRF controls or network-level
DDoS protection. Unit and archive tests use mocked Arcjet decisions, not a live
account or an assertion about cloud detection accuracy.

## Licenses

[LICENSE](./LICENSE) contains this package's Apache-2.0 terms. External
dependencies ship their own license texts; the index below links to their exact
installed versions without duplicating those texts. Run `bun run licenses:update`
from the repository root after dependency changes; `bun run licenses:check`
rejects a stale index.

<!-- BEGIN GENERATED DEPENDENCY LICENSE INDEX -->

| Package      | Installed version | License    | License text                                             |
| ------------ | ----------------- | ---------- | -------------------------------------------------------- |
| @arcjet/node | 1.15.0            | Apache-2.0 | [LICENSE](https://unpkg.com/@arcjet/node@1.15.0/LICENSE) |
| nosecone     | 1.15.0            | Apache-2.0 | [LICENSE](https://unpkg.com/nosecone@1.15.0/LICENSE)     |

<!-- END GENERATED DEPENDENCY LICENSE INDEX -->
