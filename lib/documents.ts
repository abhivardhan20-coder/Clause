import type { Review } from "./sample";

import {
  MAX_DOCUMENT_CHARS,
  MAX_SOURCE_CHARS,
  MAX_SOURCES,
  MAX_COMPARE_LINES,
} from "./limits.ts";
export { MAX_DOCUMENT_CHARS } from "./limits.ts";
export type Source = { id: number; text: string };
export type WorkspaceDocument = {
  id: string;
  text: string;
  review: Review;
  checked: number[];
  questions: string;
};

/** Never drops source text: long paragraphs are divided into contiguous excerpts. */
export function splitSources(text: string): Source[] {
  if (text.length > MAX_DOCUMENT_CHARS)
    throw new Error("Use a document with up to 60,000 characters.");
  const chunks: string[] = [];
  for (const paragraph of text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .filter((p) => p.trim())) {
    for (let start = 0; start < paragraph.length;) {
      let end = Math.min(start + MAX_SOURCE_CHARS, paragraph.length);
      if (end < paragraph.length && /[\uD800-\uDBFF]/.test(paragraph[end - 1]))
        end--;
      chunks.push(paragraph.slice(start, end));
      if (chunks.length > MAX_SOURCES)
        throw new Error(
          "This document has too many sections. Import up to 100 excerpts.",
        );
      start = end;
    }
  }
  return chunks.map((text, i) => ({ id: i + 1, text }));
}

export function createUnreviewed(title: string, text: string): Review {
  return {
    title,
    summary: "",
    mode: "unreviewed",
    checklist: [],
    clauses: splitSources(text).map((s) => ({
      ...s,
      title: `Source excerpt ${s.id}`,
      explanation: "",
      question: "",
      attention: "info",
    })),
  };
}

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };
/** Strip identical edges before bounded LCS: localized edits avoid a full matrix. */
export function compareText(before: string, after: string): DiffLine[] {
  if (before.length > MAX_DOCUMENT_CHARS || after.length > MAX_DOCUMENT_CHARS)
    throw new Error("Compare up to 60,000 characters per version.");
  const a = before.replace(/\r\n/g, "\n").split("\n");
  const b = after.replace(/\r\n/g, "\n").split("\n");
  if (a.length > MAX_COMPARE_LINES || b.length > MAX_COMPARE_LINES)
    throw new Error(
      "Compare up to 500 lines per version. Split larger documents into sections.",
    );
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix])
    prefix++;
  let aEnd = a.length,
    bEnd = b.length;
  while (aEnd > prefix && bEnd > prefix && a[aEnd - 1] === b[bEnd - 1]) {
    aEnd--;
    bEnd--;
  }
  const rows = aEnd - prefix,
    cols = bEnd - prefix,
    width = cols + 1;
  const table = new Uint16Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i--) {
    const row = i * width;
    const nextRow = row + width;
    const line = a[prefix + i];
    for (let j = cols - 1; j >= 0; j--)
      table[row + j] =
        line === b[prefix + j]
          ? table[nextRow + j + 1] + 1
          : Math.max(table[nextRow + j], table[row + j + 1]);
  }
  const result: DiffLine[] = a
    .slice(0, prefix)
    .map((text) => ({ kind: "same", text }));
  let i = 0,
    j = 0;
  while (i < rows || j < cols) {
    if (i < rows && j < cols && a[prefix + i] === b[prefix + j]) {
      result.push({ kind: "same", text: a[prefix + i++] });
      j++;
    } else if (
      i < rows &&
      (j === cols || table[(i + 1) * width + j] >= table[i * width + j + 1])
    ) {
      result.push({ kind: "removed", text: a[prefix + i++] });
    } else {
      result.push({ kind: "added", text: b[prefix + j++] });
    }
  }
  return result.concat(
    a.slice(aEnd).map((text) => ({ kind: "same" as const, text })),
  );
}

export async function readTextFile(file: File): Promise<string> {
  if (!/\.(txt|md)$/i.test(file.name))
    throw new Error(
      "Please choose a .txt or .md file, or paste text copied from your document.",
    );
  if (file.size > 240_000)
    throw new Error("The file is too large. Use up to 60,000 characters.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error(
      "This file is not readable UTF-8 text. Copy and paste its text instead.",
    );
  }
  if (text.includes("\u0000"))
    throw new Error(
      "This file is not readable UTF-8 text. Copy and paste the document text instead.",
    );
  if (!text.trim())
    throw new Error("This document is empty. Add some text first.");
  if (text.length > MAX_DOCUMENT_CHARS)
    throw new Error("Use a document with up to 60,000 characters.");
  return text;
}

export function makeBrief(doc: WorkspaceDocument): string {
  const { review } = doc;
  const mode =
    review.mode === "sample"
      ? "ILLUSTRATIVE SAMPLE — fictional agreement, prepared explanations"
      : review.mode === "ai"
        ? "AI-GENERATED REVIEW — verify all interpretations against the original"
        : "UNREVIEWED DOCUMENT — no AI analysis has been performed";
  return [
    `CLAUSE | ${review.title}`,
    mode,
    "Jurisdiction-neutral document information. This is not professional legal advice or an assessment of enforceability.",
    ...(review.summary ? ["SUMMARY", review.summary] : []),
    "REVIEW COVERAGE",
    review.clauses.filter((c) => c.explanation).length +
      " of " +
      review.clauses.length +
      " source excerpts explained. Unexplained excerpts have not been assessed.",
    "SOURCE EXCERPTS & EXPLANATIONS",
    ...review.clauses.map((c) =>
      [
        `SOURCE ${c.id}: ${c.title}`,
        `Original: ${c.text}`,
        ...(c.explanation
          ? [
              `Explanation: ${c.explanation}`,
              `Attention: ${c.attention}`,
              `Question to discuss: ${c.question}`,
            ]
          : []),
      ].join("\n"),
    ),
    "PREPARATION CHECKLIST",
    ...review.checklist.map(
      (s, i) => `[${doc.checked.includes(i) ? "x" : " "}] ${s}`,
    ),
    "MY QUESTIONS & CONTEXT",
    doc.questions.trim() || "(No personal notes added.)",
    "FOR A LEGAL PROFESSIONAL",
    "Confirm the applicable jurisdiction, your role, what you want to achieve, relevant dates, and whether anything has already been signed. Bring the full original document and relevant correspondence.",
    "FULL ORIGINAL DOCUMENT",
    doc.text,
  ].join("\n\n");
}

export function downloadBrief(doc: WorkspaceDocument): void {
  const url = URL.createObjectURL(
    new Blob([makeBrief(doc)], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${doc.review.title.replace(/[^a-z0-9]/gi, "-").slice(0, 80)}-brief.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function requestAI<T>(
  body: object,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch("/api/legal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(75_000)])
      : AbortSignal.timeout(75_000),
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      "The server returned an unreadable response. Your document is unchanged. Please try again.",
    );
  }
  if (!res.ok)
    throw new Error(
      typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
        ? data.error
        : "The request could not be completed. Please try again.",
    );
  return data as T;
}
