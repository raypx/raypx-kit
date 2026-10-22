# @raypx-kit/email-preview

A local preview workspace for React Email templates, built with TanStack Start.
Browse templates, inspect desktop and mobile layouts, and copy or download the
rendered HTML and plain text. Saving a template, imported helper or local asset
updates the preview automatically.

## Install and run

Install the preview tool in the project that owns your templates:

```sh
bun add -d @raypx-kit/email-preview@0.0.0-alpha.0
bun add react@^19 react-dom@^19 @react-email/components
bunx raypx-email dev --dir ./emails --port 3001
```

Open `http://127.0.0.1:3001`. The CLI defaults to `./emails`, port `3001`, and
the local loopback interface. It supports Node 22.21+ and Bun. The installed
package includes the built preview UI; your project does not need TanStack Start,
Vite or a build step for that UI.

Add a project script for repeated use:

```json
{
  "scripts": {
    "email:dev": "raypx-email dev --dir ./emails"
  }
}
```

Paths resolve from the current working directory. Absolute directories and paths
containing spaces are supported. An occupied port or a missing directory produces
an error instead of silently choosing another location. `raypx-email --help` and
`raypx-email dev --help` describe the supported options.

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
components and data in your own project. React 19 and React DOM must be compatible
with each other; imported packages resolve from the consumer project. The runtime
supports relative imports and TypeScript path aliases from the project's tsconfig.

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
These URLs work in the local preview. Before sending exported email HTML through
your own delivery service, use absolute publicly accessible asset URLs.

## Preview workflow

- Select a template from the searchable list. The selection stays in the URL so
  you can return to a specific preview.
- Switch between desktop and mobile widths to inspect responsive email markup.
- Choose light, dark or system appearance. The preference persists between visits.
- Open HTML or plain text to inspect, copy or download the rendered content.
- HTML includes readable indentation, line numbers and Shiki syntax highlighting
  in light and dark themes. Formatting affects the source view only; the visual
  preview, clipboard and downloads keep the original rendered HTML.

- Save a template or imported source file to refresh its output. Creating or
  removing templates also updates the list.
- Fix compilation or rendering errors in your editor; the preview recovers when
  you save. Errors do not prevent browsing other templates.

The interface uses the Base UI/shadcn primitives from `@raypx-kit/ui` and theme
tokens and preferences from `@raypx-kit/themes`. These are prebuilt into the app;
template projects do not configure Tailwind or install these workspace packages.

The preview executes trusted local template code with the permissions of the
running process. It is a development tool bound to `127.0.0.1`, without deployment,
authentication or email delivery commands. Browser preview widths help inspect
layouts; they do not emulate individual email clients.

## Package interface and development

The public interface is the `raypx-email` CLI. `@raypx-kit/email-preview/package.json`
exports package metadata; there is no public JavaScript rendering API.

Repository examples live in [examples](examples), including a TSX welcome email,
a JSX password reset email and a local SVG asset. From the repository root after
building the package:

```sh
bun packages/email-preview/dist/cli.mjs dev --dir packages/email-preview/examples
```

Tests cover discovery, rendering, live updates and HTTP behavior. The repository's
archive checks install the actual package outside the workspace and exercise the
CLI with both Bun and Node, including consumer dependencies and shared imports.
See the [development guide](../../docs/development/README.md) for repository checks.

## Licenses

[LICENSE](LICENSE) contains this package's Apache-2.0 terms. The prebuilt application
includes third-party code, including React, TanStack Start, Shiki and the shared UI
and theme packages. Its complete licenses, copyright statements and source notices
are generated from build inputs into `dist/THIRD_PARTY_LICENSES.txt` and included in
the npm archive. Generated build notices are not committed to Git.

The direct external runtime dependencies below remain separate npm packages with
their own license files. This index records installed versions and links to their
licenses without copying the texts. Transitive dependencies retain their notices
in their respective packages. Run `bun run licenses:update` after dependency
changes; `bun run licenses:check` checks this index without requiring build output.

<!-- BEGIN GENERATED DEPENDENCY LICENSE INDEX -->

| Package             | Installed version | License | License text                                                         |
| ------------------- | ----------------- | ------- | -------------------------------------------------------------------- |
| @react-email/render | 2.1.1             | MIT     | [license.md](https://unpkg.com/@react-email/render@2.1.1/license.md) |
| chokidar            | 5.0.0             | MIT     | [LICENSE](https://unpkg.com/chokidar@5.0.0/LICENSE)                  |
| esbuild             | 0.28.2            | MIT     | [LICENSE.md](https://unpkg.com/esbuild@0.28.2/LICENSE.md)            |

<!-- END GENERATED DEPENDENCY LICENSE INDEX -->
