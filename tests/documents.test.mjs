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
