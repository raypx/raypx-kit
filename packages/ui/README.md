# @raypx-kit/ui

Accessible React primitives built with Base UI, shadcn `base-nova`, Lucide and
Tailwind CSS 4. This package contains reusable controls; applications own page
layout, form validation and business behavior.

## Install

> Not yet published to npm. The package is private for now and is bundled into
> Email Preview's prebuilt interface; the install instructions apply once it is
> released.

```sh
bun add @raypx-kit/ui react react-dom tailwindcss
```

Requires React 19, React DOM 19 and Tailwind CSS 4. Package tooling supports Node
22.21 and newer. React and React DOM remain consumer-owned peers and are never
bundled. The package is ESM-only.

Import the Tailwind engine once in your application's CSS, followed by the UI
entry. Configure Tailwind's framework integration in the consuming application.

```css
@import "tailwindcss";
@import "@raypx-kit/ui/styles.css";
```

The UI entry loads `@raypx-kit/themes/tailwind.css` and `tw-animate-css`. Its
`@source "./dist"` declaration includes published component and shared-chunk
class names even though Tailwind normally ignores `node_modules`. It does not
import another Tailwind engine or add application-wide layout rules.

Theme tokens and light/dark behavior belong to
[`@raypx-kit/themes`](../themes/README.md). Supply application-specific theme
choices through that package rather than maintaining a second token set here.

## Components

Use explicit subpaths to keep component ownership visible:

```tsx
import { Button } from "@raypx-kit/ui/components/ui/button";
import { Input } from "@raypx-kit/ui/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@raypx-kit/ui/components/ui/tabs";

export function EmailOutput() {
  return (
    <Tabs defaultValue="preview">
      <TabsList aria-label="Email output">
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="html">HTML</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">Email preview</TabsContent>
      <TabsContent value="html">Rendered source</TabsContent>
      <label htmlFor="recipient">Recipient</label>
      <Input id="recipient" type="email" />
      <Button variant="outline">Copy HTML</Button>
    </Tabs>
  );
}
```

| Export                                      | Included primitives                                                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@raypx-kit/ui/components/ui/button`        | `Button`, `buttonVariants`, `ButtonProps`                                                                                                                      |
| `@raypx-kit/ui/components/ui/input`         | `Input`                                                                                                                                                        |
| `@raypx-kit/ui/components/ui/tabs`          | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `tabsListVariants`                                                                                           |
| `@raypx-kit/ui/components/ui/badge`         | `Badge`, `badgeVariants`, `BadgeProps`, `BadgeVariant`                                                                                                         |
| `@raypx-kit/ui/components/ui/dialog`        | `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose` |
| `@raypx-kit/ui/components/ui/skeleton`      | `Skeleton`                                                                                                                                                     |
| `@raypx-kit/ui/components/ui/native-select` | `NativeSelect`, `NativeSelectOption`, `NativeSelectOptGroup`                                                                                                   |
| `@raypx-kit/ui/lib/utils`                   | `cn`                                                                                                                                                           |
| `@raypx-kit/ui`                             | All JavaScript exports above                                                                                                                                   |

Components accept their underlying Base UI or native element props, including
React 19 refs. Tabs support controlled `value`/`onValueChange` and uncontrolled
`defaultValue`. `Button` defaults to `type="button"`; request `type="submit"`
explicitly in a form. Button variants are `default`, `outline`, `secondary`,
`ghost`, `destructive` and `link`; sizes are `default`, `xs`, `sm`, `lg`, `icon`,
`icon-xs`, `icon-sm` and `icon-lg`.

Base UI composition uses `render`, for example:

```tsx
import { Button } from "@raypx-kit/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@raypx-kit/ui/components/ui/dialog";

export function Preferences() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Open preferences</DialogTrigger>
      <DialogContent>
        <DialogTitle>Preferences</DialogTitle>
        <DialogDescription>Choose how this application behaves.</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
