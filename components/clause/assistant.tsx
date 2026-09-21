"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { sampleAnswer, type Review } from "@/lib/sample";
import { requestAI } from "@/lib/documents";

type Message = { role: "user" | "assistant"; text: string; ids?: number[] };
export function Assistant({
  review,
  text,
  onSource,
}: {
  review: Review;
  text: string;
  onSource: (id: number) => void;
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (messages.length)
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);
  async function ask(value: string) {
    const q = value.trim();
    if (!q || busy || review.mode === "unreviewed") return;
    if (q.length > 1000) {
      setError("Keep your question under 1,000 characters.");
      return;
    }
    setQuestion("");
    setError("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: q }]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const answer =
        review.mode === "sample"
          ? sampleAnswer(q)
          : await requestAI<{ answer: string; ids: number[] }>(
              { action: "question", text, question: q, consent: true },
              abort.signal,
            );
      setMessages((m) => [
        ...m,
        { role: "assistant", text: answer.answer, ids: answer.ids },
      ]);
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <span className="assistant-mark">
          <Sparkles size={19} />
        </span>
        <div>
          <h3>A clearer answer</h3>
          <p>Ask about this document</p>
        </div>
      </div>
      <div className="assistant-body">
        {messages.length === 0 ? (
          <>
            <div className="assistant-welcome">
              <Sparkles size={17} />
              <p>
                Legal language can be a lot.
                <br />
                Let’s break it down together.
              </p>
            </div>
            <p className="assistant-hint">
              {review.mode === "unreviewed"
                ? "AI analysis is needed before you can ask questions about this document."
                : "Explore a question to get started."}
            </p>
            {review.mode !== "unreviewed" &&
              [
                "What should I look out for?",
                "When will I get paid?",
                "Can I end this agreement?",
              ].map((q) => (
                <button
                  className="suggested-question"
                  key={q}
                  onClick={() => ask(q)}
                >
                  {q}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            <div className="grounding-note">
              <BookOpen size={17} />
              <p>
                Answers stay grounded in your document, with source excerpts you
                can check.
              </p>
            </div>
          </>
        ) : (
          <div className="chat-messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`chat-message ${m.role}`}>
                <strong>
                  {m.role === "user"
                    ? "You"
                    : review.mode === "sample"
                      ? "Clause · sample answer"
                      : "Clause · AI answer"}
                </strong>
                <p>{m.text}</p>
                {m.ids && m.ids.length > 0 && (
                  <div className="citations">
                    {m.ids.map((id) => (
                      <button key={id} onClick={() => onSource(id)}>
                        <BookOpen size={12} />
                        {review.mode === "sample" ? "Clause" : "Source"} {id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottom} />
          </div>
        )}
        {busy && (
          <p className="chat-loading" role="status">
            <LoaderCircle size={15} className="spin" />
            Reading your document…
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <input
          aria-label="Ask about this agreement"
          placeholder="Ask about your document…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1000}
          disabled={busy || review.mode === "unreviewed"}
        />
        <button
          aria-label="Send question"
          disabled={!question.trim() || busy || review.mode === "unreviewed"}
        >
          <ArrowUp size={17} />
        </button>
      </form>
      <p className="chat-caption">
        {review.mode === "sample"
          ? "Sample mode · Prepared answers, not live AI"
          : review.mode === "ai"
            ? "AI can make mistakes. Check the source."
            : "Read-only document · AI not connected"}
      </p>
    </aside>
  );
}
