import { generateKeyPairSync, verify } from "node:crypto";
import { Knock, AuthenticationError, buildUserTokenGrant, Grants } from "@knocklabs/node";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createNotifications,
  signNotificationUserToken,
  type NotificationsOptions,
  type NotificationUserTokenOptions,
} from "../src/index.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const keyPair = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

function readToken(token: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("Expected a signed JWT");
  expect(
    verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      keyPair.publicKey,
      Buffer.from(signature, "base64url"),
    ),
  ).toBe(true);
  expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
    alg: "RS256",
    typ: "JWT",
  });
  return JSON.parse(Buffer.from(payload, "base64url").toString()) as {
    sub: string;
    iat: number;
    exp: number;
    jti?: string;
    grants?: Record<string, Record<string, unknown[]>>;
  };
}

describe("createNotifications", () => {
  it("requires explicit credentials even when SDK environment defaults exist", () => {
    vi.stubEnv("KNOCK_API_KEY", "sk_test_environment_only");
    for (const apiKey of [undefined, null, "", " \n"]) {
      expect(() => createNotifications({ apiKey } as NotificationsOptions)).toThrow(
        /apiKey must be provided explicitly/,
      );
    }
    expect(() => createNotifications(undefined as unknown as NotificationsOptions)).toThrow(
      /apiKey must be provided explicitly/,
    );
  });

  it("returns independent real SDK clients and sends nothing during construction", () => {
    const fetch = vi.fn<NonNullable<NotificationsOptions["fetch"]>>();
    const options = { apiKey: "sk_test_explicit", fetch };
    const first = createNotifications(options);
    const second = createNotifications(options);
    expect(first).toBeInstanceOf(Knock);
    expect(first).not.toBe(second);
    expect(first.users).not.toBe(second.users);
    expect(fetch).not.toHaveBeenCalled();
    expect(options).toEqual({ apiKey: "sk_test_explicit", fetch });
  });

  it("preserves user identification, preferences, workflow trigger and cancellation requests", async () => {
    const requests: Request[] = [];
    const client = createNotifications({
      apiKey: "sk_test_local_only",
      baseURL: "http://127.0.0.1:9999",
      branch: "fixture",
      maxRetries: 0,
      logLevel: "off",
      defaultHeaders: { "x-application": "test" },
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        const path = new URL(request.url).pathname;
        if (path.endsWith("/cancel")) return new Response(null, { status: 204 });
        if (path.endsWith("/trigger")) return Response.json({ workflow_run_id: "local-run" });
        if (path.endsWith("/preferences/default"))
          return Response.json({ id: "default", channel_types: { email: false } });
        return Response.json({ id: "user/one", name: "Ada", email: "ada@example.test" });
      },
    });
    const user = await client.users.update("user/one", {
      name: "Ada",
      email: "ada@example.test",
    });
    expect(user.id).toBe("user/one");
    const preferences = await client.users.setPreferences("user/one", "default", {
      channel_types: { email: false },
    });
    expect(preferences.channel_types).toEqual({ email: false });
    const triggered = await client.workflows.trigger(
      "welcome",
      { recipients: ["user/one"], cancellation_key: "cancel-one", data: { greeting: "Hello" } },
      { idempotencyKey: "workflow-once", headers: { "x-request-contract": "preserved" } },
    );
    expect(triggered.workflow_run_id).toBe("local-run");
    await client.workflows.cancel("welcome", {
      cancellation_key: "cancel-one",
      recipients: ["user/one"],
    });
    expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      ["PUT", "/v1/users/user%2Fone"],
      ["PUT", "/v1/users/user%2Fone/preferences/default"],
      ["POST", "/v1/workflows/welcome/trigger"],
      ["POST", "/v1/workflows/welcome/cancel"],
    ]);
    expect(requests[0]!.headers.get("authorization")).toBe("Bearer sk_test_local_only");
    expect(requests[0]!.headers.get("x-knock-branch")).toBe("fixture");
    expect(requests[0]!.headers.get("x-application")).toBe("test");
    expect(requests[2]!.headers.get("idempotency-key")).toBe("workflow-once");
    expect(requests[2]!.headers.get("x-request-contract")).toBe("preserved");
    expect(await requests[0]!.json()).toEqual({ name: "Ada", email: "ada@example.test" });
    expect(await requests[2]!.json()).toEqual({
      recipients: ["user/one"],
      cancellation_key: "cancel-one",
      data: { greeting: "Hello" },
    });
    expect(await requests[3]!.json()).toEqual({
      cancellation_key: "cancel-one",
      recipients: ["user/one"],
    });
  });

  it("preserves native HTTP errors and per-request abort behavior", async () => {
    const fetch = vi.fn<NonNullable<NotificationsOptions["fetch"]>>(async () =>
      Response.json({ message: "local invalid credentials" }, { status: 401 }),
    );
    const client = createNotifications({
      apiKey: "sk_test_error",
      baseURL: "http://127.0.0.1:9999",
      fetch,
      maxRetries: 0,
      logLevel: "off",
    });
    await expect(client.users.get("missing")).rejects.toBeInstanceOf(AuthenticationError);
    expect(fetch).toHaveBeenCalledTimes(1);
    const controller = new AbortController();
    controller.abort();
    await expect(client.users.get("aborted", { signal: controller.signal })).rejects.toBeInstanceOf(
      Knock.APIUserAbortError,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not construct server clients in a browser", () => {
    vi.stubGlobal("window", {});
    expect(() => createNotifications({ apiKey: "sk_test_browser" })).toThrow(
      /only be used on the server/,
    );
  });
});

