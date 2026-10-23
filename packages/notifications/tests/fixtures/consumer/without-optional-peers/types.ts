/// <reference types="node" />
import {
  createNotifications,
  signNotificationUserToken,
  type NotificationsClient,
} from "@raypx-kit/notifications";

const client: NotificationsClient = createNotifications({ apiKey: "sk_test_server_types" });
const trigger: Promise<{ workflow_run_id: string }> = client.workflows.trigger("welcome", {
  recipients: ["server-user"],
});
const token: Promise<string> = signNotificationUserToken("server-user", { signingKey: "explicit" });
void trigger;
void token;
