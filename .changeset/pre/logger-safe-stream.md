---
"@raypx-kit/logger": patch
---

Add `@raypx-kit/logger/safe`, an explicit field policy for drains that removes credentials, personal data, messages, causes and stacks and bounds each event, and `@raypx-kit/logger/stream`, an ordered JSON-lines drain for stderr or another writable.
