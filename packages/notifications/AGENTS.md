# Notifications

Provide Knock notification workflows, explicit user-token signing and optional React feeds.
Keep the root entry server-only and React imports under `/react`, without importing the Node SDK.
Applications own secret/public keys, authenticated user identities, signing keys, feed channels,
workflows, recipients, authorization and environment parsing. Never initialize or read environment
variables on import. Never send real notifications in tests.

Use the installed official SDK types and preserve its request options and native errors.
Require explicit credentials; user tokens must have bounded expiry and an explicit signing key.
Keep React/React DOM 19 and @knocklabs/react external optional peers. Consumers import styles
explicitly through `/styles.css`; keep third-party dependency license links in README.

Unit and archive tests live in `tests/`, browser tests and fixtures in sibling `e2e/`.
Browser contracts must exercise the real SDK against a local test-owned API, without
replacing package implementations or contacting Knock. Run focused tests before root verify.
Preserve all existing unrelated changes. Do not publish or commit automatically.
