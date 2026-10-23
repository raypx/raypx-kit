import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const originalFetch = globalThis.fetch;
let importRequests = 0;
globalThis.fetch = async () => {
  importRequests++;
  throw new Error("Import must not send a request");
};
let notifications;
try {
  notifications = await import("@raypx-kit/notifications");
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(importRequests, 0);
const { createNotifications, signNotificationUserToken } = notifications;
assert.throws(() => createNotifications({}), /apiKey must be provided explicitly/);

const requests = [];
const server = createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString();
    requests.push({
      method: request.method,
      path: request.url,
      headers: request.headers,
      body: text ? JSON.parse(text) : null,
    });
    response.setHeader("content-type", "application/json");
    if (request.url === "/v1/users/missing") {
      response.writeHead(404).end(JSON.stringify({ message: "local missing user" }));
    } else if (request.url.endsWith("/cancel")) {
      response.writeHead(204).end();
    } else if (request.url.endsWith("/trigger")) {
      response.end(JSON.stringify({ workflow_run_id: "archive-run" }));
    } else if (request.url.endsWith("/preferences/default")) {
      response.end(JSON.stringify({ id: "default", channel_types: { email: false } }));
    } else {
      response.end(JSON.stringify({ id: "archive-user", name: "Archive user" }));
    }
  } catch {
    response.writeHead(500).end("fixture error");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const client = createNotifications({
    apiKey: "sk_test_archive_only",
    baseURL: `http://127.0.0.1:${address.port}`,
    maxRetries: 0,
    timeout: 2000,
    logLevel: "off",
  });
  assert.equal(requests.length, 0);
  const user = await client.users.update("archive-user", { name: "Archive user" });
  assert.equal(user.id, "archive-user");
  const preferences = await client.users.setPreferences("archive-user", "default", {
    channel_types: { email: false },
  });
  assert.deepEqual(preferences.channel_types, { email: false });
  const run = await client.workflows.trigger(
    "welcome",
    { recipients: ["archive-user"], cancellation_key: "cancel-archive" },
    { idempotencyKey: "archive-idempotency" },
  );
  assert.equal(run.workflow_run_id, "archive-run");
  await client.workflows.cancel("welcome", { cancellation_key: "cancel-archive" });
  await assert.rejects(client.users.get("missing"), { name: "Error", status: 404 });
  assert.deepEqual(
    requests.map(({ method, path }) => [method, path]),
    [
      ["PUT", "/v1/users/archive-user"],
      ["PUT", "/v1/users/archive-user/preferences/default"],
      ["POST", "/v1/workflows/welcome/trigger"],
      ["POST", "/v1/workflows/welcome/cancel"],
      ["GET", "/v1/users/missing"],
    ],
  );
  assert.equal(requests[0].headers.authorization, "Bearer sk_test_archive_only");
  assert.equal(requests[2].headers["idempotency-key"], "archive-idempotency");
  assert.deepEqual(requests[2].body, {
    recipients: ["archive-user"],
    cancellation_key: "cancel-archive",
  });
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const token = await signNotificationUserToken("archive-user", { signingKey: privateKey });
const [header, body, signature] = token.split(".");
assert.equal(
  verify(
    "RSA-SHA256",
    Buffer.from(`${header}.${body}`),
    publicKey,
    Buffer.from(signature, "base64url"),
  ),
  true,
);
const payload = JSON.parse(Buffer.from(body, "base64url").toString());
assert.equal(payload.sub, "archive-user");
assert.equal(payload.exp - payload.iat, 3600);
await assert.rejects(
  signNotificationUserToken("archive-user", { signingKey: privateKey, expiresInSeconds: 0 }),
  /integer from 1 through 86400/,
);

let ssrRequests = 0;
globalThis.fetch = async () => {
  ssrRequests++;
  throw new Error("SSR must not start notification network requests");
};
try {
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { NotificationsProvider, NotificationInbox } =
    await import("@raypx-kit/notifications/react");
  const html = renderToString(
    createElement(
      NotificationsProvider,
      {
        apiKey: "pk_test_archive_only",
        feedId: "00000000-0000-4000-8000-000000000001",
        user: { id: "archive-user" },
        userToken: token,
        host: "http://127.0.0.1:9999",
        fallback: createElement("span", { role: "status" }, "Loading archive notifications"),
      },
      createElement(NotificationInbox, { label: "Archive notifications" }),
    ),
  );
  assert.equal(html, '<span role="status">Loading archive notifications</span>');
  assert.equal(ssrRequests, 0);
} finally {
  globalThis.fetch = originalFetch;
}
const styles = await readFile(
  new URL(import.meta.resolve("@raypx-kit/notifications/styles.css")),
  "utf8",
);
assert.match(styles, /@import "@knocklabs\/react\/dist\/index\.css"/);
const sdkStyles = await readFile(
  new URL(import.meta.resolve("@knocklabs/react/dist/index.css")),
  "utf8",
);
assert.match(sdkStyles, /rnf-notification/);

const serverEntry = await readFile(
  new URL(import.meta.resolve("@raypx-kit/notifications")),
  "utf8",
);
const reactEntry = await readFile(
  new URL(import.meta.resolve("@raypx-kit/notifications/react")),
  "utf8",
);
assert.doesNotMatch(serverEntry, /["']use client["']/);
assert.doesNotMatch(
  serverEntry,
  /["'](?:react(?:\/[^"']*)?|react-dom(?:\/[^"']*)?|@knocklabs\/react)["']/,
);
assert.match(reactEntry, /^\s*["']use client["'];/);
assert.doesNotMatch(reactEntry, /@knocklabs\/node|signNotificationUserToken/);
