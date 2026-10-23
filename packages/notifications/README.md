# @raypx-kit/notifications

Knock workflow clients, signed user tokens and optional React notification feeds.
The server and browser entries use the official Knock SDKs. Applications own
user authentication, authorization, configuration, recipients and delivery policy.

## Install and entries

```sh
bun add @raypx-kit/notifications
# Install these peers when using the React feed:
bun add @knocklabs/react react react-dom
```

ESM; Node 22.21 or newer. The root entry works without React. The optional
`/react` entry requires React and React DOM 19 and `@knocklabs/react` 0.14.x.
`/styles.css` is an explicit stylesheet entry for the feed components.
The SDKs and React remain external; there is no framework dependency.

## Configure Knock

Production use requires a Knock account and an environment with API keys,
users, configured delivery channels and deployed workflows. Create an in-app
feed channel for the React UI; its channel ID is the `feedId`. Configure any
email, push or other delivery providers in Knock. Workflow keys, templates,
preferences and recipient selection belong to your application and Knock setup.

Keep the **secret API key** and **private signing key** on your server. The
browser receives the **public API key**, the authenticated user's ID, a signed
user token and the feed channel ID. Enable Knock's enhanced security mode for
production so a public API key alone cannot authenticate a user. See
[Knock security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication)
for environment setup and resource grants.

## Server client

`createNotifications({ apiKey, ...options })` returns the official Knock client
with its native methods, request options and errors. A nonempty `apiKey` is
required; the factory does not silently fall back to a secret in the environment.
Construct the client in application-owned server code:

```ts
import { createNotifications } from "@raypx-kit/notifications";

export async function notifyDocumentReady(
  secretApiKey: string,
  recipient: { id: string; email: string; name: string },
  documentId: string,
) {
  const notifications = createNotifications({ apiKey: secretApiKey });
  await notifications.users.update(recipient.id, {
    email: recipient.email,
    name: recipient.name,
  });
  return notifications.workflows.trigger(
    "document-ready",
    { recipients: [recipient.id], data: { documentId } },
    { idempotencyKey: `document-ready:${documentId}:${recipient.id}` },
  );
}
```

Call this only after the application has authorized the event and recipient;
`document-ready` must exist in the selected Knock environment. Applications can
retain one client for their server's lifetime. Native operations such as
`workflows.cancel` and `users.setPreferences` remain available. Options including
`baseURL`, `branch`, `fetch`, timeouts, retries and per-request cancellation retain
the installed SDK's behavior. See the [Knock Node SDK](https://github.com/knocklabs/knock-node)
for its full API.

Kit does not parse environment variables or initialize a client on import.
The explicitly constructed SDK retains its own environment defaults, including
`KNOCK_BASE_URL`, `KNOCK_BRANCH`, `KNOCK_LOG` and `KNOCK_CUSTOM_HEADERS`.
Pass configuration deliberately when those defaults are unsuitable. The SDK's
default timeout and retry policy also apply unless overridden.

## Signed user tokens

Generate a token in an authenticated server handler, using the user identity
established by your application. Do not sign an arbitrary user ID supplied by
an unauthenticated browser. Signing is local and does not call Knock:

```ts
import { signNotificationUserToken } from "@raypx-kit/notifications";

export async function createFeedSession(
  authenticatedUser: { id: string },
  privateSigningKey: string,
) {
  return {
    user: { id: authenticatedUser.id },
    userToken: await signNotificationUserToken(authenticatedUser.id, {
      signingKey: privateSigningKey,
      expiresInSeconds: 3600,
    }),
  };
}
```

`signingKey` is required and accepts Knock's RSA PKCS8 private signing key in PEM
or base64-encoded PEM form. `expiresInSeconds` defaults to 3600 and must be an integer
from 1 through 86400. Native `grants` and `shouldGenerateJti` options are preserved.
The application controls grants, token delivery and renewal before expiration;
the token is scoped to the supplied user ID, not a replacement for application
authentication. Return only the session data needed by that authenticated user,
never either server secret.

## React feed

The React entry composes Knock's official provider and notification feed
components. Supply the public API key, user, signed token and feed channel
explicitly. Import the stylesheet once in your application:

