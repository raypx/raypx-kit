import { isIP } from "node:net";
import arcjet, {
  type ArcjetDecision,
  type ArcjetNode,
  type ArcjetNodeRequest,
  type ArcjetOptions,
  type CharacteristicProps,
  type ExtraProps,
  type Primitive,
  type Product,
} from "@arcjet/node";

/** Whether a failed check permits the application to continue handling a request. */
export type ArcjetErrorPolicy = "allow" | "deny";

/** A denied result also includes Arcjet challenges, which this adapter cannot complete. */
export type ArcjetSecurityResult =
  | { status: "allow"; allowed: true; decision: ArcjetDecision }
  | { status: "deny"; allowed: false; decision: ArcjetDecision }
  | { status: "error"; allowed: boolean; error: Error; decision?: ArcjetDecision };

export type ArcjetSecurityOptions<
  Rules extends (Primitive | Product)[],
  Characteristics extends readonly string[] = [],
> = Omit<ArcjetOptions<Rules, Characteristics>, "proxies"> & {
  /** Explicitly choose how missing IPs, SDK errors and thrown checks are handled. */
  onError: ArcjetErrorPolicy;
  /**
   * Return a bare IP from trusted server or platform metadata. This adapter never
   * trusts forwarding headers. The caller owns any trusted proxy configuration.
   * The validated value is passed through the SDK's explicit IP override, which
   * also accepts private and loopback addresses without header-based fallback.
   */
  getClientIp: (request: Request) => string | undefined | Promise<string | undefined>;
};

type RequestProperties<Props extends Record<string, unknown>> = Omit<
  NonNullable<Parameters<ArcjetNode<Props>["protect"]>[1]>,
  "ipSrc"
>;

type RuleProperties<Props extends Record<string, unknown>> =
  Partial<RequestProperties<Props>> extends RequestProperties<Props>
    ? [properties?: RequestProperties<Props>]
    : [properties: RequestProperties<Props>];

export interface ArcjetSecurity<Props extends Record<string, unknown>> {
  /**
   * Evaluate a Fetch request without consuming its body. Rules that inspect text
   * must receive it explicitly, for example through `sensitiveInfoValue`.
   */
  protect(request: Request, ...properties: RuleProperties<Props>): Promise<ArcjetSecurityResult>;
}

// Remove forwarding IP sources, including the SDK's development override.
// An explicit ipSrc also ensures that SDK IP resolution cannot fall back to
// headers, including any additional source introduced by future SDK updates.
const ipHeaders = new Set([
  "cf-connecting-ip",
  "cf-connecting-ipv6",
  "do-connecting-ip",
  "fastly-client-ip",
  "fly-client-ip",
  "forwarded",
  "forwarded-for",
  "true-client-ip",
  "x-appengine-user-ip",
  "x-arcjet-ip",
  "x-client-ip",
  "x-cluster-client-ip",
  "x-fah-client-ip",
  "x-forwarded",
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-forwarded-for",
]);

function toNodeRequest(
  request: Request,
  clientIp: string,
  onBodyRead: (error: Error) => void,
): ArcjetNodeRequest {
  const url = new URL(request.url);
  const headers: Record<string, string> = Object.create(null);
  for (const [name, value] of request.headers) {
    if (!ipHeaders.has(name.toLowerCase())) headers[name] = value;
  }
  headers.host = url.host;
  return {
    headers,
    method: request.method,
    url: request.url,
    socket: { remoteAddress: clientIp, encrypted: url.protocol === "https:" },
    get body(): never {
      const error = new Error(
        "Automatic request body inspection is unavailable; pass text through the rule's explicit properties, such as sensitiveInfoValue",
      );
      // The SDK may replace a local rule failure with a remote ALLOW decision.
      // Preserve this adapter failure separately for the caller's error policy.
      onBodyRead(error);
      throw error;
    },
  };
}

function failure(
  onError: ArcjetErrorPolicy,
  cause: unknown,
  decision?: ArcjetDecision,
): ArcjetSecurityResult {
  return {
    status: "error",
    allowed: onError === "allow",
    error:
      cause instanceof Error ? cause : new Error("Arcjet request protection failed", { cause }),
    ...(decision === undefined ? {} : { decision }),
  };
}

/**
 * Create an application-owned client. Keys, rules, IP resolution and failure
 * policy are required; this module does not read environment variables or create
 * global clients. The Arcjet SDK retains its own environment-dependent defaults.
 */
export function createArcjetSecurity<
  const Rules extends (Primitive | Product)[],
  const Characteristics extends readonly string[] = [],
>(
  options: ArcjetSecurityOptions<Rules, Characteristics>,
): ArcjetSecurity<ExtraProps<Rules> & CharacteristicProps<Characteristics>> {
  const { key, rules, characteristics, client, log, getClientIp, onError } = options;
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new TypeError("Arcjet requires an explicit, nonempty key");
  }
  if (typeof getClientIp !== "function") {
    throw new TypeError("Arcjet requires a trusted getClientIp resolver");
  }
  if (onError !== "allow" && onError !== "deny") {
    throw new TypeError('Arcjet requires an explicit onError policy: "allow" or "deny"');
  }
  const sdk = arcjet({
    key,
    rules,
    ...(characteristics === undefined ? {} : { characteristics }),
    ...(client === undefined ? {} : { client }),
    ...(log === undefined ? {} : { log }),
  });
  return Object.freeze({
    async protect(request, ...properties) {
      try {
        const clientIp = await getClientIp(request);
        if (typeof clientIp !== "string" || isIP(clientIp) === 0) {
          throw new Error("getClientIp must return a valid IP from trusted server metadata");
        }
        // The SDK's private conditional tuple cannot reduce while Rules is
        // generic. Retain rule requirements and SDK metadata options, while
        // enforcing the independently resolved IP even for JavaScript callers.
        let bodyError: Error | undefined;
        const requestArguments = [
          toNodeRequest(request, clientIp, (error) => {
            bodyError = error;
          }),
          { ...properties[0], ipSrc: clientIp },
        ] as unknown as Parameters<typeof sdk.protect>;
        const decision = await sdk.protect(...requestArguments);
        switch (decision.conclusion) {
          case "ALLOW": {
            if (bodyError) return failure(onError, bodyError, decision);
            const failedRule = decision.results.find((result) => result.conclusion === "ERROR");
            if (failedRule) {
              return failure(
                onError,
                new Error(
                  failedRule.reason.isError() ? failedRule.reason.message : "An Arcjet rule failed",
                  { cause: failedRule.reason },
                ),
                decision,
              );
            }
            return { status: "allow", allowed: true, decision };
          }
          case "DENY":
          case "CHALLENGE":
            return { status: "deny", allowed: false, decision };
          case "ERROR":
            return failure(
              onError,
              new Error(
                decision.reason.isError() ? decision.reason.message : "Arcjet returned an error",
                { cause: decision.reason },
              ),
              decision,
            );
          default:
            return failure(onError, new Error("Arcjet returned an unsupported decision"), decision);
        }
      } catch (error) {
        return failure(onError, error);
      }
    },
  } satisfies ArcjetSecurity<ExtraProps<Rules> & CharacteristicProps<Characteristics>>);
}
