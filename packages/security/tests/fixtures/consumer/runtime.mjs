import assert from "node:assert/strict";
import {
  ArcjetAllowDecision,
  ArcjetDenyDecision,
  ArcjetErrorDecision,
  ArcjetErrorReason,
  ArcjetReason,
  shield,
} from "@arcjet/node";
import { applySecurityHeaders } from "@raypx-kit/security";
import { createArcjetSecurity } from "@raypx-kit/security/arcjet";

// Exercise the real installed SDK with a local decision transport. No credentials
// or remote requests are involved, even in the isolated archive consumer.
let nextDecision = new ArcjetAllowDecision({ ttl: 0, reason: new ArcjetReason(), results: [] });
const seen = [];
const client = {
  async decide(_context, details) {
    seen.push(details);
    return nextDecision;
  },
  report() {},
};
const configuration = {
  key: "ajkey_local_fixture",
  getClientIp: () => "10.0.0.5",
  onError: "deny",
  rules: [shield({ mode: "LIVE" })],
  client,
  log: { debug() {}, info() {}, warn() {}, error() {} },
};
const security = createArcjetSecurity(configuration);
const request = new Request("https://example.com:8443/signup?plan=pro", {
  method: "POST",
  headers: {
    host: "untrusted.example",
    "x-forwarded-for": "1.1.1.1",
    "x-arcjet-ip": "1.1.1.1",
    cookie: "fixture=one",
    "user-agent": "archive-fixture",
  },
  body: "untouched request body",
});
const allowed = await security.protect(request, { ipSrc: "1.1.1.1" });
assert.equal(allowed.status, "allow");
assert.equal(allowed.allowed, true);
assert.equal(allowed.decision, nextDecision);
assert.equal(seen.length, 1);
assert.equal(seen[0].ip, "10.0.0.5");
assert.equal(seen[0].host, "example.com:8443");
assert.equal(seen[0].path, "/signup");
assert.equal(seen[0].query, "?plan=pro");
assert.equal(seen[0].method, "POST");
assert.equal(seen[0].protocol, "https:");
assert.equal(seen[0].headers.get("x-forwarded-for"), null);
assert.equal(seen[0].headers.get("x-arcjet-ip"), null);
assert.equal(seen[0].headers.get("user-agent"), "archive-fixture");
assert.equal(request.bodyUsed, false);
assert.equal(await request.text(), "untouched request body");

nextDecision = new ArcjetDenyDecision({ ttl: 0, reason: new ArcjetReason(), results: [] });
const denied = await security.protect(new Request("https://example.com/blocked"));
assert.equal(denied.status, "deny");
assert.equal(denied.allowed, false);

nextDecision = new ArcjetErrorDecision({
  ttl: 0,
  reason: new ArcjetErrorReason("Local transport unavailable"),
  results: [],
});
const failed = await security.protect(new Request("https://example.com/unavailable"));
assert.equal(failed.status, "error");
assert.equal(failed.allowed, false);
assert.equal(failed.decision, nextDecision);
assert.equal(failed.error.message, "Local transport unavailable");
const failOpen = createArcjetSecurity({ ...configuration, onError: "allow" });
assert.equal(
  (await failOpen.protect(new Request("https://example.com/unavailable"))).allowed,
  true,
);
assert.throws(() => createArcjetSecurity({ ...configuration, key: "" }), /nonempty key/);

const response = applySecurityHeaders(new Response("Forbidden", { status: 403 }));
assert.equal(response.status, 403);
assert.equal(response.headers.get("x-content-type-options"), "nosniff");
assert.equal(await response.text(), "Forbidden");
