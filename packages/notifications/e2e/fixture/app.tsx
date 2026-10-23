import {
  NotificationInbox,
  NotificationsProvider,
  useKnockFeed,
} from "@raypx-kit/notifications/react";
import { useState } from "react";

function FeedControls() {
  const { feedClient, useFeedStore } = useKnockFeed();
  const unread = useFeedStore((state) => state.metadata.unread_count);
  return (
    <div>
      <p role="status" aria-label="Unread count">
        {unread} unread
      </p>
      <button type="button" onClick={() => void feedClient.fetch()}>
        Refresh feed
      </button>
    </div>
  );
}

export function App() {
  const [userId, setUserId] = useState("user-a");
  const [enabled, setEnabled] = useState(true);
  const [tenant, setTenant] = useState("workspace-a");
  return (
    <main>
      <h1>Notifications browser contract</h1>
      <p>Signed in as {userId}</p>
      <div className="controls">
        <button
          type="button"
          onClick={() => setUserId((id) => (id === "user-a" ? "user-b" : "user-a"))}
        >
          Switch user
        </button>
        <button type="button" onClick={() => setEnabled((value) => !value)}>
          {enabled ? "Disconnect" : "Connect"}
        </button>
        <button type="button" onClick={() => setTenant("workspace-b")}>
          Switch workspace
        </button>
      </div>
      <NotificationsProvider
        apiKey="pk_test_notifications"
        feedId="00000000-0000-4000-8000-000000000001"
        user={{ id: userId, name: userId }}
        userToken={`test-signed-token-${userId}`}
        host="http://127.0.0.1:4173"
        enabled={enabled}
        defaultFeedOptions={{ tenant }}
      >
        <div className="inbox-placement">
          <NotificationInbox />
        </div>
        <FeedControls />
      </NotificationsProvider>
      <button type="button">Outside action</button>
    </main>
  );
}
