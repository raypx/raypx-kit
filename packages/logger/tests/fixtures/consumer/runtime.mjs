import assert from "node:assert/strict";
import { createLogger, initLogger } from "@raypx-kit/logger";
import { getLogger, runWithLogger, useLogger } from "@raypx-kit/logger/context";
import { createDrainPipeline } from "@raypx-kit/logger/pipeline";

const events = [];
const drain = createDrainPipeline({ batch: { size: 10, intervalMs: 60_000 } })((batch) => {
  events.push(...batch);
});
initLogger({
  silent: true,
  pretty: false,
  redact: { paths: ["credentials.password"], builtins: false, replacement: "[hidden]" },
  drain,
});
assert.equal(getLogger(), undefined);
await Promise.all(
  ["first", "second"].map((requestId) => {
    const logger = createLogger({ requestId, credentials: { password: "fixture-secret" } });
    return runWithLogger(logger, async () => {
      await new Promise((resolve) => setTimeout(resolve, requestId === "first" ? 5 : 1));
      assert.equal(useLogger(), logger);
      useLogger().set({ completed: requestId });
      logger.emit();
    });
  }),
);
assert.equal(getLogger(), undefined);
await drain.flush();
assert.equal(events.length, 2);
for (const { event } of events) {
  assert.equal(event.completed, event.requestId);
  assert.equal(event.credentials.password, "[hidden]");
}
