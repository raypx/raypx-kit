# @raypx-kit/email-preview

## Purpose

Provide a React Email preview as a Vite dev-server plugin with a prebuilt
client-side interface. The root `emailPreview()` export is the public interface;
projects run it with `vite dev`.

## Ownership

- `src/index.ts` exports the plugin.
- `src/server/` owns the plugin, the dedicated `email_preview` Vite environment,
  template discovery, rendering, formatting and the HTTP middleware.
- `src/ui/` owns the client-side TanStack Router interface, built into `dist/ui/`.
- `build/` collects complete third-party license and notice texts from the actual
  bundled module graphs into `dist/THIRD_PARTY_LICENSES.txt`. This generated file
  stays out of Git and ships with the prebuilt application.
- `examples/` contains original templates, static assets and the Vite configuration
  that previews them.
- Unit tests and archive consumer contracts live under `tests/`; browser scenarios live in sibling `e2e/`.

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
  keep them separate from the prebuilt UI's module graph and from the host
  application's `ssr` environment.
- Template evaluation is for trusted local code; the design document tracks moving
  the module runner into a worker so stuck templates can be terminated.
- Apply the plugin only to `vite dev`. Shut down event streams and watcher
  listeners when the server closes.
- Vite's watcher drops a second change to one file within 50 ms. The runtime compares
  each changed file again after that window instead of trusting every save to arrive.
- Keep email delivery, remote hosting and a programmatic rendering API outside this
  package. Document supported behavior in the English README.

## Verification

Run focused package tests and type checks first, then the root `verify` gate.
The installed archive contract must run the consumer's real `vite dev` with the
plugin, load the prebuilt interface, render consumer templates, observe changes and
exit cleanly under both Bun and Node. Source-only tests cannot replace this packaging contract.
