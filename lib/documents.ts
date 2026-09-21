import type { Review } from "./sample";

export const MAX_DOCUMENT_CHARS = 60_000;
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
  const chunks: string[] = [];
  for (const paragraph of text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .filter((p) => p.trim())) {
    for (let start = 0; start < paragraph.length; start += 1800) {
      chunks.push(paragraph.slice(start, start + 1800));
    }
  }
  if (chunks.length > 100)
    throw new Error(
      "This document has too many sections. Import a shorter section (up to 100 excerpts).",
    );
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
/** Bounded LCS comparison preserves the actual wording and original line order. */
export function compareText(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n/g, "\n").split("\n");
  const b = after.replace(/\r\n/g, "\n").split("\n");
  if (a.length > 500 || b.length > 500)
    throw new Error(
      "Compare up to 500 lines per version. Split larger documents into sections.",
    );
  const table = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const result: DiffLine[] = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j])
      (result.push({ kind: "same", text: a[i++] }), j++);
    else if (
      i < a.length &&
      (j === b.length || table[i + 1][j] >= table[i][j + 1])
    )
      result.push({ kind: "removed", text: a[i++] });
    else result.push({ kind: "added", text: b[j++] });
  }
  return result;
}

export async function readTextFile(file: File): Promise<string> {
  if (!/\.(txt|md)$/i.test(file.name))
    throw new Error(
      "Please choose a .txt or .md file, or paste text copied from your document.",
    );
  if (file.size > 240_000)
    throw new Error("The file is too large. Use up to 60,000 characters.");
  const text = await file.text();
  if (text.includes("\u0000") || text.includes("\ufffd"))
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
    signal,
  });
  const data = await res.json();
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
