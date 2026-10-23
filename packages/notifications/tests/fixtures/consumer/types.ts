import {
  createNotifications,
  signNotificationUserToken,
  type NotificationsClient,
  type NotificationsOptions,
  type NotificationUserTokenOptions,
} from "@raypx-kit/notifications";

const client: NotificationsClient = createNotifications({
  apiKey: "sk_test_consumer",
  baseURL: "http://127.0.0.1:9999",
  branch: "fixture",
  maxRetries: 0,
  timeout: 1000,
  fetch: async () => Response.json({}),
} satisfies NotificationsOptions);

client.users.update("user-one", {
  name: "Ada",
  email: "ada@example.test",
  timezone: "Europe/Berlin",
});
client.users.setPreferences("user-one", "default", { channel_types: { email: false } });
const trigger: Promise<{ workflow_run_id: string }> = client.workflows.trigger(
  "welcome",
  { recipients: ["user-one"], cancellation_key: "run-one", data: { title: "Hello" } },
  { idempotencyKey: "once", signal: new AbortController().signal, maxRetries: 0 },
);
const cancel: Promise<void> = client.workflows.cancel("welcome", { cancellation_key: "run-one" });
void trigger;
void cancel;

const token: Promise<string> = signNotificationUserToken("user-one", {
  signingKey: "explicit-test-key",
  expiresInSeconds: 600,
  shouldGenerateJti: true,
  grants: [{ entity: "https://api.knock.app/v1/users/user-one", grants: { "user/feed_read": [] } }],
} satisfies NotificationUserTokenOptions);
void token;

// @ts-expect-error API credentials are always explicit.
createNotifications({});
// @ts-expect-error An API key is a string, not a promise or token callback.
createNotifications({ apiKey: () => "secret" });
// @ts-expect-error The official workflow requires recipients.
client.workflows.trigger("welcome", { data: {} });
// @ts-expect-error Recipients preserve their upstream SDK types.
client.workflows.trigger("welcome", { recipients: 1 });
// @ts-expect-error Cancellation requires the trigger's cancellation key.
client.workflows.cancel("welcome", {});
// @ts-expect-error Per-request idempotency keys must be strings.
client.workflows.trigger("welcome", { recipients: [] }, { idempotencyKey: 1 });
// @ts-expect-error Signing never falls back to an environment-provided key.
signNotificationUserToken("user-one", {});
// @ts-expect-error The lifetime is in numeric seconds, not duration strings.
signNotificationUserToken("user-one", { signingKey: "test", expiresInSeconds: "1h" });
