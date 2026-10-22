import { nosecone, type Options } from "nosecone";

/** Nosecone options with CSP, HSTS and COEP disabled unless explicitly configured. */
export type SecurityHeadersOptions = Options;

/**
 * Create fresh security headers without reading environment variables.
 * CSP directives replace Nosecone's defaults; they are not merged with them.
 */
export function createSecurityHeaders(options: SecurityHeadersOptions = {}): Headers {
  return nosecone({
    ...options,
    contentSecurityPolicy: options.contentSecurityPolicy ?? false,
    strictTransportSecurity: options.strictTransportSecurity ?? false,
    crossOriginEmbedderPolicy: options.crossOriginEmbedderPolicy ?? false,
  });
}

/**
 * Return a standard Response with generated security headers replacing matching headers.
 * Other headers, including separate Set-Cookie values, remain intact. Disabled options
 * do not remove existing headers. The body stream is shared, never buffered or cloned;
 * consume the returned response instead of the input. Response subclass metadata is not copied.
 */
export function applySecurityHeaders(
  response: Response,
  options: SecurityHeadersOptions = {},
): Response {
  if (response.bodyUsed || response.body?.locked)
    throw new TypeError("Cannot apply security headers to a consumed or locked response body.");
  const headers = new Headers(response.headers);
  for (const [name, value] of createSecurityHeaders(options)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
