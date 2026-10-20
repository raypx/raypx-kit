import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { integer, jsonb, pgSchema, text } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vite-plus/test";
import { withoutColumns } from "../../src/index.js";
import { buildExplain, summarizePlan } from "../../src/diagnostics.js";
import { isUniqueViolation } from "../../src/errors.js";
import {
  excludedColumns,
  jsonBoolean,
  jsonNumber,
  jsonText,
  jsonType,
  jsonValue,
  type JsonValue,
} from "../../src/postgres.js";
import { first, inserted } from "../../src/results.js";

const uniqueConstraint = "records_owner_key_unique";
const timeout = 30_000;

function defineRecords(schema: string) {
  return pgSchema(schema).table("records", {
    id: integer("record_id").primaryKey(),
    ownerKey: text("owner_key").notNull().unique(uniqueConstraint),
    displayName: text('display"name').notNull(),
    document: jsonb("document").$type<JsonValue>(),
  });
}

async function withDatabase(
  run: (fixture: {
    db: PostgresJsDatabase;
    records: ReturnType<typeof defineRecords>;
  }) => Promise<void>,
): Promise<void> {
  const url = process.env.DRIZZLE_TEST_DATABASE_URL;
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error("Drizzle integration tests run only in GitHub Actions.");
  if (!url?.trim())
    throw new Error("DRIZZLE_TEST_DATABASE_URL is required for Drizzle integration tests.");

  const schema = `kit_drizzle_${randomUUID().replaceAll("-", "")}`;
  const records = defineRecords(schema);
  const client = postgres(url, {
    max: 1,
    connect_timeout: 5,
    connection: { statement_timeout: 5_000, lock_timeout: 2_000 },
  });
  const db = drizzle({ client });
  let created = false;
  try {
    await db.execute(sql`CREATE SCHEMA ${sql.identifier(schema)}`);
    created = true;
    await db.execute(sql`CREATE TABLE ${records} (
      record_id integer PRIMARY KEY,
      owner_key text NOT NULL,
      "display""name" text NOT NULL,
      document jsonb,
      CONSTRAINT ${sql.identifier(uniqueConstraint)} UNIQUE (owner_key)
    )`);
    await run({ db, records });
  } finally {
    try {
      if (created) await db.execute(sql`DROP SCHEMA ${sql.identifier(schema)} CASCADE`);
    } finally {
      await client.end({ timeout: 2 });
    }
  }
}

