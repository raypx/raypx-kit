# @raypx-kit/email-preview

A preview workspace for React Email templates, added to a Vite dev server as a
plugin. Browse templates, inspect desktop
and mobile layouts, and copy or download the rendered HTML and plain text. Saving
a template, imported helper or local asset updates the preview automatically.

## Install

Install the preview and its peers in the project that owns your templates:

```sh
bun add -d @raypx-kit/email-preview@0.0.0-alpha.0 vite@^8
bun add react@^19 react-dom@^19 @react-email/components
```

It supports Node 22.21+ and Bun. The interface is prebuilt into the package; your
project does not build it or configure Tailwind for it.

## Use with Vite

Add the plugin to the Vite configuration of an existing app:

```ts
import { defineConfig } from "vite";
import { emailPreview } from "@raypx-kit/email-preview";

export default defineConfig({
  plugins: [emailPreview({ dir: "src/emails" })],
});
```

Run `vite` and open `/__email/` on the dev server, for example
`http://localhost:5173/__email/`. Options:

| Option            | Default    | Description                                                |
| ----------------- | ---------- | ---------------------------------------------------------- |
| `dir`             | `emails`   | Template directory, relative to the Vite root or absolute. |
| `base`            | `/__email` | URL prefix for the interface and its API.                  |
| `renderTimeoutMs` | `10000`    | Reports renders that do not settle within this time.       |

The plugin applies to `vite dev` only; production builds never include templates
or the interface. Templates are evaluated in a dedicated Vite environment with its
own module graph, so previews do not load into or invalidate the application's
server rendering. They use the project's React, dependencies and Vite resolution,
including its aliases: enable `resolve.tsconfigPaths` in the host configuration when
templates import tsconfig path aliases. The interface follows the dev server's
`server.host` and `server.allowedHosts`. Paths below `base` that the preview does
not serve continue to the host app, so `base: "/"` suits a dev server dedicated to
previews.

## Preview without an app

A project that only owns templates needs a small Vite configuration of its own.
`base: "/"` serves the preview at the server root:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { emailPreview } from "@raypx-kit/email-preview";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { host: "127.0.0.1", port: 3001 },
  plugins: [emailPreview({ dir: "emails", base: "/" })],
});
```

```json
{
  "scripts": {
    "email:dev": "vite dev"
  }
}
```

Run `bun run email:dev` and open `http://127.0.0.1:3001`. Vite reports an occupied
port or invalid configuration as usual; a missing template directory shows an
empty library until you create it.

## Template contract

Export a React component as the default export of a `.tsx` or `.jsx` file. Attach
sample data to that component's `PreviewProps` property:

```tsx
import { Body, Container, Heading, Html, Text } from "@react-email/components";

type WelcomeProps = { name: string };

export default function Welcome({ name }: WelcomeProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Welcome, {name}</Heading>
          <Text>Your workspace is ready.</Text>
        </Container>
      </Body>
    </Html>
  );
}

Welcome.PreviewProps = { name: "Alex" } satisfies WelcomeProps;
```

Templates without `PreviewProps` receive an empty props object. Keep imports,
components and data in your own project. React 19 and React DOM 19 are peer
dependencies and must be compatible with each other. If you install them while the
preview runs, the next render picks them up. Imported packages resolve from the
consumer project.

Nested directories appear in the template list. Hidden entries, names starting
with `_`, and the `static` directory are excluded from template discovery:

```text
emails/
  welcome.tsx
  account/
    password-reset.jsx
  _components/
    footer.tsx
  static/
    logo.svg
```

Serve local assets from `emails/static` and reference them as `/static/logo.svg`.
These URLs work in the local preview, including below a plugin prefix such as
`/__email/`; copied and downloaded HTML keeps the original URLs. Before sending exported email HTML through
your own delivery service, use absolute publicly accessible asset URLs.

## Preview workflow

- Select a template from the searchable list. The selection stays in the URL so
  you can return to a specific preview.
