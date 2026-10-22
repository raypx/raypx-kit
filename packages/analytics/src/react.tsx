import { Component, createContext, useContext, type ReactNode, type ErrorInfo } from "react";
import { createNoopAnalytics, type AnalyticsClient } from "./index.js";
const context = createContext<AnalyticsClient>(createNoopAnalytics());
export function AnalyticsProvider({
  client,
  children,
}: {
  client: AnalyticsClient;
  children: ReactNode;
}) {
  return <context.Provider value={client}>{children}</context.Provider>;
}
export function useAnalytics(): AnalyticsClient {
  return useContext(context);
}
export class AnalyticsErrorBoundary extends Component<
  { client: AnalyticsClient; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.client.captureException(error);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
