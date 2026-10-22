export type AnalyticsProperties = Readonly<Record<string, string | number | boolean>>;
export interface AnalyticsConsent {
  usage: boolean;
  errors: boolean;
}
export const DEFAULT_ANALYTICS_CONSENT: Readonly<AnalyticsConsent> = Object.freeze({
  usage: false,
  errors: false,
});
export type EventPolicy = (
  event: string,
  properties: AnalyticsProperties,
) => AnalyticsProperties | null;
export interface AnalyticsClient {
  capture(event: string, properties?: AnalyticsProperties): void;
  captureException(error: unknown): void;
  identify(id: string | null): void;
  reset(): void;
  setConsent(consent: AnalyticsConsent): void;
  dispose(): void;
}
export function createNoopAnalytics(): AnalyticsClient {
  const noop = () => {};
  return {
    capture: noop,
    captureException: noop,
    identify: noop,
    reset: noop,
    setConsent: noop,
    dispose: noop,
  };
}
/** Application assets only. Never retain file paths, query strings or caller text. */
export function applicationFrame(value: string, origins: readonly string[]): string | null {
  try {
    const url = new URL(value);
    if (
      !origins.some((origin) => {
        const allowed = new URL(origin);
        return allowed.protocol === url.protocol && allowed.host === url.host;
      })
    )
      return null;
    if (
      !/^(?:https?:|views:)$/.test(url.protocol) ||
      !/^\/assets\/[a-zA-Z0-9_.-]+\.(?:m?js)$/.test(url.pathname)
    )
      return null;
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return null;
  }
}
const errorNames = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AggregateError",
]);
export function sanitizeException(error: unknown, origins: readonly string[]): Error {
  const safe = new Error("UNEXPECTED_ERROR");
  safe.stack = "";
  try {
    if (!error || typeof error !== "object") return safe;
    const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
    if (typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)) safe.message = code;
    if (!(error instanceof Error)) return safe;
    if (errorNames.has(error.name)) safe.name = error.name;
    const frames = (error.stack ?? "")
      .split("\n")
      .slice(0, 50)
      .flatMap((line) => {
        const match = line.match(/((?:https?|views):\/\/[^\s()]+):(\d+):(\d+)\)?$/);
        const asset = match ? applicationFrame(match[1]!, origins) : null;
        return asset && match ? [`    at ${asset}:${match[2]}:${match[3]}`] : [];
      });
    if (frames.length) safe.stack = `${safe.name}: ${safe.message}\n${frames.join("\n")}`;
  } catch {
    /* An unknown thrown object must not break error reporting. */
  }
  return safe;
}
