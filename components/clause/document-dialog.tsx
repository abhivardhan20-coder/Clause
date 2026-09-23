"use client";
import { useEffect, useRef, useState } from "react";
import { FileUp, LoaderCircle, LockKeyhole } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createUnreviewed,
  MAX_DOCUMENT_CHARS,
  readTextFile,
  requestAI,
  type WorkspaceDocument,
} from "@/lib/documents";
import type { Review } from "@/lib/sample";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onLoad: (doc: WorkspaceDocument) => void;
  aiAvailable: boolean;
};
export function DocumentDialog({
  open,
  onOpenChange,
  onLoad,
  aiAvailable,
}: Props) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function close(value: boolean) {
    if (!value) controller.current?.abort();
    onOpenChange(value);
  }
  async function load(analyze: boolean) {
    if (running.current) return;
    setError("");
    if (!text.trim() || text.length > MAX_DOCUMENT_CHARS) {
      setError("Add between 1 and 60,000 characters of document text.");
      return;
    }
    if (analyze && !consent) {
      setError("Please confirm that the text may be sent for AI analysis.");
      return;
    }
    running.current = true;
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const name = title.trim() || "Untitled agreement";
      const review = analyze
        ? await requestAI<Review>(
            { action: "review", title: name, text, consent: true },
            abort.signal,
          )
        : createUnreviewed(name, text);
      if (abort.signal.aborted) return;
      onLoad({
        id: crypto.randomUUID(),
        text,
        review,
        checked: [],
        questions: "",
      });
      onOpenChange(false);
      setTitle("");
      setText("");
      setConsent(false);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Could not open this document.",
        );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="document-modal">
        <DialogHeader>
          <DialogTitle>Let’s make sense of your document.</DialogTitle>
          <DialogDescription>
            Paste the text or import a text file. Opening a document keeps it in
            this session only.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={upload}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="sr-only"
          aria-label="Upload a text document"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setText(await readTextFile(f));
              setTitle(f.name.replace(/\.[^.]+$/, ""));
              setError("");
            } catch (err) {
              setError((err as Error).message);
            }
            e.target.value = "";
          }}
        />
        <button
          className="upload-area"
          onClick={() => upload.current?.click()}
          disabled={busy}
        >
          <FileUp size={25} />
          <strong>Choose a document</strong>
          <span>.txt or .md · up to 60,000 characters</span>
        </button>
        <label className="field-label" htmlFor="document-name">
          Document name
          <input
            id="document-name"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. My freelance agreement"
            disabled={busy}
          />
        </label>
        <label className="field-label" htmlFor="document-text">
          Document text
          <textarea
            id="document-text"
            aria-label="Document text"
            value={text}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "document-error" : undefined}
            maxLength={MAX_DOCUMENT_CHARS}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your agreement here…"
            rows={7}
            disabled={busy}
          />
          <span className="field-count">
            {text.length.toLocaleString()} / 60,000 characters
          </span>
        </label>
        {aiAvailable ? (
          <label className="consent-row">
            <Checkbox
              disabled={busy}
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
            />
            <span>
              Send this document to Google Gemini for analysis. Remove personal
              or confidential information you do not want processed.
            </span>
          </label>
        ) : (
          <div className="inline-notice">
            <LockKeyhole size={17} />
            <p>
              Live AI isn’t connected yet. You can read your own document and
              compare its text, or explore the prepared sample review.
            </p>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert" id="document-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={() => load(false)}
            disabled={busy || !text.trim()}
          >
            Open document
          </button>
          {aiAvailable && (
            <button
              className="primary-button"
              disabled={busy || !consent || !text.trim()}
              onClick={() => load(true)}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : null}Analyze
              document
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
