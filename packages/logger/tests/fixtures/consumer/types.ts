import {
  createError,
  createLogger,
  createRequestLogger,
  initLogger,
  parseError,
  type DrainContext,
  type LoggerConfig,
} from "@raypx-kit/logger";
import { getLogger, runWithLogger, useLogger } from "@raypx-kit/logger/context";
import { createDrainPipeline, type PipelineDrainFn } from "@raypx-kit/logger/pipeline";

const drain: PipelineDrainFn<DrainContext> = createDrainPipeline<DrainContext>()((batch) => {
  const service: string | undefined = batch[0]?.event.service;
  void service;
});
const config: LoggerConfig = { silent: true, redact: true, drain };
initLogger(config);
const logger = createLogger<{ job: { id: string; count: number } }>({ job: { id: "sync" } });
logger.set({ job: { count: 1 } });
// @ts-expect-error Typed fields must retain their value types through the wrapper.
logger.set({ job: { count: "one" } });
const result: number = runWithLogger(logger, () => {
  useLogger<{ job: { id: string; count: number } }>().set({ job: { count: 2 } });
  getLogger()?.set({ source: "consumer" });
  return 42;
});
void result;
const request = createRequestLogger({ method: "GET", path: "/health", requestId: "check" });
request.error(createError({ message: "Unavailable", status: 503, why: "Dependency failed" }));
const status: number = parseError(new Error("failed")).status;
void status;
request.emit();
logger.emit();
await drain.flush();
