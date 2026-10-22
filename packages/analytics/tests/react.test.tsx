import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { StrictMode } from "react";
import { createNoopAnalytics } from "../src/index.js";
import { AnalyticsProvider, useAnalytics } from "../src/react.js";
afterEach(cleanup);
it("borrows one client across StrictMode mounts without changing consent", () => {
  const client = { ...createNoopAnalytics(), setConsent: vi.fn(), dispose: vi.fn() };
  const seen: unknown[] = [];
  function Child() {
    seen.push(useAnalytics());
    return null;
  }
  const view = render(
    <StrictMode>
      <AnalyticsProvider client={client}>
        <Child />
      </AnalyticsProvider>
    </StrictMode>,
  );
  expect(seen.every((value) => value === client)).toBe(true);
  view.unmount();
  expect(client.setConsent).not.toHaveBeenCalled();
  expect(client.dispose).not.toHaveBeenCalled();
});
