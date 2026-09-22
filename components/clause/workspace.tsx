"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  Files,
  GitCompareArrows,
  ListChecks,
  LockKeyhole,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { Assistant } from "./assistant";
import { Compare } from "./compare";
import { DocumentDialog } from "./document-dialog";
import { ExportDialog } from "./export-dialog";
import { sample, sampleText, type Review } from "@/lib/sample";
import { type WorkspaceDocument } from "@/lib/documents";

const sampleDocument: WorkspaceDocument = {
  id: "sample",
  text: sampleText,
  review: sample,
  checked: [],
  questions: "",
};
const views = ["overview", "clauses", "compare", "checklist"] as const;
type View = (typeof views)[number];
type ModelTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type ModelContext = {
  registerTool: (
    tool: ModelTool,
    options: { signal: AbortSignal },
  ) => Promise<void> | void;
};

function Navigation({
  view,
  onView,
  docs,
  active,
  onSelect,
  onHelp,
}: {
  view: View;
  onView: (v: View) => void;
  docs: WorkspaceDocument[];
  active: string;
  onSelect: (id: string) => void;
  onHelp: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  function go(v: View) {
    onView(v);
    setOpenMobile(false);
  }
  return (
    <Sidebar>
      <SidebarHeader>
        <a className="brand" href="/" aria-label="Clause home">
          <span>
            <Scale size={22} />
          </span>
          clause<i>.</i>
        </a>
      </SidebarHeader>
      <SidebarContent>
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace">
          <button
            className={
              view === "overview" || view === "clauses" ? "active" : ""
            }
            onClick={() => go("overview")}
          >
            <Files />
            Document review
          </button>
          <button
            className={view === "compare" ? "active" : ""}
            onClick={() => go("compare")}
          >
            <GitCompareArrows />
            Compare documents
          </button>
          <button
            className={view === "checklist" ? "active" : ""}
            onClick={() => go("checklist")}
          >
            <ListChecks />
            My checklist
          </button>
        </nav>
        <div className="nav-divider" />
        <div className="nav-label">SESSION DOCUMENTS</div>
        {docs.map((doc) => (
          <button
            key={doc.id}
            className={`recent-doc ${active === doc.id ? "selected" : ""}`}
            onClick={() => {
              onSelect(doc.id);
              setOpenMobile(false);
            }}
          >
            <FileText />
            <span>
              {doc.id === "sample" ? "Freelance agreement" : doc.review.title}
              <small>
                {doc.review.mode === "sample"
                  ? "Sample document"
                  : doc.review.mode === "ai"
                    ? "AI review"
                    : "Read-only document"}
              </small>
            </span>
          </button>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="privacy-card">
          <ShieldCheck />
          <strong>A little clarity goes a long way.</strong>
          <p>Understand the fine print before your next step.</p>
        </div>
        <button className="help-link" onClick={onHelp}>
          <CircleHelp />
          How Clause works
          <ArrowUpRight size={15} />
        </button>
        <div className="user-block">
          <span className="avatar">Y</span>
          <span>
            Your workspace<small>Personal · Session only</small>
          </span>
          <LockKeyhole size={15} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function Overview({
  review,
  onSource,
  onExplore,
}: {
  review: Review;
  onSource: (id: number) => void;
  onExplore: () => void;
}) {
  const flagged = review.clauses
    .filter((c) => c.attention !== "info")
    .sort(
      (a, b) =>
        (a.attention === "review" ? -1 : 1) -
        (b.attention === "review" ? -1 : 1),
    );
  if (review.mode === "unreviewed")
    return (
      <section className="feature-panel empty-state">
        <BookOpen size={30} />
        <h3>Your document is ready to read.</h3>
        <p>
          No AI analysis has been performed. Open the source excerpts to read
          the original wording, or compare it with another version.
        </p>
        <button className="primary-button" onClick={onExplore}>
          Read source excerpts
          <ChevronRight size={16} />
        </button>
      </section>
    );
  return (
    <>
      <section className="summary-panel">
        <div className="section-title">
          <Sparkles size={18} />
          <h3>The short version</h3>
          <span className="muted-pill">Plain English</span>
        </div>
        <p className="summary-copy">{review.summary}</p>
        {review.mode === "sample" && (
          <div className="summary-facts">
            <div>
              <span>YOUR ROLE</span>
              <strong>Independent designer</strong>
            </div>
            <div>
              <span>PAYMENT</span>
              <strong>$4,800 · 30-day terms</strong>
            </div>
            <div>
              <span>PROJECT TERM</span>
              <strong>Until work is completed</strong>
            </div>
          </div>
        )}
        <button className="source-note" onClick={onExplore}>
          <Check size={14} />
          {review.mode === "sample"
            ? "Prepared from the fictional sample"
            : "AI interpretation · verify against the original"}
          <span>
            View source <ArrowUpRight size={12} />
          </span>
        </button>
      </section>
      <section className="attention-section">
        <div className="section-title">
          <h3>Worth a closer look</h3>
          <span className="text-muted">
            {flagged.length} points of attention
          </span>
        </div>
        {flagged.length === 0 ? (
          <p className="feature-description">
            No points were highlighted in this review. That does not establish
            that the agreement is complete, fair, or enforceable.
          </p>
        ) : (
          flagged.map((c) => (
            <button
              className="risk-card"
              key={c.id}
              onClick={() => onSource(c.id)}
            >
              <span className={`risk-indicator ${c.attention}`} />
              <div>
                <div className="risk-heading">
                  <h4>
                    {review.mode === "sample"
                      ? c.id === 4
                        ? "Ownership transfers before payment"
                        : c.id === 3
                          ? "A short window to end the agreement"
                          : "No limit on revision requests"
                      : c.title}
                  </h4>
                  <span className={`risk-pill ${c.attention}`}>
                    {c.attention === "review" ? "Review carefully" : "Clarify"}
                  </span>
                </div>
                <p>{c.explanation}</p>
                <span className="clause-link">
                  {review.mode === "sample" ? "Clause" : "Source"} {c.id} ·{" "}
                  {c.title}
                  <ArrowUpRight size={13} />
                </span>
              </div>
              <ChevronRight size={17} />
            </button>
          ))
        )}
      </section>
    </>
  );
}

function Explorer({
  review,
  selected,
  onSelect,
}: {
  review: Review;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const focus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected !== null)
      focus.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);
  return (
    <section>
      <div className="explorer-heading">
        <h3>
          {review.mode === "unreviewed"
            ? "Your original document"
            : "The words. And what they mean."}
        </h3>
        <p>
          {review.mode === "sample"
            ? "Open any clause to see the original language and its explanation."
            : "Excerpts preserve your source text. Excerpt numbers are navigation labels, not the document’s original clause numbers."}
        </p>
      </div>
      {review.clauses.map((c) => (
        <div
          key={c.id}
          ref={selected === c.id ? focus : null}
          className={`clause-card ${selected === c.id ? "expanded" : ""}`}
        >
          <button
            className="clause-card-title"
            onClick={() => onSelect(selected === c.id ? -1 : c.id)}
            aria-expanded={selected === c.id}
            aria-controls={`source-${c.id}`}
          >
            <span className="clause-number">
              {String(c.id).padStart(2, "0")}
            </span>
            <span>{c.title}</span>
            {c.attention !== "info" && (
              <span className={`risk-pill ${c.attention}`}>
                {c.attention === "review" ? "Review carefully" : "Clarify"}
              </span>
            )}
            <ChevronRight size={17} />
          </button>
          {selected === c.id && (
            <div className="clause-detail" id={`source-${c.id}`}>
              <div className="detail-label">ORIGINAL WORDING</div>
              <blockquote>{c.text}</blockquote>
              {c.explanation && (
                <>
                  <div className="detail-label teal-text">
                    <Sparkles size={14} />
                    IN PLAIN ENGLISH
                  </div>
                  <p>{c.explanation}</p>
                  <div className="question-callout">
                    <CircleHelp size={17} />
                    <div>
                      <strong>A question to discuss</strong>
                      <p>{c.question}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function Checklist({
  doc,
  onUpdate,
  onExport,
}: {
  doc: WorkspaceDocument;
  onUpdate: (patch: Partial<WorkspaceDocument>) => void;
  onExport: () => void;
}) {
  const count = doc.review.checklist.length;
  return (
    <section className="feature-panel">
      <div className="section-title">
        <ListChecks size={19} />
        <h3>A clearer next step.</h3>
        <span className="muted-pill">
          {doc.checked.length} / {count} prepared
        </span>
      </div>
      <p className="feature-description">
        Use this list to organize a conversation with the other party or a
        qualified lawyer.
      </p>
      {count > 0 ? (
        <>
          <Progress
            className="checklist-progress"
            value={(doc.checked.length / count) * 100}
            aria-label="Preparation progress"
          />
          {doc.review.checklist.map((step, i) => (
            <label
              className={`checklist-item ${doc.checked.includes(i) ? "done" : ""}`}
              key={i}
            >
              <Checkbox
                checked={doc.checked.includes(i)}
                onCheckedChange={(checked) =>
                  onUpdate({
                    checked:
                      checked === true
                        ? [...doc.checked, i]
                        : doc.checked.filter((n) => n !== i),
                  })
                }
              />
              <span>{step}</span>
            </label>
          ))}
        </>
      ) : (
        <p className="inline-notice">
          This document has not been reviewed. You can still record questions
          below and export the original text.
        </p>
      )}
      <label className="field-label personal-notes">
        Your questions & context
        <textarea
          rows={5}
          maxLength={5000}
          placeholder="What would you like to clarify? Add your role, concerns, relevant dates, and what you hope to achieve…"
          value={doc.questions}
          onChange={(e) => onUpdate({ questions: e.target.value })}
        />
      </label>
      <div className="lawyer-note">
        <Scale size={21} />
        <div>
          <h4>Make your time with a lawyer count.</h4>
          <p>
            Bring the full agreement, relevant correspondence, your location,
            and any deadlines. Your exported brief brings these observations and
            questions together.
          </p>
        </div>
      </div>
      <button className="primary-button" onClick={onExport}>
        <ArrowDownToLine size={16} />
        Export preparation brief
      </button>
      <p className="session-note">
        Your checklist and notes stay in this session. Export before refreshing
        or closing the page.
      </p>
    </section>
  );
}

export default function Workspace() {
  const [docs, setDocs] = useState<WorkspaceDocument[]>([sampleDocument]);
  const [active, setActive] = useState("sample");
  const [view, setView] = useState<View>("overview");
  const [selected, setSelected] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const doc = docs.find((d) => d.id === active) || docs[0];
  const { review } = doc;
  const hasReview = review.mode !== "unreviewed";
  const attention = review.clauses.filter((c) => c.attention !== "info").length;
  function updateDoc(patch: Partial<WorkspaceDocument>) {
    setDocs((current) =>
      current.map((d) => (d.id === active ? { ...d, ...patch } : d)),
    );
  }
  function selectDocument(id: string) {
    setActive(id);
    setSelected(null);
    setView("overview");
  }
  function source(id: number) {
    setSelected(id);
    setView("clauses");
  }
  function exportDoc() {
    setExportOpen(true);
  }
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/legal", { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d === "object" && d !== null && "available" in d)
          setAiAvailable(d.available === true);
      })
      .catch(() => {});
    return () => abort.abort();
  }, []);

  // The same operations power both the visible controls and optional browser-agent tools.
  const current = useRef({ doc, view, updateDoc });
  current.current = { doc, view, updateDoc };
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: ModelTool[] = [
      {
        name: "read_clause_workspace",
        title: "Read the active document workspace",
        description:
          "Return the active document title, mode, view, and preparation checklist. Reads session state only.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({
          title: current.current.doc.review.title,
          mode: current.current.doc.review.mode,
          view: current.current.view,
          checklist: current.current.doc.review.checklist.map(
            (text, index) => ({
              index,
              text,
              checked: current.current.doc.checked.includes(index),
            }),
          ),
        }),
      },
      {
        name: "navigate_clause_workspace",
        title: "Open a document view",
        description:
          "Navigate to overview, source excerpts, version comparison, or preparation checklist without changing document data.",
        inputSchema: {
          type: "object",
          properties: { view: { type: "string", enum: views } },
          required: ["view"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const value = (input as { view?: unknown })?.view;
          if (!views.includes(value as View))
            throw new Error("Choose overview, clauses, compare, or checklist.");
          flushSync(() => setView(value as View));
          return { view: value };
        },
      },
      {
        name: "set_clause_checklist_items",
        title: "Update preparation checklist items",
        description:
          "Mark specified checklist indexes as prepared or unprepared in the active document. This changes session state.",
        inputSchema: {
          type: "object",
          properties: {
            indexes: { type: "array", items: { type: "integer" } },
            checked: { type: "boolean" },
          },
          required: ["indexes", "checked"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const data = input as { indexes?: unknown; checked?: unknown };
          if (
            !data ||
            !Array.isArray(data.indexes) ||
            typeof data.checked !== "boolean" ||
            !data.indexes.every(
              (i) =>
                Number.isInteger(i) &&
                i >= 0 &&
                i < current.current.doc.review.checklist.length,
            )
          )
            throw new Error(
              "Provide valid checklist indexes and a boolean checked value.",
            );
          const indexes = data.indexes as number[];
          const checked = data.checked
            ? [...new Set([...current.current.doc.checked, ...indexes])]
            : current.current.doc.checked.filter((i) => !indexes.includes(i));
          flushSync(() => current.current.updateDoc({ checked }));
          return { checked };
        },
      },
    ];
    for (const tool of tools) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser feature. */
      }
    }
    return () => lifecycle.abort();
  }, []);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "232px" } as React.CSSProperties}
    >
      <Navigation
        view={view}
        onView={setView}
        docs={docs}
        active={active}
        onSelect={selectDocument}
        onHelp={() => setHelpOpen(true)}
      />
      <div className="app-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-menu" />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {view === "compare"
                ? "Compare documents"
                : view === "checklist"
                  ? "My checklist"
                  : "Document review"}
            </strong>
          </div>
          <span className="private-label">
            <LockKeyhole size={14} />
            Session-only documents
          </span>
        </header>
        <main className="main-content" id="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">LESS LEGAL JARGON. MORE CLARITY.</div>
              <h1>Understand before you agree.</h1>
              <p>
                Your documents, in plain language. Your next step, with
                confidence.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => setUploadOpen(true)}
            >
              <Plus size={18} />
              New document
            </button>
          </div>
          <div className="sample-banner">
            <span>
              <Sparkles size={16} />
              <strong>
                {review.mode === "sample"
                  ? "Start with a little exploration."
                  : review.mode === "ai"
                    ? "Your review is ready."
                    : "Your words, kept in context."}
              </strong>
              {review.mode === "sample"
                ? "You’re viewing a fictional sample with prepared explanations."
                : review.mode === "ai"
                  ? "AI interpretations may be incomplete. Check the original wording."
                  : "Read the source and compare versions. AI analysis has not been performed."}
            </span>
            <small>
              {review.mode === "sample"
                ? "SAMPLE WORKSPACE"
                : review.mode === "ai"
                  ? "AI REVIEW"
                  : "READ-ONLY"}
            </small>
          </div>
          <section className="document-heading">
            <div className="document-icon">
              <FileText size={25} />
            </div>
            <div>
              <h2>{review.title}</h2>
              <p>
                {review.mode === "sample"
                  ? "Northstar Studio & Alex Morgan"
                  : "Current session"}
                <span>·</span>
                {review.clauses.length}{" "}
                {review.mode === "sample" ? "clauses" : "source excerpts"}
                <span>·</span>
                {review.mode === "sample" ? "English" : "Original text"}
              </p>
            </div>
            <button className="secondary-button" onClick={exportDoc}>
              <ArrowDownToLine size={16} />
              Export brief
            </button>
          </section>
          <div className="stat-grid">
            <div>
              <span className="stat-icon teal">
                <BookOpen size={19} />
              </span>
              <span>
                <strong>
                  {hasReview
                    ? review.clauses.filter((clause) => clause.explanation)
                        .length
                    : "—"}
                </strong>
                <small>Clauses explained</small>
              </span>
            </div>
            <div>
              <span className="stat-icon amber">
                <ShieldCheck size={19} />
              </span>
              <span>
                <strong>{hasReview ? attention : "—"}</strong>
                <small>Points of attention</small>
              </span>
            </div>
            <div>
              <span className="stat-icon purple">
                <ListChecks size={19} />
              </span>
              <span>
                <strong>{hasReview ? review.checklist.length : "—"}</strong>
                <small>Suggested next steps</small>
              </span>
            </div>
            <div>
              <span className="stat-icon blue">
                <GitCompareArrows size={19} />
              </span>
              <span>
                <strong>{hasReview ? "At a glance" : "Read the source"}</strong>
                <small>
                  {hasReview
                    ? "Source-linked explanations"
                    : "No AI review performed"}
                </small>
              </span>
            </div>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList
              variant="line"
              className="document-tabs"
              aria-label="Document views"
            >
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="clauses">
                Clause explorer{" "}
                <span className="count">{review.clauses.length}</span>
              </TabsTrigger>
              <TabsTrigger value="compare">Compare versions</TabsTrigger>
              <TabsTrigger value="checklist">Next steps</TabsTrigger>
            </TabsList>
            <div
              className={`review-grid ${view === "compare" ? "wide-review" : ""}`}
            >
              <div>
                <TabsContent value="overview">
                  <Overview
                    review={review}
                    onSource={source}
                    onExplore={() => {
                      setSelected(review.clauses[0]?.id ?? null);
                      setView("clauses");
                    }}
                  />
                </TabsContent>
                <TabsContent value="clauses">
                  <Explorer
                    review={review}
                    selected={selected}
                    onSelect={setSelected}
                  />
                </TabsContent>
                <TabsContent value="compare">
                  <Compare
                    key={active}
                    original={doc.text}
                    isSample={review.mode === "sample"}
                  />
                </TabsContent>
                <TabsContent value="checklist">
                  <Checklist
                    doc={doc}
                    onUpdate={updateDoc}
                    onExport={exportDoc}
                  />
                </TabsContent>
              </div>
              {view !== "compare" && (
                <Assistant
                  key={active}
                  review={review}
                  text={doc.text}
                  onSource={source}
                />
              )}
            </div>
          </Tabs>
          <footer className="legal-footer">
            <Scale size={15} />
            <p>
              Clarity, not legal advice. Clause helps you understand documents.
              A qualified lawyer can advise on your situation.
            </p>
          </footer>
        </main>
      </div>
      <DocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        aiAvailable={aiAvailable}
        onLoad={(newDoc) => {
          setDocs((d) => [...d, newDoc]);
          selectDocument(newDoc.id);
          toast.success(
            newDoc.review.mode === "ai"
              ? "Your document review is ready."
              : "Document opened in read-only mode.",
          );
        }}
      />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="help-modal">
          <DialogHeader>
            <DialogTitle>A little help with the fine print.</DialogTitle>
            <DialogDescription>
              Clause provides document information and preparation tools, not
              professional legal advice.
            </DialogDescription>
          </DialogHeader>
          <div className="help-sections">
            <section>
              <BookOpen size={22} />
              <div>
                <h3>Start with the source</h3>
                <p>
                  Read original excerpts beside plain-language explanations.
                  Source links let you verify the wording behind an answer.
                </p>
              </div>
            </section>
            <section>
              <Sparkles size={22} />
              <div>
                <h3>A transparent sample</h3>
                <p>
                  The sample agreement is fictional. Its explanations and
                  question responses are prepared examples, not live AI output.
                  Imported documents stay unreviewed unless live AI is
                  configured and you request analysis.
                </p>
              </div>
            </section>
            <section>
              <LockKeyhole size={22} />
              <div>
                <h3>Your session, your documents</h3>
                <p>
                  Documents and notes are held in browser memory and clear on
                  refresh. Text comparison runs locally. Live analysis, when
                  enabled, sends document text to Google Gemini. Export anything
                  you want to keep.
                </p>
              </div>
            </section>
            <section>
              <Scale size={22} />
              <div>
                <h3>Know the limits</h3>
                <p>
                  Clause does not determine enforceability, legal rights, or
                  whether you should sign. Laws vary by location. Bring your
                  questions to a qualified lawyer.
                </p>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <ExportDialog doc={doc} open={exportOpen} onOpenChange={setExportOpen} />
      <Toaster theme="light" position="bottom-right" />
    </SidebarProvider>
  );
}
