import {
  ArcjetAllowDecision,
  ArcjetChallengeDecision,
  ArcjetDenyDecision,
  ArcjetErrorDecision,
  ArcjetErrorReason,
  ArcjetReason,
  ArcjetRuleResult,
  type ArcjetNodeRequest,
  shield,
  tokenBucket,
  validateEmail,
} from "@arcjet/node";
import { beforeEach, describe, expect, expectTypeOf, test, vi } from "vite-plus/test";
import { createArcjetSecurity, type ArcjetSecurityOptions } from "../src/arcjet.js";

const sdk = vi.hoisted(() => ({ create: vi.fn(), protect: vi.fn() }));
vi.mock("@arcjet/node", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@arcjet/node")>()),
  default: sdk.create,
}));

const decisionOptions = { ttl: 0, reason: new ArcjetReason(), results: [] };
const allowed = new ArcjetAllowDecision(decisionOptions);
const options = {
  key: "ajkey_test",
  rules: [shield({ mode: "LIVE" })],
  onError: "deny",
  getClientIp: () => "8.8.8.8",
} satisfies ArcjetSecurityOptions<ReturnType<typeof shield>[]>;

beforeEach(() => {
  sdk.create.mockReset().mockReturnValue({ protect: sdk.protect });
  sdk.protect.mockReset().mockResolvedValue(allowed);
});

