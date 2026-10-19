import type { SQL } from "drizzle-orm";
import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { withoutColumns } from "@raypx-kit/drizzle";
import {
  excludedColumn,
  excludedColumns,
  jsonBoolean,
  jsonNumber,
  jsonText,
  jsonType,
  jsonValue,
  type JsonType,
  type JsonValue,
} from "@raypx-kit/drizzle/postgres";

const records = pgTable("records", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  document: jsonb("document"),
});

// Checked against the installed tarball, without workspace source aliases.
export function postgresEntryContract() {
  const projection = withoutColumns(records, "id");
  const update = excludedColumns(records, "displayName");
  const path = ["settings", "enabled"] as const;
  const expressions = {
    value: jsonValue(records.document, path),
    text: jsonText(records.document, path),
    type: jsonType(records.document, path),
    number: jsonNumber(records.document, path),
    boolean: jsonBoolean(records.document, path),
  };

  // @ts-expect-error Omitted columns are unavailable in the projection.
  projection.id;
  // @ts-expect-error Update mappings expose only explicitly selected columns.
  update.id;
  // @ts-expect-error Projection keys must exist on the supplied table.
  withoutColumns(records, "missing");
  // @ts-expect-error Update keys must exist on the supplied table.
  excludedColumns(records, "missing");
  // @ts-expect-error SQL identifiers must be strings.
  excludedColumn(42);
  // @ts-expect-error A JSON source must implement SQLWrapper.
  jsonValue("document", path);
  // @ts-expect-error JSON paths contain string segments.
  jsonText(records.document, [42]);

  return { projection, update, identifier: excludedColumn("display_name"), ...expressions };
}

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Condition extends true> = Condition;
type IsAny<Value> = 0 extends 1 & Value ? true : false;
type Contract = ReturnType<typeof postgresEntryContract>;

export type ProjectionInference = Assert<
  Equal<Contract["projection"], Pick<(typeof records)["_"]["columns"], "displayName" | "document">>
>;
export type UpdateInference = Assert<Equal<Contract["update"], Record<"displayName", SQL>>>;
export type IdentifierInference = Assert<Equal<Contract["identifier"], SQL>>;
export type JsonValueIsTyped = Assert<Equal<IsAny<JsonValue>, false>>;
export type JsonTypeIsTyped = Assert<Equal<IsAny<JsonType>, false>>;
export type JsonValueInference = Assert<Equal<Contract["value"], SQL<JsonValue>>>;
export type JsonTextInference = Assert<Equal<Contract["text"], SQL<string | null>>>;
export type JsonTypeInference = Assert<Equal<Contract["type"], SQL<JsonType | null>>>;
export type JsonNumberInference = Assert<Equal<Contract["number"], SQL<number | null>>>;
export type JsonBooleanInference = Assert<Equal<Contract["boolean"], SQL<boolean | null>>>;
