import { describe, expect, it } from "vite-plus/test";
import {
  applySecurityHeaders,
  createSecurityHeaders,
  type SecurityHeadersOptions,
} from "../src/index.js";

describe("security headers", () => {
  it("has stable defaults without implicit CSP, transport or embedder policy", () => {
    expect(Object.fromEntries(createSecurityHeaders())).toEqual({
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-resource-policy": "same-origin",
      "origin-agent-cluster": "?1",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-dns-prefetch-control": "off",
      "x-download-options": "noopen",
      "x-frame-options": "SAMEORIGIN",
      "x-permitted-cross-domain-policies": "none",
      "x-xss-protection": "0",
    });
    expect(
      createSecurityHeaders({
        contentSecurityPolicy: undefined,
        strictTransportSecurity: undefined,
        crossOriginEmbedderPolicy: undefined,
      }).has("content-security-policy"),
    ).toBe(false);
  });

  it("enables HTTPS and cross-origin policies only from caller configuration", () => {
    const headers = createSecurityHeaders({
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false, preload: false },
      crossOriginEmbedderPolicy: { policy: "credentialless" },
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      xFrameOptions: false,
    });
    expect(headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(headers.get("cross-origin-embedder-policy")).toBe("credentialless");
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");
    expect(headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(headers.has("x-frame-options")).toBe(false);
  });

  it("supports explicit strict CSP defaults and replacement directives with a caller nonce", () => {
    const strict = createSecurityHeaders({ contentSecurityPolicy: true }).get(
      "content-security-policy",
    );
    expect(strict).toContain("object-src 'none';");
    expect(strict).toContain("script-src 'self';");
    expect(strict).not.toContain("unsafe-inline");
    const options: SecurityHeadersOptions = {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'nonce-caller-provided'"],
          upgradeInsecureRequests: true,
        },
      },
    };
    const custom = createSecurityHeaders(options).get("content-security-policy");
    expect(custom).toBe(
      "default-src 'self'; script-src 'nonce-caller-provided'; upgrade-insecure-requests;",
    );
    expect(custom).not.toContain("object-src");
    expect(options.contentSecurityPolicy).toEqual({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'nonce-caller-provided'"],
        upgradeInsecureRequests: true,
      },
    });
  });

  it("evaluates dynamic directives per call and propagates invalid policy errors", () => {
    let calls = 0;
    const options: SecurityHeadersOptions = {
      contentSecurityPolicy: { directives: { scriptSrc: [() => `'nonce-request-${++calls}'`] } },
    };
    expect(createSecurityHeaders(options).get("content-security-policy")).toBe(
      "script-src 'nonce-request-1';",
    );
    expect(createSecurityHeaders(options).get("content-security-policy")).toBe(
      "script-src 'nonce-request-2';",
    );
    expect(() => createSecurityHeaders({ strictTransportSecurity: { maxAge: -1 } })).toThrow();
    expect(() =>
      createSecurityHeaders({
        contentSecurityPolicy: { directives: { scriptSrc: ["self"] } },
      } as unknown as SecurityHeadersOptions),
    ).toThrow("must be quoted");
  });

  it("creates independent headers objects", () => {
    const first = createSecurityHeaders();
    first.set("x-frame-options", "DENY");
    expect(createSecurityHeaders().get("x-frame-options")).toBe("SAMEORIGIN");
  });
});

describe("applying security headers", () => {
  it("preserves ordinary headers, separate cookies, status and an unconsumed stream", async () => {
    const headers = new Headers({
      "content-type": "text/plain",
      "x-request-id": "request-1",
      "cache-control": "private",
      "x-frame-options": "DENY",
    });
    const cookies = [
      "session=one; HttpOnly; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT",
      "preference=two; SameSite=Lax; Path=/",
    ];
    for (const cookie of cookies) headers.append("set-cookie", cookie);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    const response = new Response(stream, { status: 202, statusText: "Queued", headers });
    const secured = applySecurityHeaders(response);
    expect(secured).not.toBe(response);
    expect(secured.body).toBe(response.body);
    expect(response.bodyUsed).toBe(false);
    expect(secured.status).toBe(202);
    expect(secured.statusText).toBe("Queued");
    expect(secured.headers.get("content-type")).toBe("text/plain");
    expect(secured.headers.get("cache-control")).toBe("private");
    expect(secured.headers.get("x-request-id")).toBe("request-1");
    expect(secured.headers.getSetCookie()).toEqual(cookies);
    expect(secured.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.has("x-content-type-options")).toBe(false);
    controller.enqueue(new TextEncoder().encode("streamed after wrapping"));
    controller.close();
    expect(await secured.text()).toBe("streamed after wrapping");
  });

  it("keeps existing policies when their generation is disabled and replaces enabled policies", () => {
    const response = new Response(null, {
      status: 204,
      headers: {
        "content-security-policy": "default-src 'none'",
        "strict-transport-security": "max-age=100",
        "x-frame-options": "DENY",
      },
    });
    const defaulted = applySecurityHeaders(response, { xFrameOptions: false });
    expect(defaulted.body).toBeNull();
    expect(defaulted.status).toBe(204);
    expect(defaulted.headers.get("content-security-policy")).toBe("default-src 'none'");
    expect(defaulted.headers.get("strict-transport-security")).toBe("max-age=100");
    expect(defaulted.headers.get("x-frame-options")).toBe("DENY");
    const replaced = applySecurityHeaders(response, {
      contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
    });
    expect(replaced.headers.get("content-security-policy")).toBe("default-src 'self';");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'");
  });

  it("accepts immutable redirect headers without mutating the original response", () => {
    const response = Response.redirect("https://example.test/next", 307);
    const secured = applySecurityHeaders(response);
    expect(secured.status).toBe(307);
    expect(secured.headers.get("location")).toBe("https://example.test/next");
    expect(secured.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.has("x-content-type-options")).toBe(false);
  });

  it("rejects consumed and locked bodies without reading or releasing the input stream", async () => {
    const consumed = new Response("read");
    await consumed.text();
    expect(() => applySecurityHeaders(consumed)).toThrow("consumed or locked");
    const locked = new Response("locked");
    const reader = locked.body!.getReader();
    expect(() => applySecurityHeaders(locked)).toThrow("consumed or locked");
    expect(locked.body!.locked).toBe(true);
    const untouched = await reader.read();
    expect(untouched.done).toBe(false);
    expect(new TextDecoder().decode(untouched.value)).toBe("locked");
    reader.releaseLock();
  });
});
