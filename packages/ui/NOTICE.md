# Source provenance

The seven primitives in `src/components/ui/` adapt the existing
[`raypx/raypx` UI package](https://github.com/raypx/raypx/tree/b6f4ca1e72b7a8f7ccd5962f75ce32f2d5dd7738/packages/ui)
at commit `b6f4ca1e72b7a8f7ccd5962f75ce32f2d5dd7738`. The copied source files were
clean at that revision:

- `packages/ui/src/components/ui/button.tsx`
- `packages/ui/src/components/ui/input.tsx`
- `packages/ui/src/components/ui/tabs.tsx`
- `packages/ui/src/components/ui/badge.tsx`
- `packages/ui/src/components/ui/dialog.tsx`
- `packages/ui/src/components/ui/skeleton.tsx`
- `packages/ui/src/components/ui/native-select.tsx`

That package identifies these components as shadcn/ui `base-nova` primitives
using Base UI and Lucide. Its original registry generation revision is not
recorded; this package does not claim that the adapted components match a later
shadcn registry revision. The direct adaptation pin above is the source of truth.

Raypx modifications are distributed under the complete Apache-2.0 license in
`LICENSE`. Copyright 2026 Zack <heyloyep@gmail.com>.

## shadcn/ui

Upstream: <https://github.com/shadcn-ui/ui>.

The complete MIT license is retained in `THIRD_PARTY_LICENSES.txt`. Its license
source is pinned to
[`LICENSE.md` at `6ea6856f5a1082d4d9c231559b6bc3ee73827493`](https://github.com/shadcn-ui/ui/blob/6ea6856f5a1082d4d9c231559b6bc3ee73827493/LICENSE.md),
the license's history entry. This is a license pin, not the generation revision
of the adapted base-nova components.

## Toolkit changes

The adaptation adds independent ESM and declaration exports, React 19 peer
boundaries, the shared theme stylesheet entry, reduced-motion utilities, explicit
type imports, and a decorative-icon accessibility annotation. It preserves the
existing default button type, destructive text colors, Base UI behavior and
component API. Runtime dependencies are linked packages with their own licenses;
they are not copied into this library's output.

Before updating source provenance, review component behavior, the dependency
contract and licensing together, then run interaction and archive consumer tests.
