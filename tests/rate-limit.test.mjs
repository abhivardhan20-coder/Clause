import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { clientBucket, enforceRateLimit } from "../lib/server/rate-limit.ts";
function database() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../drizzle/0000_high_payback.sql", import.meta.url),
      "utf8",
    ).replaceAll("--> statement-breakpoint", ""),
  );
  const db = {
    prepare(query) {
      return {
        all: async () => ({ success: true, results: sql.prepare(query).all() }),
        query,
        values: [],
        bind(...values) {
          return {
            all: async () => ({
              success: true,
              results: sql.prepare(query).all(...values),
            }),
            query,
            values,
          };
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const result = statements.map((s) => ({
          success: true,
          results: sql.prepare(s.query).all(...s.values),
        }));
        sql.exec("COMMIT");
        return result;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db, sql };
}
test("concurrent reservations cannot exceed the client limit", async () => {
  const { db, sql } = database();
  const results = await Promise.allSettled(
    Array.from({ length: 30 }, () =>
      enforceRateLimit(db, "client", "secret", 1000),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 6);
  assert(
    results
      .filter((r) => r.status === "rejected")
      .every((r) => r.reason.status === 429),
  );
  assert.equal(
    sql.prepare("SELECT count FROM ai_rate_limits WHERE key='global'").get()
      .count,
    6,
  );
  sql.close();
});
test("global budget remains bounded across different clients", async () => {
  const { db, sql } = database();
  const results = await Promise.allSettled(
    Array.from({ length: 130 }, (_, i) =>
      enforceRateLimit(db, "client" + i, "secret", 1000),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 120);
  assert.equal(
    sql.prepare("SELECT count FROM ai_rate_limits WHERE key='global'").get()
      .count,
    120,
  );
  assert(
    sql.prepare("SELECT COUNT(*) AS rows FROM ai_rate_limits").get().rows <=
      121,
  );
  sql.close();
});
test("expired buckets reset and expiry cleanup uses its index", async () => {
  const { db, sql } = database();
  for (let i = 0; i < 6; i++)
    await enforceRateLimit(db, "same", "secret", 1000);
  await enforceRateLimit(db, "same", "secret", 61000);
  const key = await clientBucket("same", "secret", 61000);
  assert.equal(
    sql.prepare("SELECT count FROM ai_rate_limits WHERE key=?").get(key).count,
    1,
  );
  assert.match(
    sql
      .prepare(
        "EXPLAIN QUERY PLAN DELETE FROM ai_rate_limits WHERE expires_at <= ?",
      )
      .get(1000).detail,
    /idx_ai_rate_limits_expiry/,
  );
  sql.close();
});
test("stored client identifiers are keyed hashes that rotate hourly", async () => {
  const a = await clientBucket("203.0.113.1", "secret", 1000);
  assert(!a.includes("203.0.113.1"));
  assert.equal(a, await clientBucket("203.0.113.1", "secret", 1000));
  assert.notEqual(a, await clientBucket("203.0.113.1", "secret", 3601000));
  assert.notEqual(a, await clientBucket("203.0.113.1", "other-secret", 1000));
});
test("missing or broken storage fails closed without leaking database errors", async () => {
  await assert.rejects(
    enforceRateLimit(undefined, "x", "s"),
    (e) => e.status === 503,
  );
  await assert.rejects(
    enforceRateLimit(
      {
        prepare() {
          throw new Error("private SQL");
        },
      },
      "x",
      "s",
    ),
    (e) => e.status === 503 && !e.message.includes("SQL"),
  );
});
