import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { isUniqueViolation } from "@raypx-kit/drizzle/errors";
import { first, inserted } from "@raypx-kit/drizzle/results";

const require = createRequire(import.meta.url);
for (const name of ["drizzle-orm", "postgres"])
  assert.throws(
    () => require.resolve(name),
    (error) =>
      error instanceof Error &&
      ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(error.code) &&
      error.message.includes(name),
  );

const violation = { code: "23505", constraint_name: "records_id_key" };
assert.equal(isUniqueViolation(violation, "records_id_key"), true);
assert.equal(isUniqueViolation(violation, "records_name_key"), false);

const row = { id: "record-1" };
assert.equal(await first(Promise.resolve([row])), row);
assert.equal(await first(Promise.resolve([])), null);
assert.equal(await inserted(Promise.resolve([row]), "insertRecord"), row);
await assert.rejects(
  inserted(Promise.resolve([]), "insertRecord"),
  /insertRecord did not return a row\./,
);

for (const entry of [
  "@raypx-kit/drizzle",
  "@raypx-kit/drizzle/postgres",
  "@raypx-kit/drizzle/diagnostics",
])
  await assert.rejects(
    import(entry),
    (error) =>
      error instanceof Error &&
      ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(error.code) &&
      error.message.includes("drizzle-orm"),
  );
