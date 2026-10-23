import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { generateKeyPairSync, verify } from "node:crypto";
import { createNotifications, signNotificationUserToken } from "@raypx-kit/notifications";

const require = createRequire(import.meta.url);
for (const peer of ["react", "react-dom", "@knocklabs/react"]) {
  assert.throws(() => require.resolve(peer), { code: "MODULE_NOT_FOUND" });
}
let requested = false;
const client = createNotifications({
  apiKey: "sk_test_without_react",
  baseURL: "http://127.0.0.1:9999",
  maxRetries: 0,
  logLevel: "off",
  fetch: async (input, init) => {
    const request = new Request(input, init);
    requested = true;
    assert.equal(new URL(request.url).pathname, "/v1/workflows/welcome/trigger");
    assert.deepEqual(await request.json(), { recipients: ["server-user"] });
    return Response.json({ workflow_run_id: "without-react" });
  },
});
assert.equal(requested, false);
assert.equal(
  (await client.workflows.trigger("welcome", { recipients: ["server-user"] })).workflow_run_id,
  "without-react",
);
assert.equal(requested, true);
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const token = await signNotificationUserToken("server-user", {
  signingKey: privateKey,
  expiresInSeconds: 60,
});
const [header, payload, signature] = token.split(".");
assert.equal(
  verify(
    "RSA-SHA256",
    Buffer.from(`${header}.${payload}`),
    publicKey,
    Buffer.from(signature, "base64url"),
  ),
  true,
);
