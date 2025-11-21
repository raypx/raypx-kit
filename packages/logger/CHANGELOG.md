# @raypx/logger

## 0.1.0

### Minor Changes

- ac4004c: feat: add @raypx/logger package

  Add new @raypx/logger package - lightweight, configurable logger based on consola with the following features:

  - Environment-aware log levels (production vs development)
  - Silent mode support for suppressing non-error logs
  - Replaceable logger instance for testing
  - Tagged logger support for module-specific logging
  - Proxy-based API for dynamic logger replacement
  - Full TypeScript support with type definitions

  This package is extracted from the main project to be reusable across different projects.
