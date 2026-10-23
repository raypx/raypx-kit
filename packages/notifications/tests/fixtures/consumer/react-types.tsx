import {
  NotificationInbox,
  NotificationsProvider,
  NotificationsTrigger,
  useKnockClient,
  useKnockFeed,
  type NotificationsProviderProps,
} from "@raypx-kit/notifications/react";

const provider = {
  apiKey: "pk_test_consumer",
  feedId: "00000000-0000-4000-8000-000000000001",
  user: { id: "user-one", name: "Ada" },
  userToken: "server-signed-token",
  host: "http://127.0.0.1:9999",
  colorMode: "dark",
} satisfies NotificationsProviderProps;

function Consumer() {
  const client = useKnockClient();
  const { feedClient } = useKnockFeed();
  void client;
  void feedClient;
  return (
    <>
      <NotificationInbox label="Your notifications" badgeCountType="unread" />
      <NotificationsTrigger aria-label="Open feed" disabled />
    </>
  );
}

const app = (
  <NotificationsProvider {...provider} enabled={false}>
    <Consumer />
  </NotificationsProvider>
);
void app;

const { userToken: _token, ...withoutToken } = provider;
// @ts-expect-error Client authentication requires a server-signed token.
const missingToken = <NotificationsProvider {...withoutToken} />;
// @ts-expect-error Provider identities must include a non-optional string ID.
const missingIdentity = <NotificationsProvider {...provider} user={{ name: "Ada" }} />;
// @ts-expect-error Badge types preserve the official SDK union.
const invalidBadge = <NotificationInbox badgeCountType="all-events" />;
void missingToken;
void missingIdentity;
void invalidBadge;
