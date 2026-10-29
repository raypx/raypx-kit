---
"@raypx-kit/email-preview": patch
---

Recover a template whose repair lands within 50 ms of the broken save. Vite's watcher drops that second change on Linux, which left the failed render cached and the preview stuck on the old compile error; the runtime now re-checks each changed file after the watcher's throttle window and refreshes the preview when it changed.
