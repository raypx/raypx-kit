import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { applySecurityHeaders, createSecurityHeaders } from "@raypx-kit/security";

const require = createRequire(import.meta.url);
assert.throws(() => require.resolve("@arcjet/node"), { code: "MODULE_NOT_FOUND" });

const defaults = createSecurityHeaders();
assert.equal(defaults.get("x-content-type-options"), "nosniff");
assert.equal(defaults.get("content-security-policy"), null);
assert.equal(defaults.get("strict-transport-security"), null);
assert.equal(defaults.get("cross-origin-embedder-policy"), null);

const cookies = [
  "session=one; HttpOnly; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/",
  "preference=two; SameSite=Lax; Path=/",
];
const headers = new Headers({ "content-type": "text/plain", "x-request-id": "without-arcjet" });
for (const cookie of cookies) headers.append("set-cookie", cookie);
let controller;
const stream = new ReadableStream({
  start(value) {
    controller = value;
  },
});
const original = new Response(stream, { status: 202, statusText: "Queued", headers });
const secured = applySecurityHeaders(original, {
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
});
assert.equal(secured.body, original.body);
assert.equal(original.bodyUsed, false);
assert.equal(secured.status, 202);
assert.equal(secured.statusText, "Queued");
assert.equal(secured.headers.get("content-type"), "text/plain");
assert.equal(secured.headers.get("x-request-id"), "without-arcjet");
assert.deepEqual(secured.headers.getSetCookie(), cookies);
assert.equal(secured.headers.get("content-security-policy"), "default-src 'none';");
assert.equal(original.headers.has("content-security-policy"), false);
controller.enqueue(new TextEncoder().encode("streamed without optional peers"));
controller.close();
assert.equal(await secured.text(), "streamed without optional peers");
assert.throws(() => applySecurityHeaders(secured), /consumed or locked/);
