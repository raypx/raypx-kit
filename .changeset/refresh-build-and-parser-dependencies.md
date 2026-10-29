---
"@raypx-kit/devkit": patch
"@raypx-kit/drizzle-kit": patch
"@raypx-kit/email-preview": patch
---

Update Devkit's TypeScript parser to oxc-parser 0.156 and support esbuild 0.28.2
in the slim Drizzle CLI while retaining upstream's dependency range. Rebuild the
email preview interface with Vite+ 1.4 and verify packaged migration generation
under Bun and Node.
