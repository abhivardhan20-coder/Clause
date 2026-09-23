import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedJSON, HttpError } from "../lib/server/http.ts";
import { securityHeaders } from "../lib/server/security.ts";
function streamed(chunks) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    }),
  );
}
test("decodes split multibyte UTF-8 without data loss", async () => {
  const b = new TextEncoder().encode(JSON.stringify({ text: "Clause € 😀" }));
  assert.deepEqual(
    await readBoundedJSON(streamed([...b].map((x) => new Uint8Array([x])))),
    { text: "Clause € 😀" },
  );
});
test("bounds streamed bodies with absent Content-Length", async () => {
  await assert.rejects(
    readBoundedJSON(streamed([new Uint8Array(200001), new Uint8Array(200001)])),
    (e) => e instanceof HttpError && e.status === 413,
  );
});
test("rejects malformed UTF-8, invalid JSON and missing bodies", async () => {
  for (const r of [
    streamed([new Uint8Array([0xff])]),
    new Response("{"),
    new Response(null),
  ])
    await assert.rejects(readBoundedJSON(r), (e) => e.status === 400);
});
test("times out stalled uploads and cancels the reader", async () => {
  let cancelled = false;
  const r = new Response(
    new ReadableStream({
      cancel() {
        cancelled = true;
      },
    }),
  );
  await assert.rejects(readBoundedJSON(r, 10), (e) => e.status === 408);
  assert(cancelled);
});
test("rejects an invalid declared length and honors exact byte bounds", async () => {
  await assert.rejects(
    readBoundedJSON(
      new Response("{}", { headers: { "content-length": "-1" } }),
    ),
    (e) => e.status === 413,
  );
  assert.deepEqual(await readBoundedJSON(new Response("{}"), 100, 2), {});
  await assert.rejects(
    readBoundedJSON(new Response("{}"), 100, 1),
    (e) => e.status === 413,
  );
});
test("production CSP uses nonce without unsafe scripts and denies framing", () => {
  const h = securityHeaders("test-nonce", true);
  const script = h["Content-Security-Policy"]
    .split(";")
    .find((x) => x.trim().startsWith("script-src"));
  assert(script.includes("'nonce-test-nonce'"));
  assert(!script.includes("unsafe"));
  assert(h["Content-Security-Policy"].includes("frame-ancestors 'none'"));
  assert.equal(h["Referrer-Policy"], "no-referrer");
  assert(h["Strict-Transport-Security"]);
  assert.throws(() => securityHeaders("bad'; script-src *", true), /Invalid/);
});
test("development policy permits hot reload without HSTS", () => {
  const h = securityHeaders("local-nonce", false);
  assert(h["Content-Security-Policy"].includes(" ws:"));
  assert.equal(h["Strict-Transport-Security"], undefined);
});