- Switch between desktop and mobile widths to inspect responsive email markup.
- Choose light, dark or system appearance. The preference persists between visits.
- Open HTML or plain text to inspect, copy or download the rendered content.
- HTML is indented with Prettier and shown with line numbers. Formatting affects
  the source view only; the visual preview, clipboard and downloads keep the
  original rendered HTML.

- Save a template or imported source file to refresh its output. Creating or
  removing templates also updates the list.
- Fix compilation or rendering errors in your editor; the preview recovers when
  you save. Errors do not prevent browsing other templates.

The interface is a client-side TanStack Router application using the Base UI/shadcn
primitives from `@raypx-kit/ui` and theme tokens and preferences from
`@raypx-kit/themes`. These are prebuilt into the package; template projects do not
install these workspace packages.

The preview executes trusted local template code with the permissions of the
dev server process. A render that never settles is reported after
`renderTimeoutMs`, but a synchronous infinite loop blocks the dev server until you
fix the template and restart it. It is a development tool without deployment,
authentication or email delivery commands. Browser preview widths help inspect
layouts; they do not emulate individual email clients.

## Package interface and development

The public interface is the `emailPreview()` Vite plugin exported from the package
root. There is no command-line tool or public JavaScript rendering API. The
[Vite plugin design](../../docs/email-preview/vite-plugin.md) records the
architecture and its remaining isolation work.

Repository examples live in [examples](examples), including a TSX welcome email,
a JSX password reset email, a local SVG asset and the `vite.config.ts` that previews
them. From the repository root:

```sh
bun run --cwd packages/email-preview dev
```

Tests cover discovery, rendering, live updates and HTTP behavior. The repository's
archive checks install the actual package outside the workspace and run `vite dev`
with the plugin under Bun and Node, including consumer dependencies and shared
imports.
See the [development guide](../../docs/development/README.md) for repository checks.

## Licenses

[LICENSE](LICENSE) contains this package's Apache-2.0 terms. The prebuilt application
includes third-party code, including React, TanStack Router and the shared UI
and theme packages. Its complete licenses, copyright statements and source notices
are generated from build inputs into `dist/THIRD_PARTY_LICENSES.txt` and included in
the npm archive. Generated build notices are not committed to Git.

The direct external runtime dependencies below remain separate npm packages with
their own license files. This index records installed versions and links to their
licenses without copying the texts. Transitive dependencies retain their notices
in their respective packages. Run `bun run licenses:update` after dependency
changes; `bun run licenses:check` checks this index without requiring build output.

<!-- BEGIN GENERATED DEPENDENCY LICENSE INDEX -->

| Package             | Installed version | License | License text                                                            |
| ------------------- | ----------------- | ------- | ----------------------------------------------------------------------- |
| @react-email/render | 2.1.1             | MIT     | [license.md](https://unpkg.com/@react-email/render@2.1.1/license.md)    |
| prettier            | 3.9.10            | MIT     | [LICENSE](https://unpkg.com/prettier@3.9.10/LICENSE)                    |
| react               | 19.3.1            | MIT     | [LICENSE](https://unpkg.com/react@19.3.1/LICENSE)                       |
| react-dom           | 19.3.1            | MIT     | [LICENSE](https://unpkg.com/react-dom@19.3.1/LICENSE)                   |
| vite                | 1.3.0             | MIT     | [LICENSE](https://unpkg.com/@voidzero-dev/vite-plus-core@1.3.0/LICENSE) |

<!-- END GENERATED DEPENDENCY LICENSE INDEX -->

## Browser E2E

The built plugin in a Vite server, navigation, sandbox previews, source actions and live template recovery.

Run `bun run test:e2e:install` once at the repository root, then
`bun run --cwd packages/email-preview test:e2e`. The package owns its scenarios in
`e2e/`; see the [browser test guide](../../docs/development/README.md#browser-e2e-by-workspace)
for project selection, reports and CI behavior.