```

`DialogContent` includes an accessible close button by default. Set
`showCloseButton={false}` only when providing another labelled dismissal control.
Supply accessible names for inputs, native selects, tab lists and icon buttons.
Skeletons should be decorative inside an independently labelled loading region.
The package preserves Base UI keyboard, focus and disabled behavior and reduces
component motion when requested by the operating system.

`NativeSelect` accepts `size="sm"` or `size="default"`; its `className` styles the
wrapper. Options retain native browser semantics. `cn` merges conditional class
values and resolves Tailwind conflicts so caller utilities can override defaults.

The published component entrypoints and root barrel are client boundaries and
can be server rendered before hydration. Server-side utility code should import
`cn` from `@raypx-kit/ui/lib/utils`, which has no client directive.

## Maintaining the shadcn source

The repository's `components.json` uses `base-nova`, CSS variables, the Neutral
palette, Lucide, and local `#components` / `#lib` aliases. Generated components
belong under `src/components/ui/`; update `shadcn-components.json`, explicit
exports and the independent package contract when adding one. Consumers import
the published library; running shadcn in an application does not modify an
installed package.

See [source provenance](NOTICE.md) and [complete third-party licenses](THIRD_PARTY_LICENSES.txt)
for the pinned Raypx adaptation and shadcn licensing. No Radix or product-specific
dependencies are included.

## Licenses

[LICENSE](LICENSE) contains this package's Apache-2.0 terms. The adapted shadcn
source retains its complete MIT license in
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt) and provenance in
[NOTICE.md](NOTICE.md); both files ship in the npm archive.

Direct runtime dependencies and peers are listed below with their installed
versions and license links. They remain separate packages with their own notices;
their license texts and transitive dependency notices are not duplicated here.
Run `bun run licenses:update` from the repository root after dependency changes;
`bun run licenses:check` detects a stale index.

<!-- BEGIN GENERATED DEPENDENCY LICENSE INDEX -->

| Package                  | Installed version | License    | License text                                                        |
| ------------------------ | ----------------- | ---------- | ------------------------------------------------------------------- |
| @base-ui/react           | 1.9.0             | MIT        | [LICENSE](https://unpkg.com/@base-ui/react@1.9.0/LICENSE)           |
| @raypx-kit/themes        | 0.0.0-alpha.1     | Apache-2.0 | [LICENSE](../themes/LICENSE)                                        |
| class-variance-authority | 0.7.1             | Apache-2.0 | [LICENSE](https://unpkg.com/class-variance-authority@0.7.1/LICENSE) |
| cn                       | 0.5.0             | MIT        | [LICENSE](https://unpkg.com/cn@0.5.0/LICENSE)                       |
| lucide-react             | 1.64.0            | ISC        | [LICENSE](https://unpkg.com/lucide-react@1.64.0/LICENSE)            |
| react                    | 19.3.1            | MIT        | [LICENSE](https://unpkg.com/react@19.3.1/LICENSE)                   |
| react-dom                | 19.3.1            | MIT        | [LICENSE](https://unpkg.com/react-dom@19.3.1/LICENSE)               |
| tailwindcss              | 4.3.3             | MIT        | [LICENSE](https://unpkg.com/tailwindcss@4.3.3/LICENSE)              |
| tw-animate-css           | 1.4.0             | MIT        | [LICENSE](https://unpkg.com/tw-animate-css@1.4.0/LICENSE)           |

<!-- END GENERATED DEPENDENCY LICENSE INDEX -->

## Browser E2E

Dialog focus and dismissal, tab keyboard navigation, forms, narrow layouts and reduced motion.

Run `bun run test:e2e:install` once at the repository root, then
`bun run --cwd packages/ui test:e2e`. The package owns its scenarios in
`e2e/`; see the [browser test guide](../../docs/development/README.md#browser-e2e-by-workspace)
for project selection, reports and CI behavior.