describe("signNotificationUserToken", () => {
  it("signs an authentic RS256 token with the exact subject and one-hour default expiry", async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await signNotificationUserToken("tenant/user-你好", {
      signingKey: keyPair.privateKey,
    });
    const payload = readToken(token);
    expect(payload.sub).toBe("tenant/user-你好");
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    expect(payload.exp - payload.iat).toBe(3600);
    expect(payload.grants).toBeUndefined();
    expect(payload.jti).toBeUndefined();
  });

  it("preserves base64 key input, bounded custom expiry, grants and optional JWT IDs", async () => {
    const grant = buildUserTokenGrant({ type: "user", id: "ada" }, [Grants.UserFeedRead]);
    const options = {
      signingKey: Buffer.from(keyPair.privateKey).toString("base64"),
      expiresInSeconds: 120,
      shouldGenerateJti: true,
      grants: [grant],
    } satisfies NotificationUserTokenOptions;
    const first = readToken(await signNotificationUserToken("ada", options));
    const second = readToken(await signNotificationUserToken("ada", options));
    expect(first.exp - first.iat).toBe(120);
    expect(first.grants).toEqual({
      "https://api.knock.app/v1/users/ada": { "user/feed_read": [] },
    });
    expect(first.jti).toMatch(/^[\da-f-]{36}$/i);
    expect(first.jti).not.toBe(second.jti);
    for (const expiresInSeconds of [1, 86400]) {
      const payload = readToken(
        await signNotificationUserToken("ada", { ...options, expiresInSeconds }),
      );
      expect(payload.exp - payload.iat).toBe(expiresInSeconds);
    }
  });

  it("rejects absent identities and keys without falling back to signing environment variables", async () => {
    vi.stubEnv("KNOCK_SIGNING_KEY", keyPair.privateKey);
    for (const signingKey of [undefined, null, "", "  "]) {
      await expect(
        signNotificationUserToken("ada", { signingKey } as NotificationUserTokenOptions),
      ).rejects.toThrow(/signingKey must be provided explicitly/);
    }
    for (const userId of [undefined, null, "", " \n"]) {
      await expect(
        signNotificationUserToken(userId as string, { signingKey: keyPair.privateKey }),
      ).rejects.toThrow(/userId must be provided explicitly/);
    }
    await expect(
      signNotificationUserToken("ada", undefined as unknown as NotificationUserTokenOptions),
    ).rejects.toThrow(/signingKey must be provided explicitly/);
  });

  it("rejects unbounded or invalid lifetimes before attempting to sign", async () => {
    for (const expiresInSeconds of [0, -1, 1.5, 86401, NaN, Infinity]) {
      await expect(
        signNotificationUserToken("ada", { signingKey: keyPair.privateKey, expiresInSeconds }),
      ).rejects.toThrow(/integer from 1 through 86400/);
    }
    await expect(signNotificationUserToken("ada", { signingKey: "invalid-key" })).rejects.toThrow(
      /signing key format/,
    );
  });

  it("does not sign tokens in a browser", async () => {
    vi.stubGlobal("window", {});
    await expect(
      signNotificationUserToken("ada", { signingKey: keyPair.privateKey }),
    ).rejects.toThrow(/only be used on the server/);
  });
});
