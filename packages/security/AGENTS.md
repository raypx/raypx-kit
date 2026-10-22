# @raypx-kit/security

Own reusable Fetch response security headers and optional Arcjet request protection.
Applications own environment loading, secrets, trusted client IPs, detection rules,
authentication, authorization and routing. No global clients or network at import.

The root entry uses Nosecone and must load without Arcjet. The `/arcjet` entry is
Node/Bun server code using the optional external `@arcjet/node` peer. Keep both
SDKs external. Follow their `>=22.21.0 <23 || >=24.5.0` Node engine range;
Node 23 and Node 24 before 24.5.0 are outside this package's support contract.
Do not silently allow missing configuration or trust client-supplied IP headers.
Request failures must have an explicit, documented policy and structured results.

Header helpers preserve ordinary response headers, cookies, status and streaming
bodies. CSP, HSTS and COEP are explicit application choices. Do not claim headers
replace authentication, CSRF controls, request detection or network DDoS protection.

Keep the package's Apache license separate from the README dependency license
index. Reference upstream designs and dependencies without copying their source.
All tests belong in `tests/`; archive consumers also cover the root without the
optional SDK. Use mocked request protection; tests never need credentials or live
Arcjet traffic. Run focused tests and type checks, then root `bun run verify`.
