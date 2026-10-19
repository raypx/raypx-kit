import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { sql } from "drizzle-orm";
import { PgDialect, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { withoutColumns } from "@raypx-kit/drizzle";
import {
  buildExplain,
  DrizzleDiagnosticError,
  summarizePlan,
} from "@raypx-kit/drizzle/diagnostics";
import { excludedColumns, jsonValue } from "@raypx-kit/drizzle/postgres";

const require = createRequire(import.meta.url);
assert.throws(
  () => require.resolve("postgres"),
  (error) =>
    error instanceof Error &&
    ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(error.code) &&
    error.message.includes("postgres"),
);

const records = pgTable("records", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  document: jsonb("document"),
});
const columns = withoutColumns(records, "id");
assert.deepEqual(Object.keys(columns).sort(), ["displayName", "document"]);
assert.equal(columns.displayName, records.displayName);

const dialect = new PgDialect();
assert.deepEqual(dialect.sqlToQuery(excludedColumns(records, "displayName").displayName), {
  sql: 'excluded."display_name"',
  params: [],
});
const path = ["with.dot", 'quote"; DROP TABLE records; --'];
assert.deepEqual(dialect.sqlToQuery(jsonValue(sql`document`, path)), {
  sql: "(document #> ARRAY[$1, $2]::text[])",
  params: path,
});

assert.deepEqual(dialect.sqlToQuery(buildExplain(sql`SELECT ${"private-bound-value"}`)), {
  sql: "EXPLAIN (FORMAT JSON) SELECT $1",
  params: ["private-bound-value"],
});
assert.deepEqual(
  summarizePlan([
    {
      Plan: {
        "Node Type": "Result",
        "Total Cost": 1,
        "Plan Rows": 1,
        Filter: "private-bound-value",
      },
    },
  ]),
  {
    analyze: false,
    planCost: 1,
    planRows: 1,
    nodes: [{ depth: 0, nodeType: "Result", planCost: 1, planRows: 1 }],
  },
);
assert.throws(
  () => buildExplain(sql`SELECT 1`, { buffers: true }),
  (error) => error instanceof DrizzleDiagnosticError && error.code === "INVALID_OPTIONS",
);
assert.throws(
  () => summarizePlan([]),
  (error) => error instanceof DrizzleDiagnosticError && error.code === "INVALID_PLAN",
);
