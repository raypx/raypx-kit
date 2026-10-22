import { shield, tokenBucket, validateEmail } from "@arcjet/node";
import {
  applySecurityHeaders,
  createSecurityHeaders,
  type SecurityHeadersOptions,
} from "@raypx-kit/security";
import { createArcjetSecurity, type ArcjetSecurityResult } from "@raypx-kit/security/arcjet";

const headers: Headers = createSecurityHeaders({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
} satisfies SecurityHeadersOptions);
const response: Response = applySecurityHeaders(new Response("example", { headers }));
void response;

const options = {
  key: "ajkey_fixture",
  getClientIp: (_request: Request) => "127.0.0.1",
  onError: "deny",
} as const;
const request = new Request("https://example.com");
const basic = createArcjetSecurity({ ...options, rules: [shield({ mode: "LIVE" })] });
const result: Promise<ArcjetSecurityResult> = basic.protect(request);
void result;
basic.protect(request, { correlationId: "fixture" });
// @ts-expect-error The independently trusted resolver owns the IP override.
basic.protect(request, { ipSrc: "1.1.1.1" });

const security = createArcjetSecurity({
  ...options,
  characteristics: ["userId"],
  rules: [
    tokenBucket({ mode: "LIVE", refillRate: 5, interval: 60, capacity: 10 }),
    validateEmail({ mode: "LIVE", deny: ["INVALID"] }),
  ],
});
security.protect(request, { requested: 1, email: "person@example.com", userId: "fixture" });
// @ts-expect-error The properties argument cannot be omitted for rules that require values.
security.protect(request);
// @ts-expect-error The token-bucket rule requires requested.
security.protect(request, { email: "person@example.com", userId: "fixture" });
// @ts-expect-error The email rule requires email.
security.protect(request, { requested: 1, userId: "fixture" });
// @ts-expect-error The custom characteristic requires userId.
security.protect(request, { requested: 1, email: "person@example.com" });
// @ts-expect-error Required properties retain their SDK types.
security.protect(request, { requested: "one", email: "person@example.com", userId: "fixture" });
const { onError: _onError, ...missingPolicy } = options;
// @ts-expect-error Each application must choose its error policy.
createArcjetSecurity({ ...missingPolicy, rules: [] });

function handle(decision: ArcjetSecurityResult) {
  if (decision.status === "allow") {
    const allowed: true = decision.allowed;
    return allowed;
  }
  if (decision.status === "deny") {
    const denied: false = decision.allowed;
    void decision.decision.reason;
    return denied;
  }
  const error: Error = decision.error;
  return error.message;
}
void handle;
