import {
  ArcjetAllowDecision,
  ArcjetChallengeDecision,
  ArcjetReason,
  sensitiveInfo,
  shield,
} from "@arcjet/node";
import { describe, expect, test, vi } from "vite-plus/test";
import { createArcjetSecurity } from "../src/arcjet.js";

function transport() {
  return {
    client: {
      decide: vi.fn(
        async () => new ArcjetAllowDecision({ ttl: 0, reason: new ArcjetReason(), results: [] }),
      ),
      report: vi.fn(),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe("real Arcjet SDK with an offline transport", () => {
  test.each(["allow", "deny"] as const)(
    "applies %s policy when the SDK hides a failed body inspection behind a remote allow",
    async (onError) => {
      const mock = transport();
      const security = createArcjetSecurity({
        key: "ajkey_test",
        rules: [sensitiveInfo({ mode: "LIVE", deny: ["EMAIL"] })],
        onError,
        getClientIp: () => "10.0.0.5",
        ...mock,
      });
      const request = new Request("https://example.com/signup", {
        method: "POST",
        body: "test@example.com",
        headers: { "x-forwarded-for": "1.1.1.1", "x-arcjet-ip": "1.1.1.1" },
      });
      const result = await security.protect(request);
      expect(mock.client.decide).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ status: "error", allowed: onError === "allow" });
      if (result.status === "error") expect(result.error.message).toContain("sensitiveInfoValue");
      expect(request.bodyUsed).toBe(false);
      expect(await request.text()).toBe("test@example.com");
    },
  );

  test.each(["LIVE", "DRY_RUN"] as const)(
    "preserves %s decisions when sensitive text is supplied explicitly",
    async (mode) => {
      const mock = transport();
      const security = createArcjetSecurity({
        key: "ajkey_test",
        rules: [sensitiveInfo({ mode, deny: ["EMAIL"] })],
        onError: "deny",
        getClientIp: () => "10.0.0.5",
        ...mock,
      });
      const result = await security.protect(new Request("https://example.com/signup"), {
        sensitiveInfoValue: "Please contact test@example.com",
      });
      expect(mock.log.error).not.toHaveBeenCalled();
      if (mode === "LIVE") {
        expect(result).toMatchObject({ status: "deny", allowed: false });
        expect(mock.client.decide).not.toHaveBeenCalled();
        expect(mock.client.report).toHaveBeenCalledOnce();
      } else {
        expect(result).toMatchObject({ status: "allow", allowed: true });
        expect(mock.client.decide).toHaveBeenCalledOnce();
        expect(mock.log.warn).toHaveBeenCalledWith(
          expect.stringContaining("Dry run mode is enabled"),
          "SENSITIVE_INFO",
        );
      }
    },
  );

  test("does not turn a real SDK challenge into an allowed result", async () => {
    const mock = transport();
    const decision = new ArcjetChallengeDecision({
      ttl: 0,
      reason: new ArcjetReason(),
      results: [],
    });
    const security = createArcjetSecurity({
      key: "ajkey_test",
      rules: [shield({ mode: "LIVE" })],
      onError: "allow",
      getClientIp: () => "10.0.0.5",
      log: mock.log,
      client: { ...mock.client, decide: vi.fn(async () => decision) },
    });
    expect(await security.protect(new Request("https://example.com"))).toEqual({
      status: "deny",
      allowed: false,
      decision,
    });
  });
});
