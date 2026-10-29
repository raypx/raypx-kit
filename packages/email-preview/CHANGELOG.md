# @raypx-kit/email-preview

## 0.0.0-alpha.1

### Patch Changes

- f4006e4: Recover a template whose repair lands within 50 ms of the broken save. Vite's watcher drops that second change on Linux, which left the failed render cached and the preview stuck on the old compile error; the runtime now re-checks each changed file after the watcher's throttle window and refreshes the preview when it changed.

## 0.0.0-alpha.0

Initial prerelease.

- Add the `emailPreview()` Vite plugin with a prebuilt client-side interface.
- Discover React Email TSX and JSX templates and render their `PreviewProps`.
- Refresh previews when templates, imported sources or local assets change.
- Inspect desktop/mobile layouts and copy or download HTML and plain text.
- Show the HTML source indented by Prettier, with line numbers.
- Reuse Kit UI primitives and persist light, dark or system theme preferences.
- Verify the installed archive under Bun and Node with consumer-owned templates.
