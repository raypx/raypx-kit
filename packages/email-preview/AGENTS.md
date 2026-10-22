# @raypx-kit/email-preview

## Purpose

Provide a local React Email preview CLI with a prebuilt TanStack Start application.
The public interface is `raypx-email dev`; package metadata is the only export.

## Ownership

- `src/cli.ts` owns option parsing, loopback listening and process lifecycle.
- `src/server/` discovers and watches consumer templates and renders HTML/text.
- `src/http/` integrates the runtime with the embedded server.
- `src/app/` owns the TanStack Start interface and HTTP file routes.
- `build/` collects complete third-party license and notice texts from the actual
  bundled module graphs into `dist/THIRD_PARTY_LICENSES.txt`. This generated file
  stays out of Git and ships with the prebuilt application.
- `examples/` contains original templates and static assets for local exploration.
- All tests and archive consumer contracts live under `tests/`.

## Constraints

- Keep the package independent of Raypx product schemas, environment and scripts.
- Build the UI before packaging; never build it in the consumer's installation.
- Keep `LICENSE` limited to the package's Apache license. Maintain the README's
  direct runtime and peer dependency index through the root `licenses:update` and
  `licenses:check` commands; ordinary external dependencies carry their own full
  license texts. Build notices use the root Turbo `dist/` cache rule and must not
  rewrite `LICENSE`.
- Resolve packaged assets from the package location and templates from the caller's
  working directory. Never write caches or generated files into the installed package.
- Use the consumer's React and template dependencies when evaluating templates;
  keep them separate from the prebuilt UI's module graph.
- Bind to `127.0.0.1`. Template evaluation is for trusted local code.
- Shut down HTTP streams, file watchers and rendering workers on exit.
- Keep email delivery, remote hosting and a programmatic public API outside this
  initial package. Document supported behavior in the English README.

## Verification

Run focused package tests and type checks first, then the root `verify` gate.
The installed archive contract must launch the real bin and load the embedded
application, render consumer templates, observe changes and exit cleanly under
both Bun and Node. Source-only tests cannot replace this packaging contract.