```tsx
import { NotificationInbox, NotificationsProvider } from "@raypx-kit/notifications/react";
import "@raypx-kit/notifications/styles.css";

type FeedSession = {
  publicApiKey: string;
  feedId: string;
  user: { id: string };
  userToken: string;
};

export function NotificationMenu(session: FeedSession) {
  return (
    <NotificationsProvider
      apiKey={session.publicApiKey}
      feedId={session.feedId}
      user={session.user}
      userToken={session.userToken}
      fallback={<span role="status">Loading notifications...</span>}
    >
      <NotificationInbox />
    </NotificationsProvider>
  );
}
```

`NotificationInbox` combines a notification button with Knock's feed popover.
During SSR and initial hydration, `NotificationsProvider` renders only its
`fallback`, which defaults to `null`. The entire children and SDK tree are
created after client mount; notification lists are not server-rendered. Wrap
only the notification region, as above, and keep content that needs server
rendering outside the provider. Use `fallback` for a lightweight loading state.

`NotificationsProvider` requires a nonempty user token, including in development.
Mount it for an authenticated session, replace the user and token together on
account changes, and unmount it on logout.

Provider options include `colorMode`, `defaultFeedOptions`, `enabled` and
`onUserTokenExpiring`. Use the expiration callback to obtain a fresh token from
your authenticated backend and update `userToken`; renewal is application-owned.
Advanced SDK configuration such as `host`, `branch`, `i18n` and logging remains
explicit. The SDK derives both HTTP and WebSocket endpoints from `host`.

For custom composition, `NotificationsTrigger` supplies a button and live badge;
`NotificationFeed`, `NotificationFeedPopover`, `NotificationCell`,
`NotificationFeedHeader`, `NotificationIconButton` and `UnseenBadge` retain their
official SDK APIs. The `useKnockClient`, `useKnockFeed` and `useNotificationStore`
hooks are also available from `/react`.

## Scope and reference

The package follows the server-client and React-feed separation illustrated by
[next-forge notifications](https://github.com/vercel/next-forge/tree/main/packages/notifications).
Its implementation is an original composition of official SDKs and does not copy
next-forge source. Knock handles notification workflow execution and delivery;
this package provides application integration rather than a self-hosted delivery
service or transient toast system. No global client, environment schema,
authentication endpoint or product workflow is included.

## Development and browser E2E

Run the package check and tests before the repository verification gate:

```sh
bun run --cwd packages/notifications check
bun run --cwd packages/notifications test
bun run test:e2e:install
bun run --cwd packages/notifications test:e2e
```

The package owns browser scenarios in `e2e/`. They exercise the real Knock React
SDK against a local test-owned API, without production credentials or sending
notifications to a live account. Unit and archive consumers cover the server
client, token signing and entry boundaries, including installation without the
optional React peers. See the [browser test guide](../../docs/development/README.md#browser-e2e-by-workspace)
for project selection, reports and CI behavior.

## Licenses

[LICENSE](./LICENSE) contains this package's Apache-2.0 terms. The dependency
index links to upstream license texts for the installed versions. When an npm
archive omits its license file, the index uses a verified, pinned upstream source;
no external license text is copied into this package's license. Run
`bun run licenses:update` after dependency changes; `bun run licenses:check`
rejects drift.

<!-- BEGIN GENERATED DEPENDENCY LICENSE INDEX -->

| Package          | Installed version | License    | License text                                                                                             |
| ---------------- | ----------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| @knocklabs/node  | 1.40.0            | Apache-2.0 | [LICENSE](https://unpkg.com/@knocklabs/node@1.40.0/LICENSE)                                              |
| @knocklabs/react | 0.14.0            | MIT        | [LICENSE](https://github.com/knocklabs/javascript/blob/f242ff85143843dd3579e72c2010d16c2c439ad1/LICENSE) |
| react            | 19.3.1            | MIT        | [LICENSE](https://unpkg.com/react@19.3.1/LICENSE)                                                        |
| react-dom        | 19.3.1            | MIT        | [LICENSE](https://unpkg.com/react-dom@19.3.1/LICENSE)                                                    |

<!-- END GENERATED DEPENDENCY LICENSE INDEX -->
