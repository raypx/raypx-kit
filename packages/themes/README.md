# @raypx-kit/themes

Neutral semantic tokens, a first-paint theme script, and React 19 theme state.
The package has no application reset, picker, icon, Tailwind runtime, or product dependencies.

## Install and styles

```sh
bun add @raypx-kit/themes react
```

For plain CSS, import `@raypx-kit/themes/styles.css`. It defines semantic custom
properties such as `--background`, `--foreground`, `--primary`, `--destructive-text`,
`--radius`, and the complete chart/sidebar palette.

For Tailwind 4, import the engine once in your application, then the mapping:

```css
@import "tailwindcss";
@import "@raypx-kit/themes/tailwind.css";
```

The mapping imports the base tokens and exposes `bg-background`, `text-foreground`,
`text-destructive-text`, radius, shadow, and other semantic utilities. It does not
import Tailwind itself. Applications may override the custom properties after the
package import. No body, heading, control, or font reset is included.

## React and first paint

```tsx
import { ThemeProvider, ThemeScript, useTheme } from "@raypx-kit/themes";

function Document({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <ThemeScript storageKey="my-app-theme" />
      </head>
      <body>
        <ThemeProvider storageKey="my-app-theme">{children}</ThemeProvider>
      </body>
    </html>
  );
}

function Toggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{theme}</button>
  );
}
```

Use the same `initialTheme` and `storageKey` for the script and provider.
`initialTheme` defaults to `system` and supplies the server-rendered snapshot and
the fallback when no valid persisted preference exists. Hydration starts from
that server snapshot, then reconciles local preferences. `storageKey={false}`
keeps changes in memory while still allowing the first-paint script to apply an
explicit or system theme. `ThemeScript` accepts a CSP `nonce`.

The preference is `light`, `dark`, or `system`; `resolvedTheme` is always `light`
or `dark`. Valid localStorage wins over the cookie mirror, then `initialTheme`.
The provider follows system changes, handles cross-tab storage events, and
removes its subscriptions on unmount. Storage failures do not prevent switching.
`readStoredTheme(fallback?, storageKey?)` and `storeTheme(theme, storageKey?)` are
available for non-React persistence; use `setTheme` to update a mounted provider.
Cookie persistence uses a URL-encoded key, `Path=/`, a one-year lifetime and
`SameSite=Lax`.

The script/provider set `.light` or `.dark`, `data-theme`, `color-scheme`, and one
`theme-color` meta tag. Explicit root classes take precedence over the CSS system
media fallback. Render the script before the application styles paint. Do not
render a React-owned `theme-color` meta tag: React 19 may duplicate a tag whose
content the first-paint script changed. `themeMeta` supplies a safe `color-scheme`
meta descriptor instead.

## React-free entries

```ts
import { readThemeCookie, themeTokens, type UserTheme } from "@raypx-kit/themes/config";
import { createThemeScript } from "@raypx-kit/themes/script";

const preference: UserTheme = readThemeCookie(request.headers.get("cookie")) ?? "system";
const inlineScript = createThemeScript({ initialTheme: preference });
```

`/config` exports `themeTokens`, `ThemeToken`, `themeColors`, `themeMeta`,
`THEME_STORAGE_KEY`, `UserTheme`, `AppTheme`, `parseTheme`, and `readThemeCookie`.
`/script` exports `createThemeScript` and `ThemeScriptOptions`. Neither entry
requires React or browser globals. Interpolated script data escapes HTML-closing
characters; arbitrary JavaScript source expressions are not accepted.

## Maintenance

`src/tokens.ts` is the single source for both CSS artifacts. Run
`bun run generate:theme` after token changes; `check` and `build` reject stale
generated files. Node 22.21 or newer is supported. React is an optional peer for
the pure entries and is required when importing the root React entry.

## Licenses

[LICENSE](./LICENSE) contains this package's Apache-2.0 terms, and
[NOTICE](./NOTICE) retains the adapted source's provenance. Both ship in the npm
archive. The React peer remains an external dependency with its own license file.

The index below records installed direct runtime dependencies and peers, with
links to their licenses. Their full texts are not duplicated here. Run
`bun run licenses:update` from the repository root after dependency changes;
`bun run licenses:check` rejects a stale index.

<!-- BEGIN GENERATED DEPENDENCY LICENSE INDEX -->

| Package | Installed version | License | License text                                      |
| ------- | ----------------- | ------- | ------------------------------------------------- |
| react   | 19.3.1            | MIT     | [LICENSE](https://unpkg.com/react@19.3.1/LICENSE) |

<!-- END GENERATED DEPENDENCY LICENSE INDEX -->
