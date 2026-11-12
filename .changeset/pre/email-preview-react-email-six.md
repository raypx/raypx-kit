---
"@raypx-kit/email-preview": patch
---

Use React Email 6 components in examples and consumer templates, replacing the
deprecated `@react-email/components` package. Keep only the current renderer and
formatter as runtime dependencies so installing the preview does not bring in the
React Email CLI toolchain. Upgrade the Vite-based build and browser tooling while
preserving the consumer's React instance.
