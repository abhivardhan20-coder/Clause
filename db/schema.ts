import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
// Only short-lived abuse counters. No documents, questions, or raw IP addresses.
export const aiRateLimits = sqliteTable(
  "ai_rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("idx_ai_rate_limits_expiry").on(table.expiresAt)],
);
