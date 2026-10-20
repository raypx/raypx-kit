import { sql } from "drizzle-orm";
import { integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vite-plus/test";
import {
  buildExplain,
  DrizzleDiagnosticError,
  type ExplainOptions,
} from "../../src/diagnostics.js";

describe("PostgreSQL EXPLAIN construction", () => {
  const dialect = new PgDialect();
  it("preserves bound values and defaults to a JSON estimate", () => {
    expect(dialect.sqlToQuery(buildExplain(sql`SELECT ${"private-value"}`))).toEqual({
      sql: "EXPLAIN (FORMAT JSON) SELECT $1",
      params: ["private-value"],
    });
  });
  it("requires explicit execution before collecting buffer metrics", () => {
    expect(
      dialect.sqlToQuery(buildExplain(sql`SELECT 1`, { analyze: true, buffers: true })).sql,
    ).toBe("EXPLAIN (FORMAT JSON, ANALYZE true, BUFFERS true) SELECT 1");
  });
  it.each([
    { options: {}, prefix: "EXPLAIN (FORMAT JSON)" },
    {
      options: { analyze: true, buffers: true },
      prefix: "EXPLAIN (FORMAT JSON, ANALYZE true, BUFFERS true)",
    },
  ])("keeps INSERT builders unparenthesized with bound values: $prefix", ({ options, prefix }) => {
    const records = pgTable("records", {
      id: integer("record_id"),
      displayName: text("display_name"),
    });
    const statement = drizzle
      .mock()
      .insert(records)
      .values([
        { id: 1, displayName: "first" },
        { id: 2, displayName: "second" },
      ]);

    expect(dialect.sqlToQuery(buildExplain(statement, options))).toEqual({
      sql: `${prefix} insert into "records" ("record_id", "display_name") values ($1, $2), ($3, $4)`,
      params: [1, "first", 2, "second"],
    });
  });
  it.each([null, [], { analyze: "yes" }, { buffers: true }, { format: "text" }])(
    "rejects malformed or unsupported options: %j",
    (options) => {
      expect(() => buildExplain(sql`SELECT 1`, options as ExplainOptions)).toThrow(
        new DrizzleDiagnosticError("INVALID_OPTIONS"),
      );
    },
  );
});
