"use client";
import { useState } from "react";
import { GitCompareArrows, Plus, Minus, Check } from "lucide-react";
import {
  compareText,
  MAX_DOCUMENT_CHARS,
  type DiffLine,
} from "@/lib/documents";
import { revisedSample } from "@/lib/sample";

export function Compare({
  original,
  isSample,
}: {
  original: string;
  isSample: boolean;
}) {
  const [before, setBefore] = useState(original);
  const [after, setAfter] = useState("");
  const [diff, setDiff] = useState<DiffLine[] | null>(null);
  const [error, setError] = useState("");
  const added = diff?.filter((d) => d.kind === "added").length || 0;
  const removed = diff?.filter((d) => d.kind === "removed").length || 0;
  function run() {
    try {
      if (!before.trim() || !after.trim())
        throw new Error("Add text to both versions before comparing.");
      setDiff(compareText(before, after));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setDiff(null);
    }
  }
  return (
    <section className="feature-panel">
      <div className="section-title">
        <GitCompareArrows size={19} />
        <h3>See exactly what changed.</h3>
      </div>
      <p className="feature-description">
        Compare the wording of two versions side by side. This comparison does
        not assess the legal effect of a change.
      </p>
      <div className="compare-editors">
        <label className="field-label">
          Original version
          <textarea
            value={before}
            onChange={(e) => {
              setBefore(e.target.value);
              setDiff(null);
            }}
            maxLength={MAX_DOCUMENT_CHARS}
            rows={9}
          />
        </label>
        <label className="field-label">
          Revised version
          <textarea
            value={after}
            onChange={(e) => {
              setAfter(e.target.value);
              setDiff(null);
            }}
            maxLength={MAX_DOCUMENT_CHARS}
            rows={9}
            placeholder="Paste the updated version here…"
          />
        </label>
      </div>
      <div className="compare-actions">
        <button className="primary-button" onClick={run}>
          <GitCompareArrows size={16} />
          Compare versions
        </button>
        {isSample && (
          <button
            className="text-button"
            onClick={() => {
              setAfter(revisedSample);
              setDiff(null);
              setError("");
            }}
          >
            Try example changes
            <Plus size={14} />
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {diff && (
        <div className="diff-result" aria-live="polite">
          <div className="diff-legend">
            {added + removed === 0 ? (
              <span>
                <Check size={15} />
                The wording is identical.
              </span>
            ) : (
              <>
                <span className="added">
                  <Plus size={15} />
                  {added} added {added === 1 ? "line" : "lines"}
                </span>
                <span className="removed">
                  <Minus size={15} />
                  {removed} removed {removed === 1 ? "line" : "lines"}
                </span>
              </>
            )}
          </div>
          <div className="diff-lines">
            {diff.map((d, i) => (
              <div key={i} className={`diff-line ${d.kind}`}>
                <span aria-label={d.kind}>
                  {d.kind === "added" ? "+" : d.kind === "removed" ? "−" : " "}
                </span>
                <pre>{d.text || " "}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
