import { HttpError } from "./http.ts";

// Conditional writes reserve capacity atomically across Worker instances.
// Denied reservations do not increment the counter; all values are bound.
export const RESERVE_SQL = `INSERT INTO ai_rate_limits (key, count, expires_at)
  VALUES (?, 1, ?)
  ON CONFLICT(key) DO UPDATE SET
    count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
    expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
  WHERE expires_at <= ? OR count < ?
  RETURNING count`;

// D1 batch statements run in one SQLite transaction. changes() belongs to the
// preceding client reservation, so a denied client cannot consume global quota.
const CLIENT_RESERVE_SQL = RESERVE_SQL.replace(
  "VALUES (?, 1, ?)",
  "SELECT ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM ai_rate_limits WHERE key = 'global' AND expires_at > ? AND count >= 120)",
);
const GLOBAL_RESERVE_SQL = RESERVE_SQL.replace(
  "VALUES (?, 1, ?)",
  "SELECT ?, 1, ? WHERE changes() > 0",
);

export async function clientBucket(
  identity: string,
  secret: string,
  now: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(Math.floor(now / 3_600_000) + ":" + identity),
  );
  return (
    "client:" +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")
  );
}

export async function enforceRateLimit(
  db: D1Database | undefined,
  identity: string,
  secret: string,
  now = Date.now(),
) {
  if (!db)
    throw new HttpError(
      503,
      "AI protection is unavailable. Please try again later.",
    );
  try {
    const bucket = await clientBucket(identity, secret, now);
    const result = await db.batch([
      db.prepare("DELETE FROM ai_rate_limits WHERE expires_at <= ?").bind(now),
      db
        .prepare(CLIENT_RESERVE_SQL)
        .bind(bucket, now + 60_000, now, now, now, now, 6),
      db
        .prepare(GLOBAL_RESERVE_SQL)
        .bind("global", now + 3_600_000, now, now, now, 120),
      db.prepare(
        "SELECT count, expires_at FROM ai_rate_limits WHERE key = 'global'",
      ),
    ]);
    if (result[2]?.results?.length) return;
    const global = result[3]?.results?.[0] as
      { count: number; expires_at: number } | undefined;
    if (global && global.count >= 120 && global.expires_at > now)
      throw new HttpError(
        429,
        "The shared demo has reached its hourly AI limit. You can still read, compare, and export documents.",
        Math.max(1, Math.ceil((global.expires_at - now) / 1000)),
      );
    throw new HttpError(
      429,
      "Too many AI requests. Please wait a minute before trying again.",
      60,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      "AI protection is temporarily unavailable. Please try again later.",
      30,
    );
  }
}
