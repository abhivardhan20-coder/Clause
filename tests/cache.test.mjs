import test from "node:test";
import assert from "node:assert/strict";
import { AnswerCache } from "../lib/answer-cache.ts";
test("bounded cache evicts least-recently used answers", () => {
  const c = new AnswerCache(2, 100);
  c.set("a", 1, 0);
  c.set("b", 2, 0);
  assert.equal(c.get("a", 1), 1);
  c.set("c", 3, 2);
  assert.equal(c.get("b", 3), undefined);
  assert.equal(c.get("a", 3), 1);
});
test("expiry, replacement and clear prevent stale answers", () => {
  const c = new AnswerCache(2, 100);
  c.set("a", 1, 0);
  assert.equal(c.get("a", 100), undefined);
  c.set("a", 2, 101);
  c.set("a", 3, 102);
  assert.equal(c.get("a", 103), 3);
  c.clear();
  assert.equal(c.get("a", 104), undefined);
  assert.throws(() => new AnswerCache(0));
});
