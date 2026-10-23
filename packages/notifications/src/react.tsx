"use client";

import {
  BellIcon,
  EmptyFeed,
  KnockFeedProvider,
  KnockProvider,
  NotificationFeedHeader,
  NotificationFeedPopover,
  UnseenBadge,
  useKnockFeed,
  type BadgeCountType,
  type KnockFeedProviderProps,
  type KnockProviderProps,
  type NotificationFeedPopoverProps,
} from "@knocklabs/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  type RefAttributes,
} from "react";

export {
  NotificationCell,
  NotificationFeed,
  NotificationFeedHeader,
  NotificationFeedPopover,
  NotificationIconButton,
  UnseenBadge,
  useKnockClient,
  useKnockFeed,
  useNotificationStore,
} from "@knocklabs/react";
export type {
  BadgeCountType,
  ColorMode,
  NotificationCellProps,
  NotificationFeedProps,
  NotificationFeedPopoverProps,
} from "@knocklabs/react";

type UserProviderProps = Extract<KnockProviderProps, { user: unknown }>;

export type NotificationsProviderProps = PropsWithChildren<
  Omit<UserProviderProps, "apiKey" | "user" | "userToken"> &
    Omit<KnockFeedProviderProps, "feedId"> & {
      apiKey: string;
      feedId: string;
      user: UserProviderProps["user"] & { id: string };
      /** A signed, bounded-expiry user token issued by the application's server. */
      userToken: string;
      /** Rendered during SSR and hydration before the browser SDK is mounted. */
      fallback?: ReactNode;
    }
>;

const subscribeToMount = () => () => {};
const mountedSnapshot = () => true;
const serverSnapshot = () => false;

/** Configure an authenticated feed without starting network work during SSR. */
export function NotificationsProvider({
  apiKey,
  feedId,
  user,
  userToken,
  colorMode,
  defaultFeedOptions,
  enabled = true,
  children,
  fallback = null,
  ...options
}: NotificationsProviderProps) {
  const mounted = useSyncExternalStore(subscribeToMount, mountedSnapshot, serverSnapshot);
  for (const [name, value] of Object.entries({ apiKey, feedId, userId: user?.id, userToken })) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new TypeError(`NotificationsProvider requires a non-empty ${name}.`);
    }
  }
  if (apiKey.startsWith("sk_")) {
    throw new TypeError("NotificationsProvider requires a public API key, not a secret API key.");
  }
  // The SDK creates a BroadcastChannel even when disabled. Bun exposes `self`
  // during SSR, so defer the entire SDK tree to avoid leaking a server resource.
  if (!mounted) return fallback;
  // Remount the feed before rendering a new identity so its previous user's items cannot leak.
  const identity = JSON.stringify([
    apiKey,
    options.host,
    options.branch,
    user.id,
    feedId,
    defaultFeedOptions,
    enabled,
  ]);
  return (
    <KnockProvider
      {...options}
      key={identity}
      apiKey={apiKey}
      user={user}
      userToken={userToken}
      enabled={enabled}
    >
      <KnockFeedProvider
        feedId={feedId}
        {...(colorMode === undefined ? {} : { colorMode })}
        {...(defaultFeedOptions === undefined ? {} : { defaultFeedOptions })}
      >
        {children}
      </KnockFeedProvider>
    </KnockProvider>
  );
}

export interface NotificationsTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, RefAttributes<HTMLButtonElement> {
  badgeCountType?: BadgeCountType;
}

/** The SDK's icon and live badge with standard button and accessibility props. */
export function NotificationsTrigger({
  badgeCountType = "unread",
  className,
  children,
  ...props
}: NotificationsTriggerProps) {
  const { colorMode } = useKnockFeed();
  return (
    <button
      type="button"
      aria-label="Notifications"
      {...props}
      className={[
        "raypx-notifications-trigger",
        "rnf-notification-icon-button",
        `rnf-notification-icon-button--${colorMode}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children ?? <BellIcon aria-hidden={true} />}
      <UnseenBadge badgeCountType={badgeCountType} />
    </button>
  );
}

export interface NotificationInboxProps extends Omit<
  NotificationFeedPopoverProps,
  "buttonRef" | "isVisible" | "onClose" | "header"
> {
  badgeCountType?: BadgeCountType;
  className?: string;
  /** Accessible name for the notification button. */
  label?: string;
}

/** An SDK feed popover with keyboard focus, an unread badge and a retryable error state. */
export function NotificationInbox({
  badgeCountType = "unread",
  className,
  label = "Notifications",
  renderHeader = (props) => <NotificationFeedHeader {...props} />,
  EmptyComponent = <EmptyFeed />,
  ...feedProps
}: NotificationInboxProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const { feedClient, useFeedStore } = useKnockFeed();
  const failed = useFeedStore((state) => state.networkStatus === "error");

  useEffect(() => {
    if (open) containerRef.current?.querySelector<HTMLElement>('[role="dialog"]')?.focus();
  }, [open]);

  return (
    <div className={["raypx-notifications-inbox", className].filter(Boolean).join(" ")}>
      <NotificationsTrigger
        ref={buttonRef}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={id}
        badgeCountType={badgeCountType}
        onClick={() => setOpen((value) => !value)}
      />
      <div id={id} ref={containerRef}>
        <NotificationFeedPopover
          {...feedProps}
          buttonRef={buttonRef}
          isVisible={open}
          onClose={(event) => {
            setOpen(false);
            if (event instanceof KeyboardEvent && event.key === "Escape") {
              buttonRef.current?.focus();
            }
          }}
          renderHeader={(props) => (
            <>
              {renderHeader(props)}
              {failed && (
                <div role="alert" className="raypx-notifications-error">
                  <p>Notifications could not be loaded.</p>
                  <button
                    type="button"
                    onClick={() => void feedClient.fetch({ status: props.filterStatus })}
                  >
                    Try again
                  </button>
                </div>
              )}
            </>
          )}
          EmptyComponent={failed ? null : EmptyComponent}
        />
      </div>
    </div>
  );
}
