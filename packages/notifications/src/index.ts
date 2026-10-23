import {
  Knock,
  signUserToken,
  type ClientOptions,
  type SignUserTokenOptions,
} from "@knocklabs/node";

/** The official client, including its resources, request options and native errors. */
export type NotificationsClient = Knock;

/** Explicit credentials with the official SDK's remaining client options. */
export interface NotificationsOptions extends Omit<ClientOptions, "apiKey"> {
  apiKey: string;
}

/** A short-lived user token; applications supply the authenticated user's identity. */
export interface NotificationUserTokenOptions extends Omit<SignUserTokenOptions, "signingKey"> {
  /** RSA PKCS8 private key in PEM or base64-encoded PEM format. */
  signingKey: string;
  /** Integer seconds from 1 through 86400. Defaults to 3600 (one hour). */
  expiresInSeconds?: number | undefined;
}

function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("Notification clients and signing keys must only be used on the server.");
  }
}

function requireValue(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be provided explicitly as a non-empty string.`);
  }
}

/** Create an independent SDK client with an explicit API key and no eager network requests. */
export function createNotifications(options: NotificationsOptions): NotificationsClient {
  assertServer();
  requireValue(options?.apiKey, "apiKey");
  return new Knock(options);
}

/** Sign with the official SDK, requiring an explicit key and a bounded token lifetime. */
export async function signNotificationUserToken(
  userId: string,
  options: NotificationUserTokenOptions,
): Promise<string> {
  assertServer();
  requireValue(userId, "userId");
  requireValue(options?.signingKey, "signingKey");
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 86400) {
    throw new RangeError("expiresInSeconds must be an integer from 1 through 86400.");
  }
  return signUserToken(userId, { ...options, expiresInSeconds });
}