describe("createArcjetSecurity", () => {
  test("passes explicit configuration to an independent SDK client", async () => {
    const first = createArcjetSecurity(options);
    const secondProtect = vi.fn().mockResolvedValue(allowed);
    sdk.create.mockReturnValueOnce({ protect: secondProtect });
    const second = createArcjetSecurity({ ...options, key: "ajkey_second" });
    const request = new Request("https://example.com/");
    expect(sdk.create).toHaveBeenNthCalledWith(1, {
      key: options.key,
      rules: options.rules,
    });
    expect(sdk.create).toHaveBeenNthCalledWith(2, {
      key: "ajkey_second",
      rules: options.rules,
    });
    expect(await first.protect(request)).toEqual({
      status: "allow",
      allowed: true,
      decision: allowed,
    });
    await second.protect(request);
    expect(sdk.protect).toHaveBeenCalledTimes(1);
    expect(secondProtect).toHaveBeenCalledTimes(1);
  });

  test("uses only the trusted IP and URL while preserving request headers and body", async () => {
    const request = new Request("https://example.com:8443/submit?plan=pro", {
      method: "POST",
      headers: {
        host: "untrusted.example",
        "x-forwarded-for": "1.1.1.1",
        forwarded: "for=1.1.1.1",
        "x-real-ip": "1.1.1.1",
        "cf-connecting-ip": "1.1.1.1",
        "x-vercel-forwarded-for": "1.1.1.1",
        "x-arcjet-ip": "1.1.1.1",
        cookie: "session=example",
        "user-agent": "test browser",
        "content-type": "application/json",
      },
      body: '{"message":"hello"}',
    });
    const getClientIp = vi.fn(async () => "2606:4700:4700::1111");
    const security = createArcjetSecurity({ ...options, getClientIp });
    await security.protect(request);
    const input: ArcjetNodeRequest = sdk.protect.mock.calls[0]![0];
    expect(getClientIp).toHaveBeenCalledWith(request);
    expect(input.socket).toEqual({ remoteAddress: "2606:4700:4700::1111", encrypted: true });
    expect(sdk.protect.mock.calls[0]![1]).toEqual({ ipSrc: "2606:4700:4700::1111" });
    expect(input.url).toBe(request.url);
    expect(input.method).toBe("POST");
    expect(input.headers).toEqual({
      host: "example.com:8443",
      cookie: "session=example",
      "user-agent": "test browser",
      "content-type": "application/json",
    });
    expect(request.headers.get("x-forwarded-for")).toBe("1.1.1.1");
    expect(() => input.body).toThrow("sensitiveInfoValue");
    expect(request.bodyUsed).toBe(false);
    expect(await request.text()).toBe('{"message":"hello"}');
  });

  test.each(["10.0.0.5", "127.0.0.1", "::1"])(
    "uses explicit trusted IP %s instead of a per-request or header override",
    async (clientIp) => {
      const security = createArcjetSecurity({ ...options, getClientIp: () => clientIp });
      const request = new Request("https://example.com", {
        headers: { "x-forwarded-for": "1.1.1.1", "x-arcjet-ip": "1.1.1.1" },
      });
      const properties = {
        correlationId: "request-123",
        metadata: { route: "signup" },
        ipSrc: "1.1.1.1",
      };
      await security.protect(request, properties);
      expect(sdk.protect.mock.calls[0]![1]).toEqual({
        correlationId: "request-123",
        metadata: { route: "signup" },
        ipSrc: clientIp,
      });
      expect(properties.ipSrc).toBe("1.1.1.1");
      type Properties = NonNullable<Parameters<typeof security.protect>[1]>;
      expectTypeOf<Properties>().not.toHaveProperty("ipSrc");
    },
  );

  test.each([undefined, "", "not an IP", "1.1.1.1, 8.8.8.8", "8.8.8.8:443"])(
    "does not fall back to forwarded headers when trusted IP is %s",
    async (clientIp) => {
      const security = createArcjetSecurity({ ...options, getClientIp: () => clientIp });
      const result = await security.protect(
        new Request("https://example.com", { headers: { "x-forwarded-for": "1.1.1.1" } }),
      );
      expect(result).toMatchObject({ status: "error", allowed: false });
      expect(sdk.protect).not.toHaveBeenCalled();
    },
  );

  test.each([
    new ArcjetDenyDecision(decisionOptions),
    new ArcjetChallengeDecision(decisionOptions),
  ])("does not allow a $conclusion decision even with fail-open policy", async (decision) => {
    sdk.protect.mockResolvedValue(decision);
    const security = createArcjetSecurity({ ...options, onError: "allow" });
    expect(await security.protect(new Request("https://example.com"))).toEqual({
      status: "deny",
      allowed: false,
      decision,
    });
  });

  test.each(["allow", "deny"] as const)(
    "applies explicit %s policy to SDK errors, exceptions and resolver failures",
    async (onError) => {
      const decision = new ArcjetErrorDecision({
        ttl: 0,
        results: [],
        reason: new ArcjetErrorReason("SDK is unavailable"),
      });
      sdk.protect.mockResolvedValueOnce(decision);
      const security = createArcjetSecurity({ ...options, onError });
      const request = new Request("https://example.com");
      const result = await security.protect(request);
      expect(result).toMatchObject({ status: "error", allowed: onError === "allow", decision });
      if (result.status === "error") expect(result.error.message).toBe("SDK is unavailable");
      sdk.protect.mockRejectedValueOnce(new Error("transport failed"));
      expect(await security.protect(request)).toMatchObject({
        status: "error",
        allowed: onError === "allow",
        error: new Error("transport failed"),
      });
      const invalidResolver = createArcjetSecurity({
        ...options,
        onError,
        getClientIp: () => {
          throw new Error("platform metadata unavailable");
        },
      });
      expect(await invalidResolver.protect(request)).toMatchObject({
        status: "error",
        allowed: onError === "allow",
        error: new Error("platform metadata unavailable"),
      });
    },
  );

  test.each(["allow", "deny"] as const)(
    "applies %s policy to a failed rule within an otherwise allowed decision",
    async (onError) => {
      const decision = new ArcjetAllowDecision({
        ...decisionOptions,
        results: [
          new ArcjetRuleResult({
            ruleId: "rule-1",
            fingerprint: "test",
            ttl: 0,
            state: "RUN",
            conclusion: "ERROR",
            reason: new ArcjetErrorReason("rule inspection failed"),
          }),
        ],
      });
      sdk.protect.mockResolvedValueOnce(decision);
      const security = createArcjetSecurity({ ...options, onError });
      expect(await security.protect(new Request("https://example.com"))).toMatchObject({
        status: "error",
        allowed: onError === "allow",
        decision,
        error: new Error("rule inspection failed"),
      });
    },
  );

  test("rejects missing configuration before constructing an SDK", () => {
    expect(() => createArcjetSecurity({ ...options, key: "  " })).toThrow("nonempty key");
    const { onError: _onError, ...missingPolicy } = options;
    // @ts-expect-error The failure policy must be explicit, including in JavaScript consumers.
    expect(() => createArcjetSecurity(missingPolicy)).toThrow("onError");
    const { getClientIp: _getClientIp, ...missingResolver } = options;
    // @ts-expect-error The adapter cannot infer trusted server IP metadata from a Fetch request.
    expect(() => createArcjetSecurity(missingResolver)).toThrow("getClientIp");
    expect(sdk.create).not.toHaveBeenCalled();
  });

  test("retains and forwards properties required by combined rules and characteristics", async () => {
    const security = createArcjetSecurity({
      ...options,
      characteristics: ["userId"],
      rules: [
        tokenBucket({ mode: "LIVE", refillRate: 5, interval: 10, capacity: 10 }),
        validateEmail({ mode: "LIVE", deny: ["INVALID"] }),
      ],
    });
    type Properties = Parameters<typeof security.protect>[1];
    expectTypeOf<Properties>().toExtend<{
      requested: number;
      email: string;
      userId: string | number | boolean;
    }>();
    expectTypeOf<Parameters<typeof security.protect>["length"]>().toEqualTypeOf<2>();
    const properties = { requested: 2, email: "test@example.com", userId: "user-1" };
    await security.protect(new Request("https://example.com"), properties);
    expect(sdk.protect.mock.calls[0]![1]).toEqual({ ...properties, ipSrc: "8.8.8.8" });
    expect(properties).toEqual({ requested: 2, email: "test@example.com", userId: "user-1" });
  });
});