describe("PostgreSQL public contracts", () => {
  it(
    "extracts literal dot/quote keys and array elements as JSONB and text",
    async () => {
      await withDatabase(async ({ db, records }) => {
        const quotedKey = 'quote"; DROP TABLE records; --';
        await db.insert(records).values({
          id: 1,
          ownerKey: "json-paths",
          displayName: "JSON paths",
          document: { "with.dot": { [quotedKey]: [{ name: "first" }, false] } },
        });

        expect(
          await first(
            db
              .select({
                object: jsonValue(records.document, ["with.dot", quotedKey, "0"]),
                text: jsonText(records.document, ["with.dot", quotedKey, "0", "name"]),
                boolean: jsonValue(records.document, ["with.dot", quotedKey, "1"]),
                type: jsonType(records.document, ["with.dot", quotedKey]),
              })
              .from(records),
          ),
        ).toEqual({ object: { name: "first" }, text: "first", boolean: false, type: "array" });
      });
    },
    timeout,
  );

  it(
    "distinguishes a missing path from JSON null while preserving SQL NULL",
    async () => {
      await withDatabase(async ({ db, records }) => {
        await db.insert(records).values([
          { id: 1, ownerKey: "json-null", displayName: "JSON null", document: { value: null } },
          { id: 2, ownerKey: "sql-null", displayName: "SQL NULL", document: null },
        ]);

        expect(
          await db
            .select({
              id: records.id,
              value: jsonValue(records.document, ["value"]),
              type: jsonType(records.document, ["value"]),
              text: jsonText(records.document, ["value"]),
              missing: jsonValue(records.document, ["missing"]),
              missingType: jsonType(records.document, ["missing"]),
            })
            .from(records)
            .orderBy(records.id),
        ).toEqual([
          { id: 1, value: null, type: "null", text: null, missing: null, missingType: null },
          { id: 2, value: null, type: null, text: null, missing: null, missingType: null },
        ]);
      });
    },
    timeout,
  );

  it(
    "decodes scalar numbers and booleans but returns NULL before incompatible casts",
    async () => {
      await withDatabase(async ({ db, records }) => {
        await db.insert(records).values({
          id: 1,
          ownerKey: "scalars",
          displayName: "Scalars",
          document: {
            count: 7.25,
            zero: 0,
            enabled: false,
            wrongNumber: "not-a-number",
            wrongBoolean: "not-a-boolean",
            object: { count: 1 },
            array: [true],
            nothing: null,
          },
        });

        expect(
          await first(
            db
              .select({
                count: jsonNumber(records.document, ["count"]),
                zero: jsonNumber(records.document, ["zero"]),
                enabled: jsonBoolean(records.document, ["enabled"]),
                wrongNumber: jsonNumber(records.document, ["wrongNumber"]),
                wrongBoolean: jsonBoolean(records.document, ["wrongBoolean"]),
                object: jsonNumber(records.document, ["object"]),
                array: jsonBoolean(records.document, ["array"]),
                nothing: jsonNumber(records.document, ["nothing"]),
                missing: jsonBoolean(records.document, ["missing"]),
              })
              .from(records),
          ),
        ).toEqual({
          count: 7.25,
          zero: 0,
          enabled: false,
          wrongNumber: null,
          wrongBoolean: null,
          object: null,
          array: null,
          nothing: null,
          missing: null,
        });
      });
    },
    timeout,
  );

  it(
    "projects named columns and unwraps real returning/select queries",
    async () => {
      await withDatabase(async ({ db, records }) => {
        const row = await inserted(
          db
            .insert(records)
            .values({
              id: 1,
              ownerKey: "projection",
              displayName: "Visible",
              document: { hidden: true },
            })
            .returning(withoutColumns(records, "document")),
          "insert fixture",
        );
        expect(row).toEqual({ id: 1, ownerKey: "projection", displayName: "Visible" });
        expect(await first(db.select(withoutColumns(records, "document")).from(records))).toEqual(
          row,
        );
        expect(await first(db.select().from(records).where(eq(records.id, 2)))).toBeNull();
      });
    },
    timeout,
  );

  it(
    "UPSERT updates only allowed keys using quoted physical column names",
    async () => {
      await withDatabase(async ({ db, records }) => {
        await db.insert(records).values({
          id: 1,
          ownerKey: "upsert",
          displayName: "Original",
          document: { retained: true },
        });

        const row = await inserted(
          db
            .insert(records)
            .values({
              id: 2,
              ownerKey: "upsert",
              displayName: "Changed",
              document: { overwritten: true },
            })
            .onConflictDoUpdate({
              target: records.ownerKey,
              set: excludedColumns(records, "displayName"),
            })
            .returning(),
          "upsert fixture",
        );
        expect(row).toEqual({
          id: 1,
          ownerKey: "upsert",
          displayName: "Changed",
          document: { retained: true },
        });
        expect(await db.select({ id: records.id }).from(records)).toEqual([{ id: 1 }]);
      });
    },
    timeout,
  );

  it(
    "recognizes a real PostgreSQL unique violation through Drizzle's error wrapper",
    async () => {
      await withDatabase(async ({ db, records }) => {
        await db.insert(records).values({ id: 1, ownerKey: "unique", displayName: "Original" });
        let failure: unknown;
        try {
          await inserted(
            db
              .insert(records)
              .values({ id: 2, ownerKey: "unique", displayName: "Duplicate" })
              .returning(),
            "duplicate fixture",
          );
        } catch (error) {
          failure = error;
        }

        expect(isUniqueViolation(failure, uniqueConstraint)).toBe(true);
        expect(isUniqueViolation(failure, "different_constraint")).toBe(false);
        expect(await db.select({ id: records.id }).from(records)).toEqual([{ id: 1 }]);
      });
    },
    timeout,
  );

  it(
    "estimates an INSERT without executing its write",
    async () => {
      await withDatabase(async ({ db, records }) => {
        const result = await db.execute(
          buildExplain(
            db.insert(records).values({ id: 1, ownerKey: "estimate", displayName: "Not inserted" }),
          ),
        );
        const summary = summarizePlan(result[0]?.["QUERY PLAN"]);

        expect(summary.analyze).toBe(false);
        expect(summary.nodes.length).toBeGreaterThan(0);
        expect(summary.nodes.every((node) => !Object.hasOwn(node, "actualRows"))).toBe(true);
        expect(await first(db.select().from(records))).toBeNull();
      });
    },
    timeout,
  );

  it(
    "executes a write only with explicit ANALYZE and exposes actual metrics",
    async () => {
      await withDatabase(async ({ db, records }) => {
        const options = { analyze: true, buffers: true };
        const result = await db.execute(
          buildExplain(
            db.insert(records).values({ id: 1, ownerKey: "analyze", displayName: "Inserted" }),
            options,
          ),
        );
        const summary = summarizePlan(result[0]?.["QUERY PLAN"], options);

        expect(await first(db.select(withoutColumns(records, "document")).from(records))).toEqual({
          id: 1,
          ownerKey: "analyze",
          displayName: "Inserted",
        });
        expect(summary.analyze).toBe(true);
        expect(summary.nodes.length).toBeGreaterThan(0);
        expect(summary.executionTimeMs).toBeGreaterThanOrEqual(0);
        expect(
          summary.nodes.every(
            (node) =>
              typeof node.actualRows === "number" &&
              Number.isFinite(node.actualRows) &&
              typeof node.actualTotalTimeMs === "number" &&
              Number.isFinite(node.actualTotalTimeMs) &&
              typeof node.actualLoops === "number" &&
              Number.isFinite(node.actualLoops),
          ),
        ).toBe(true);
        expect(
          summary.nodes.some(
            (node) =>
              typeof node.sharedHitBlocks === "number" && typeof node.sharedReadBlocks === "number",
          ),
        ).toBe(true);
      });
    },
    timeout,
  );

  it(
    "summarizes a real filtered plan without returning predicates or bound values",
    async () => {
      await withDatabase(async ({ db, records }) => {
        const privateValue = "private-plan-bound-value";
        await db.insert(records).values({ id: 1, ownerKey: privateValue, displayName: "Private" });
        const options = { analyze: true, buffers: true };
        const result = await db.execute(
          buildExplain(
            db
              .select(withoutColumns(records, "document"))
              .from(records)
              .where(eq(records.ownerKey, privateValue)),
            options,
          ),
        );
        const raw = result[0]?.["QUERY PLAN"];
        expect(JSON.stringify(raw)).toContain(privateValue);
        const summary = summarizePlan(raw, options);

        expect(Object.keys(summary).sort()).toEqual([
          "analyze",
          "executionTimeMs",
          "nodes",
          "planCost",
          "planRows",
          "planningTimeMs",
        ]);
        const allowedNodeKeys = new Set([
          "depth",
          "nodeType",
          "planCost",
          "planRows",
          "relation",
          "index",
          "actualRows",
          "actualTotalTimeMs",
          "actualLoops",
          "sharedHitBlocks",
          "sharedReadBlocks",
        ]);
        for (const node of summary.nodes)
          expect(Object.keys(node).filter((key) => !allowedNodeKeys.has(key))).toEqual([]);
        expect(JSON.stringify(summary)).not.toContain(privateValue);
      });
    },
    timeout,
  );
});
