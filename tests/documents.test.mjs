import test from "node:test";
import assert from "node:assert/strict";
import {
  compareText,
  createUnreviewed,
  makeBrief,
  readTextFile,
  splitSources,
} from "../lib/documents.ts";
import {
  sample,
  sampleAnswer,
  sampleText,
  revisedSample,
} from "../lib/sample.ts";

test("long source paragraphs preserve exact text, with stable references", () => {
  const text = "A".repeat(4300);
  const sources = splitSources(text);
  assert.equal(sources.map((s) => s.text).join(""), text);
  assert.deepEqual(
    sources.map((s) => s.id),
    [1, 2, 3],
  );
  assert.throws(
    () => splitSources(Array(102).fill("Section").join("\n\n")),
    /too many/,
  );
});

test("comparison reconstructs both inputs, including repeats and deletions", () => {
  for (const [a, b] of [
    ["one\ntwo\none", "one\nthree\none"],
    ["a\nb", ""],
    ["", "a\nb"],
    [sampleText, revisedSample],
    [sampleText, sampleText],
  ]) {
    const diff = compareText(a, b);
    assert.equal(
      diff
        .filter((d) => d.kind !== "added")
        .map((d) => d.text)
        .join("\n"),
      a,
    );
    assert.equal(
      diff
        .filter((d) => d.kind !== "removed")
        .map((d) => d.text)
        .join("\n"),
      b,
    );
  }
  assert.throws(
    () => compareText(Array(502).fill("line").join("\n"), "other"),
    /500 lines/,
  );
});

test("import does not manufacture AI results", () => {
  const doc = createUnreviewed(
    "Test",
    "Pay 20 days after receipt.\n\nNo renewals.",
  );
  assert.equal(doc.mode, "unreviewed");
  assert.equal(doc.summary, "");
  assert.deepEqual(doc.checklist, []);
  assert(doc.clauses.every((c) => !c.explanation));
});

test("file validation rejects unsupported, empty, binary and oversized content", async () => {
  assert.equal(
    await readTextFile(new File(["Hello"], "agreement.txt")),
    "Hello",
  );
  await assert.rejects(
    readTextFile(new File(["%PDF"], "agreement.pdf")),
    /\.txt/,
  );
  await assert.rejects(readTextFile(new File([" "], "empty.txt")), /empty/);
  await assert.rejects(
    readTextFile(new File(["\u0000"], "binary.txt")),
    /UTF-8/,
  );
  await assert.rejects(
    readTextFile(new File(["a".repeat(60_001)], "long.txt")),
    /60,000/,
  );
});

test("sample answers cite valid sources and decline legal determinations", () => {
  assert.deepEqual(sampleAnswer("When will I get paid?").ids, [2, 4]);
  assert.deepEqual(sampleAnswer("Can I end this agreement?").ids, [3]);
  assert.deepEqual(sampleAnswer("Should I sign this?").ids, []);
  assert.match(
    sampleAnswer("Does the agreement mention insurance?").answer,
    /sample walkthrough/,
  );
});

test("brief includes provenance, source text, notes, and checkbox state", () => {
  const brief = makeBrief({
    id: "sample",
    text: sampleText,
    review: sample,
    checked: [1],
    questions: "Clarify the notice period.",
  });
  assert(brief.includes("ILLUSTRATIVE SAMPLE"));
  assert(brief.includes("[x] " + sample.checklist[1]));
  assert(brief.includes(sampleText));
  assert(brief.includes("Clarify the notice period."));
});

test("randomized diffs reconstruct both inputs and handle normalized line endings", () => {
  let seed = 42;
  const next = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed;
  };
  for (let run = 0; run < 200; run++) {
    const a = Array.from({ length: (next() % 20) + 1 }, () =>
      String(next() % 5),
    ).join("\n");
    const b = Array.from({ length: (next() % 20) + 1 }, () =>
      String(next() % 5),
    ).join("\n");
    const diff = compareText(a, b);
    assert.equal(
      diff
        .filter((d) => d.kind !== "added")
        .map((d) => d.text)
        .join("\n"),
      a,
    );
    assert.equal(
      diff
        .filter((d) => d.kind !== "removed")
        .map((d) => d.text)
        .join("\n"),
      b,
    );
  }
  assert.deepEqual(
    compareText("a\r\nb", "a\nb").map((d) => d.kind),
    ["same", "same"],
  );
});
test("splitting avoids broken Unicode characters and enforces character limits", () => {
  const source = "a".repeat(1799) + "😀" + "b".repeat(1900);
  const parts = splitSources(source);
  assert.equal(parts.map((s) => s.text).join(""), source);
  assert(parts.every((s) => !/[\uD800-\uDBFF]$/.test(s.text)));
  assert.throws(() => splitSources("a".repeat(60001)), /60,000/);
  assert.throws(() => compareText("a".repeat(60001), "a"), /60,000/);
});
test("UTF-8 decoding rejects invalid bytes and accepts a genuine replacement character", async () => {
  await assert.rejects(
    readTextFile(new File([new Uint8Array([255, 254, 0])], "invalid.txt")),
    /UTF-8/,
  );
  assert.equal(
    await readTextFile(new File(["A replacement symbol: \ufffd"], "valid.txt")),
    "A replacement symbol: \ufffd",
  );
});
