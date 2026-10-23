# @raypx-kit/analytics

## 0.0.0-alpha.1

### Major Changes

- a6af9fe: Raise the minimum supported Node.js version from 22.14.0 to 22.21.0. Update
  package engine declarations and library build targets to the new floor, and
  verify installed consumers on Node 22.21.0. Upgrade older Node installations
  before installing these releases. The repository development pin remains 24.22.0.

### Patch Changes

- 53ce687: Update compatible PostHog and dotenvx dependencies and the bundled ICU message
  parser, preserving existing public interfaces and peer compatibility.

## 0.0.0-alpha.0

Initial consent-controlled PostHog browser client, application event policies,
sanitized exceptions and optional React bindings. SDK loading is deferred and all
imports are safe during server rendering.
