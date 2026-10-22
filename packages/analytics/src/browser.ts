import type { PostHog, CaptureResult } from "posthog-js";
import {
  applicationFrame,
  sanitizeException,
  type AnalyticsClient,
  type AnalyticsConsent,
  type AnalyticsProperties,
  type EventPolicy,
} from "./index.js";

export interface BrowserAnalyticsOptions {
  token: string;
  host: string;
  environment: string;
  release: string;
  assetOrigins: readonly string[];
  policy: EventPolicy;
  properties?: AnalyticsProperties;
}
/** No SDK import or network activity until the application explicitly grants consent. */
export function createBrowserAnalytics(options: BrowserAnalyticsOptions): AnalyticsClient {
  let consent: AnalyticsConsent = { usage: false, errors: false };
  let identity: string | null = null;
  function safely(run: () => void) {
    try {
      run();
    } catch {
      /* Diagnostics never affect product operations. */
    }
  }
  let sdk: PostHog | undefined;
  let loading: Promise<PostHog | undefined> | undefined;
  let generation = 0;
  let disposed = false;
  const requests = new Map<AbortController, ReturnType<typeof setTimeout>>();
  function invalidate() {
    generation++;
    for (const [controller, timeout] of requests) {
      clearTimeout(timeout);
      controller.abort();
    }
    requests.clear();
  }
  function syncSdkConsent() {
    safely(() => {
      if (consent.usage || consent.errors) sdk?.opt_in_capturing({ captureEventName: false });
      else sdk?.opt_out_capturing();
    });
  }
  async function deliver(event: CaptureResult, version: number) {
    const category = event.event === "$exception" ? "errors" : "usage";
    if (disposed || version !== generation || !consent[category]) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      requests.delete(controller);
      controller.abort();
    }, 10_000);
    requests.set(controller, timeout);
    try {
      const response = await fetch(new URL("e/", `${options.host.replace(/\/+$/, "")}/`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: false,
        signal: controller.signal,
        body: JSON.stringify({
          api_key: options.token,
          batch: [event],
          sent_at: new Date().toISOString(),
        }),
      });
      await response.body?.cancel();
    } catch {
      // One attempt only. Aborts and delivery failures never affect product operations.
    } finally {
      clearTimeout(timeout);
      requests.delete(controller);
    }
  }
  const exceptions = new WeakSet<object>();
  const configured = Boolean(options.token && options.host && options.release);
  function beforeSend(event: CaptureResult | null): CaptureResult | null {
    if (!event || disposed) return null;
    const error = event.event === "$exception";
    const identifying = event.event === "$identify";
    if (error ? !consent.errors : !consent.usage) return null;
    const properties = event.properties;
    const extra = error || identifying ? {} : options.policy(event.event, properties);
    if (!extra) return null;
    // Rebuild properties instead of forwarding SDK URL/referrer/person enrichment.
    const safe: Record<string, unknown> = {
      ...options.properties,
      ...extra,
      environment: options.environment,
      release: options.release,
      $geoip_disable: true,
    };
    for (const key of [
      "token",
      "distinct_id",
      "$device_id",
      "$anon_distinct_id",
      "$lib",
      "$lib_version",
      "$process_person_profile",
    ])
      if (["string", "boolean"].includes(typeof properties[key])) safe[key] = properties[key];
    if (error) {
      const exceptions: unknown = properties.$exception_list;
      if (!Array.isArray(exceptions)) return null;
      safe.$exception_list = exceptions.slice(0, 1).map((exception) => ({
        type: exception.type,
        value: /^[A-Z][A-Z0-9_]{0,63}$/.test(exception.value)
          ? exception.value
          : "UNEXPECTED_ERROR",
        stacktrace: {
          frames: (exception.stacktrace?.frames ?? []).flatMap((frame: Record<string, unknown>) => {
            const filename =
              typeof frame.filename === "string"
                ? applicationFrame(frame.filename, options.assetOrigins)
                : null;
            if (!filename) return [];
            return [
              {
                filename,
                ...(typeof frame.lineno === "number" ? { lineno: frame.lineno } : {}),
                ...(typeof frame.colno === "number" ? { colno: frame.colno } : {}),
                ...(typeof frame.chunk_id === "string" && /^[a-zA-Z0-9-]+$/.test(frame.chunk_id)
                  ? { chunk_id: frame.chunk_id }
                  : {}),
                platform: "javascript",
              },
            ];
          }),
        },
      }));
      safe.$exception_level = "error";
      if (
        typeof properties.$release_id === "string" &&
        /^[a-f0-9-]{16,128}$/i.test(properties.$release_id)
      )
        safe.$release_id = properties.$release_id;
    }
    return {
      event: event.event,
      properties: safe,
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
      uuid: event.uuid,
    };
  }
  async function load(): Promise<PostHog | undefined> {
    if (
      disposed ||
      !configured ||
      typeof window === "undefined" ||
      (!consent.usage && !consent.errors)
    )
      return;
    return (loading ??= import("posthog-js/no-external")
      .then(({ PostHog }) => {
        if (disposed || (!consent.usage && !consent.errors)) return;
        sdk = new PostHog();
        sdk.init(options.token, {
          api_host: options.host,
          persistence: "memory",
          reuseAnonymousId: true,
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          capture_dead_clicks: false,
          capture_exceptions: false,
          disable_session_recording: true,
          disable_surveys: true,
          disable_conversations: true,
          disable_product_tours: true,
          disable_external_dependency_loading: true,
          advanced_disable_flags: true,
          capture_performance: false,
          save_referrer: false,
          save_campaign_params: false,
          enable_heatmaps: false,
          request_batching: false,
          person_profiles: "identified_only",
          ip: false,
          before_send: (event) => {
            try {
              const safe = beforeSend(event);
              if (safe) void deliver(safe, generation);
            } catch {
              /* Invalid SDK payloads fail closed. */
            }
            // The SDK formats events; only our cancellable, single-attempt transport sends them.
            return null;
          },
          on_request_error: () => {},
        });
        // SDK consent has its own persistence even with persistence: "memory".
        syncSdkConsent();
        if (consent.usage && identity) sdk.identify(identity);
        return sdk;
      })
      .catch(() => {
        sdk = undefined;
        loading = undefined;
        return undefined;
      })
      .finally(() => {
        if (!sdk) loading = undefined;
      }));
  }
  function send(category: keyof AnalyticsConsent, run: (instance: PostHog) => void) {
    if (disposed || !consent[category]) return;
    const version = generation;
    void load()
      .then((instance) => {
        if (instance && !disposed && version === generation && consent[category]) run(instance);
      })
      .catch(() => {});
  }
  const onError = (event: ErrorEvent) => {
    if (event.error) client.captureException(event.error);
  };
  const onRejection = (event: PromiseRejectionEvent) => client.captureException(event.reason);
  function listen(enabled: boolean) {
    if (typeof window === "undefined") return;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    if (enabled) {
      window.addEventListener("error", onError);
      window.addEventListener("unhandledrejection", onRejection);
    }
  }
  const client: AnalyticsClient = {
    capture(event, properties = {}) {
      try {
        const safe = options.policy(event, properties);
        if (safe && !event.startsWith("$"))
          send("usage", (instance) => instance.capture(event, safe));
      } catch {
        /* Policy failures fail closed. */
      }
    },
    captureException(error) {
      if (disposed || !consent.errors) return;
      if (error && typeof error === "object") {
        if (exceptions.has(error)) return;
        exceptions.add(error);
      }
      const safe = sanitizeException(error, options.assetOrigins);
      send("errors", (instance) => instance.captureException(safe));
    },
    identify(id) {
      if (disposed || identity === id) return;
      invalidate();
      safely(() => sdk?.reset(true));
      syncSdkConsent();
      identity = id;
      if (id) send("usage", (instance) => instance.identify(id));
    },
    reset() {
      if (disposed) return;
      invalidate();
      identity = null;
      safely(() => sdk?.reset(true));
      syncSdkConsent();
    },
    setConsent(next) {
      if (disposed || (consent.usage === next.usage && consent.errors === next.errors)) return;
      invalidate();
      const usageChanged = consent.usage !== next.usage;
      consent = { usage: next.usage === true, errors: next.errors === true };
      listen(configured && consent.errors);
      if (usageChanged) safely(() => sdk?.reset(true));
      syncSdkConsent();
      if (!consent.usage && !consent.errors) return;
      void load();
      if (consent.usage && identity) send("usage", (instance) => instance.identify(identity!));
    },
    dispose() {
      invalidate();
      disposed = true;
      consent = { usage: false, errors: false };
      identity = null;
      listen(false);
      safely(() => sdk?.opt_out_capturing());
    },
  };
  return client;
}
