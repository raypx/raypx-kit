# Vite Plugin Design

Status: phase 1 is implemented. The package exports `emailPreview()`, which
projects run with `vite dev`; the standalone CLI was dropped in favor of a small
Vite configuration. Phase 2, the worker-hosted module runner,
remains planned; see [Isolation and limits](#isolation-and-limits). The
[package guide](../../packages/email-preview/README.md) documents the shipped
behavior.

## Goals

- Preview React Email templates inside a project's existing Vite dev server,
  without a second process or port.
- Reuse Vite for module loading, file watching, tsconfig aliases and invalidation
  instead of maintaining a separate esbuild compiler, chokidar watcher and
  temporary-file worker pipeline.
- Render templates with the project's own React and dependencies.
- Serve projects without an application through a minimal Vite configuration
  instead of a separate command-line tool.
- Shrink the published package by replacing the server-rendered TanStack Start
  application with a prebuilt client-only TanStack Router interface.

Non-goals are unchanged: no sending, hosting, authentication or email-client
emulation, and no programmatic rendering API.

## Public interface

The package gains a root export alongside the existing binary:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { emailPreview } from "@raypx-kit/email-preview";

export default defineConfig({
  plugins: [emailPreview({ dir: "src/emails" })],
});
```

```ts
export interface EmailPreviewOptions {
  /** Template directory relative to the Vite root. Defaults to `emails`. */
  dir?: string;
  /** URL prefix for the interface and its API. Defaults to `/__email`. */
  base?: string;
  /** Rendering timeout in milliseconds. Defaults to 10000. */
  renderTimeoutMs?: number;
}

export function emailPreview(options?: EmailPreviewOptions): Plugin;
```

The plugin applies only to `vite dev` (`apply: "serve"`). Production builds are
unaffected and never include templates or the interface.

There is no separate command. A project that only owns templates adds a Vite
configuration with this plugin, `base: "/"` and, when templates use tsconfig
aliases, `resolve.tsconfigPaths: true`, then runs `vite dev`. A first iteration
shipped a `raypx-email dev` CLI wrapping such a server; it was removed because a
three-line configuration gives the same result without a second interface to
document and test.

Peer dependencies become `vite` (`^8`), `react` and `react-dom` (`^19`). Runtime
dependencies are `@react-email/render` and `prettier`. `esbuild`, `chokidar`,
TanStack Start, Nitro and srvx are removed; TanStack Router stays bundled into
the client interface.

## Architecture

```text
Vite dev server
├─ client / ssr environments      (the application, untouched)
├─ email_preview environment      (RunnableDevEnvironment, templates only)
│    └─ ModuleRunner → template → @react-email/render → HTML + text
└─ middleware at /__email
     ├─ /__email/                 prebuilt interface (index.html, assets/*)
     ├─ /__email/api/templates    discovery
     ├─ /__email/api/preview      render + Prettier formatting
     ├─ /__email/api/events       server-sent change events
     └─ /__email/static/*         assets from <dir>/static
```

### Dedicated environment

The plugin's `config` hook registers a template environment using
`createRunnableDevEnvironment`, named `email_preview` because Vite environment
names only allow letters, digits, `$` and `_`, with `resolve.dedupe` for `react` and `react-dom`
and the server consumer conditions. Templates therefore get their own module
graph: rendering never adds modules to, or invalidates, the application's `ssr`
environment, and the application's SSR entry is never imported.

Rendering imports the template through `environment.runner.import(path)`, reads
its default export and `PreviewProps`, and renders it with
`@react-email/render` imported through the same runner so that React is shared
between the template and the renderer. The resulting HTML is formatted with
Prettier in the plugin process; the original HTML is returned for preview,
copy and download.

### Discovery, invalidation and events

- Discovery keeps the current rules: `.tsx` and `.jsx` files, excluding hidden
  entries, names starting with `_` and the `static` directory. It scans on each
  request, because watcher events have proved unreliable for deletions under Bun.
- The plugin adds the template directory to `server.watcher`. Vite's module graph
  already tracks imported files, including those outside the directory.
- A watcher listener invalidates the `email_preview` module graph and its runner
  cache synchronously whenever a template, a loaded dependency or a tsconfig
  changes, then increments a revision. Vite's own invalidation is asynchronous,
  so relying on it alone let renders observe stale modules. The interface receives the revision over the existing
  server-sent events endpoint, so the prebuilt interface does not need the Vite
  client.
- A failed import or render is reported per template, as today; fixing the file
  triggers a new revision and the next request recovers.

### Isolation and limits

Templates are trusted local code, as today, but they now run in the dev server
process. Two layers keep a broken template from taking the server down:

1. Rendering is wrapped in a timeout. A render that does not settle is reported
   as `RENDER_TIMEOUT`. A synchronous infinite loop still
   blocks the process; this is the main regression compared with the current
   worker-per-render design.
2. Phase 2 moves the `email_preview` environment's module runner into a worker thread
   using a custom transport, which Vite's environment API supports. Termination
   then restores today's guarantee. This needs a prototype before it is promised.

### Interface

The interface becomes a static single-page application built with Vite and React,
bundling `@raypx-kit/ui` and `@raypx-kit/themes` as it does now. It keeps TanStack
Router on the client only: the existing validated search parameters (template,
view, viewport), history behavior and components move over unchanged, while
TanStack Start's server rendering, server routes and Nitro are removed. The router
uses `base` as its base path and a code-defined route tree, so no route generator
runs. The same views, keyboard behavior, themes and accessibility requirements
from `PRODUCT.md` apply. The built files ship in `dist/ui/` and are served by the
plugin's middleware with immutable caching for hashed assets.

### Host and file access

- The interface is served by the project's dev server and follows its
  `server.host` and `server.allowedHosts` settings. Vite's host check replaces the
  custom check the previous CLI implemented.
- Paths below `base` that the preview does not serve continue to the host server,
  so `base: "/"` does not hide Vite's own client or the application.
- Static files keep the contained-path checks and the `sandbox` content security
  policy. Previews stay in a sandboxed `iframe`.

## Package layout

```text
packages/email-preview/
  src/
    index.ts          emailPreview() plugin, the public export
    server/           discovery, rendering, formatting, events, static files
    ui/               interface source (built into dist/ui)
  dist/
    index.mjs  ui/
```

## Using it in Raypx

`@raypx/email` keeps its templates in `src/emails/`. It adds a `vite.config.ts`
with `emailPreview({ dir: "src/emails", base: "/" })` and a script that runs it, so
previewing does not depend on an application's dev server:

```json
{ "scripts": { "email:dev": "vp dev" } }
```

Alternatively, `apps/api` can add `emailPreview({ dir: "../../packages/email/src/emails" })`
to its Vite configuration to serve the interface at `http://localhost:3002/__email`.

## Migration

1. Prototype the template environment: import a template through its runner,
   confirm React deduplication, tsconfig aliases and invalidation under Bun and
   Node, and measure render latency against the current implementation.
2. Implement the plugin and server modules, reusing discovery, static-file and
   error code from `src/server/`.
3. Rebuild the interface as a client-only TanStack Router application and remove
   TanStack Start, Nitro, srvx, esbuild and chokidar.
4. Remove the standalone CLI; projects run the plugin with `vite dev`.
5. Update unit tests, the archive consumer contract (`vite dev` with the plugin
   under Bun and Node), browser scenarios, the license index and documentation.
6. Prototype the worker-hosted runner (phase 2) and adopt it if termination works
   reliably.

## Decisions

- Losing termination of synchronous infinite loops is accepted until phase 2.
- There is no standalone CLI; the project's own Vite configuration always applies.
- The Vite peer range is `^8.0.0`, matching Raypx and Raypx Kit's Vite+ core.
