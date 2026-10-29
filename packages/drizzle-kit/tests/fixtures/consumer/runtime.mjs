import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const binary = join(dirname(require.resolve("@raypx-kit/drizzle-kit")), "bin.cjs");
// Stay inside the installed consumer so config and schema imports find its dependencies.
const root = await mkdtemp(join(process.cwd(), "drizzle-generation-"));
try {
  await writeFile(
    join(root, "drizzle.config.ts"),
    `import { defineConfig } from "@raypx-kit/drizzle-kit";
export default defineConfig({ dialect: "postgresql", schema: "./schema.ts", out: "./migrations" });
`,
  );
  await writeFile(
    join(root, "schema.ts"),
    `import { integer, pgSchema, text } from "drizzle-orm/pg-core";
enum Status { Active = "active" }
export const users = pgSchema("app").table("users", {
  id: integer().primaryKey(),
  status: text().notNull().default(Status.Active),
});
`,
  );
  execFileSync(process.execPath, [binary, "generate", "--config", "drizzle.config.ts"], {
    cwd: root,
    stdio: "pipe",
    timeout: 60_000,
  });
  const output = join(root, "migrations");
  const migrations = (await readdir(output, { recursive: true })).filter((file) =>
    file.endsWith(".sql"),
  );
  assert.equal(migrations.length, 1);
  const sql = await readFile(join(output, migrations[0]), "utf8");
  assert.match(sql, /CREATE TABLE "app"\."users"/);
  assert.match(sql, /DEFAULT 'active'/);
} finally {
  await rm(root, { recursive: true, force: true });
}
