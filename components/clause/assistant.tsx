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
import { AnswerCache } from "@/lib/answer-cache";
import { MAX_CHAT_MESSAGES, MAX_QUESTION_CHARS } from "@/lib/limits";

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
  const running = useRef(false);
  const cache = useRef(new AnswerCache<{ answer: string; ids: number[] }>());
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (messages.length)
      bottom.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "nearest",
      });
  }, [messages]);
  async function ask(value: string) {
    const q = value.trim();
    if (!q || running.current || review.mode === "unreviewed") return;
    if (q.length > MAX_QUESTION_CHARS) {
      setError("Keep your question under 1,000 characters.");
      return;
    }
    setQuestion("");
    setError("");
    running.current = true;
    setBusy(true);
    setMessages((m) => [
      ...m.slice(-(MAX_CHAT_MESSAGES - 2)),
      { role: "user", text: q },
    ]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const answer =
        review.mode === "sample"
          ? sampleAnswer(q)
          : (cache.current.get(q) ??
            (await requestAI<{ answer: string; ids: number[] }>(
              { action: "question", text, question: q, consent: true },
              abort.signal,
            )));
      if (abort.signal.aborted) return;
      if (review.mode === "ai") cache.current.set(q, answer);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: answer.answer, ids: answer.ids },
      ]);
    } catch (e) {
      if (!abort.signal.aborted) {
        setError(
          e instanceof Error
            ? e.message
            : "Could not answer. Please try again.",
        );
        setQuestion(q);
      }
    } finally {
      running.current = false;
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
          <div
            className="chat-messages"
            role="log"
            aria-label="Document questions and answers"
            aria-live="polite"
            aria-relevant="additions"
          >
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
            <button
              type="button"
              className="text-button"
              onClick={() => {
                controller.current?.abort();
                setError("Request cancelled. You can ask another question.");
              }}
            >
              Cancel
            </button>
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
      {messages.length > 0 && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setMessages([]);
            cache.current.clear();
            setError("");
          }}
        >
          Clear conversation
        </button>
      )}
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
