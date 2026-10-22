/// <reference lib="dom" />
import {
  applySecurityHeaders,
  createSecurityHeaders,
  type SecurityHeadersOptions,
} from "@raypx-kit/security";

const options: SecurityHeadersOptions = {
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"], scriptSrc: ["'nonce-consumer'"] },
  },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false },
  crossOriginEmbedderPolicy: false,
};
const headers: Headers = createSecurityHeaders(options);
const response: Response = applySecurityHeaders(new Response(null, { headers }), options);
void response;

// @ts-expect-error Invalid COOP policies must not enter public configuration.
createSecurityHeaders({ crossOriginOpenerPolicy: { policy: "arbitrary" } });
// @ts-expect-error The helper accepts a Fetch Response, not a framework response-like object.
applySecurityHeaders({ status: 200, headers: new Headers() });
