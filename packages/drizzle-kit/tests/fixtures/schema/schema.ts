import { index, integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const app = pgSchema("app");

export const users = app.table(
  "users",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("users_created_at_idx").on(table.createdAt)],
);
