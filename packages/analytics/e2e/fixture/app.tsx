import type { AnalyticsClient, AnalyticsConsent } from "@raypx-kit/analytics";
import { createBrowserAnalytics } from "@raypx-kit/analytics/browser";
import {
  AnalyticsErrorBoundary,
  AnalyticsProvider,
  useAnalytics,
} from "@raypx-kit/analytics/react";
import { useState } from "react";

function createClient() {
  return createBrowserAnalytics({
    token: "phc_local_browser_contract",
    host: new URL("/__analytics_e2e/", location.origin).href,
    environment: "browser-test",
    release: "e2e-release",
    assetOrigins: [location.origin],
    policy: (event, properties) =>
      event === "view_opened"
        ? {
            surface: "fixture",
            attempt: typeof properties.attempt === "number" ? properties.attempt : 0,
          }
        : null,
  });
}

function ProductActions() {
  const analytics = useAnalytics();
  const [attempts, setAttempts] = useState(0);
  return (
    <section aria-label="Product actions">
      <output data-testid="attempts">{attempts}</output>
      <button
        onClick={() => {
          const attempt = attempts + 1;
          setAttempts(attempt);
          analytics.capture("view_opened", {
            attempt,
            email: "private@example.com",
            rawUrl: location.href,
          });
        }}
      >
        Track view
      </button>
      <button onClick={() => analytics.capture("unregistered_event", { private: "do not send" })}>
        Track unknown event
      </button>
      <button onClick={() => analytics.identify("internal-e2e-user")}>Identify user</button>
      <button
        onClick={() => {
          setTimeout(() => {
            throw new Error("private-browser-error");
          }, 0);
        }}
      >
        Throw browser error
      </button>
      <button
        onClick={() => {
          void Promise.reject(new Error("private-rejection-error"));
        }}
      >
        Reject browser promise
      </button>
    </section>
  );
}

function Crash({ active }: { active: boolean }) {
  if (active) throw new Error("private-render-error");
  return <p>Product view is healthy</p>;
}

function ErrorView({ client }: { client: AnalyticsClient }) {
  const [crash, setCrash] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <section aria-label="Error boundary">
      <button onClick={() => setCrash(true)}>Crash product view</button>
      <button
        onClick={() => {
          setCrash(false);
          setRevision((value) => value + 1);
        }}
      >
        Recover product view
      </button>
      <AnalyticsErrorBoundary
        key={revision}
        client={client}
        fallback={<p role="alert">The product view could not load.</p>}
      >
        <Crash active={crash} />
      </AnalyticsErrorBoundary>
    </section>
  );
}

export function App() {
  const [client, setClient] = useState(createClient);
  const [consent, setConsent] = useState<AnalyticsConsent>({ usage: false, errors: false });
  const [disposed, setDisposed] = useState(false);
  const updateConsent = (next: AnalyticsConsent) => {
    client.setConsent(next);
    setConsent(next);
  };
  return (
    <AnalyticsProvider client={client}>
      <main>
        <h1>Analytics browser contract</h1>
        <output data-testid="consent">{`usage:${consent.usage};errors:${consent.errors};disposed:${disposed}`}</output>
        <button onClick={() => updateConsent({ usage: true, errors: false })}>Allow usage</button>
        <button onClick={() => updateConsent({ usage: false, errors: true })}>
          Allow errors only
        </button>
        <button onClick={() => updateConsent({ usage: true, errors: true })}>Allow both</button>
        <button onClick={() => updateConsent({ usage: false, errors: false })}>
          Revoke consent
        </button>
        <button
          onClick={() => {
            client.dispose();
            setDisposed(true);
          }}
        >
          Dispose analytics
        </button>
        <button
          onClick={() => {
            client.dispose();
            setClient(createClient());
            setConsent({ usage: false, errors: false });
            setDisposed(false);
          }}
        >
          Create new client
        </button>
        <ProductActions />
        <ErrorView client={client} />
      </main>
    </AnalyticsProvider>
  );
}
