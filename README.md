# Clause

**Understand legal documents, verify the original wording, and prepare a better conversation with a qualified lawyer.**

[Live public app](https://clause-legal-workspace.whole-skink-3843.chatgpt.site) · [Security and privacy](SECURITY.md) · [Testing](TESTING.md)

Clause is a jurisdiction-neutral legal-document workspace built with React 19, TypeScript, Vinext and Cloudflare Workers. Google Gemini 2.5 Flash supplies document explanations through a server-only gateway. The app provides information and preparation assistance, not professional legal advice.

## Main workflow

1. Explore the clearly labeled fictional agreement, or paste/import a UTF-8 TXT/MD document.
2. Open the source locally, or explicitly consent to Gemini analysis.
3. Read a summary and clause explanations with original-source references and visible review coverage.
4. Ask document-grounded questions, compare version wording, and organize a preparation checklist.
5. Export a plain-text brief containing the original document, explanations, notes, and checklist.

No account or API key is needed for the sample, local imports, comparison, or export. The sample uses prepared answers and does not pretend to call a model. Live analysis requires a server key and quota database.

## Run locally

Requires Node 22.13+ and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Documents and notes live only in browser memory. Refreshing clears them; export anything you want to keep. You can remove imported documents or clear conversations.

### Enable live Gemini

1. Copy .env.example to .dev.vars and set GEMINI_API_KEY. GEMINI_MODEL defaults to gemini-2.5-flash. Never use a NEXT_PUBLIC_ key or commit credentials.
2. Build and initialize the local quota database once:

```sh
npm run build
npm run db:local
npm run dev
```

The initial migration must run only once per fresh local database. Later schema changes require new generated migrations; applied migrations are immutable. Production Sites deployments apply the committed migrations automatically.

For hosted deployment, set the API key as a runtime secret through Sites. The logical DB binding is declared in .openai/hosting.json; the hosting platform provisions the database. No document content is written to D1.

GET /api/legal exposes availability and provider only. POST /api/legal accepts review or question actions with explicit consent. Its server gateway uses the [Gemini generateContent API](https://ai.google.dev/api/generate-content) with structured output. Google processing and retention depend on the API account and provider terms.

## Engineering decisions

| Area          | Implementation                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grounding     | Source IDs are validated; duplicate review references fail closed. Original quotations come from input, never a generated quotation. Unexplained excerpts remain visible and explicitly unassessed. |
| Security      | Server-only secrets, strict schemas, Origin/Fetch Metadata checks, bounded UTF-8 streams, upload/provider timeouts, safe text rendering, nonce CSP and sanitized errors.                            |
| Abuse control | Atomic D1 reservations across Worker instances: 6/client/minute and 120 shared/hour. Keyed, rotating client hashes; no raw IPs or document store. Storage errors disable AI calls.                  |
| Efficiency    | Equal-prefix/suffix trimming before bounded LCS; linear source-reference lookup; smaller Q&A output budgets; lazy-loaded secondary tools; bounded per-document answer cache and session state.      |
| Accessibility | Skip link, keyboard-operable dialogs/tabs, explicit labels, announced status/errors, reduced-motion support, contrast-corrected text and responsive layouts.                                        |
| Testing       | Deterministic API/security/unit tests, real SQLite concurrency checks, Playwright against the built Worker, axe-core scans, strict TypeScript and GitHub Actions.                                   |

Quota windows and hashed identifiers are abuse controls, not authentication. A distributed attacker can consume the shared allowance. Provider billing limits remain important. See SECURITY.md for trust boundaries and limitations.

## Validation

```sh
npm run typecheck
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
npm run bench
node scripts/check-source.mjs
```

On Windows the browser suite uses installed Microsoft Edge; Linux CI installs Chromium. Browser tests mock Gemini responses so CI never needs credentials or real documents.

Verified locally on 23 September 2026: 57 core tests and 9 production-browser tests passed; library coverage was 93.79% lines and 93.87% branches. Desktop/mobile overview, import-dialog and export-dialog axe scans reported no violations under the tested WCAG rule sets. The 200% text-resize and real-download checks also passed. npm audit reported zero known vulnerabilities across production and development dependencies. These checks do not establish complete accessibility conformance or legal accuracy.

A local 50-run before/after benchmark measured a one-line edit in 500 lines at 7.32 ms before and 0.063 ms after; fully changed versions improved from 2.406 ms to 2.206 ms. Run npm run bench on your hardware; these figures are observations, not guaranteed latency.

## Scope and limits

- Up to 60,000 characters, 100 excerpts, 500 comparison lines per version, and 10 session documents.
- TXT/MD or pasted text; no PDF/DOCX extraction or OCR.
- AI explains up to 12 selected excerpts, not necessarily every clause. Coverage is disclosed in the interface and exported brief.
- Text comparison reports wording changes, not their legal effect.
- No legal research, jurisdiction-specific conclusions, enforceability decisions, or advice about signing.
- AI can make mistakes. Source links establish wording provenance, not correctness of interpretation.
- Short-lived browser caches avoid repeat requests; nothing persists across refreshes. Gemini may have its own retention policies.

## Code map

- components/clause/ — workspace, source explorer, import, chat, comparison, checklist, export
- lib/documents.ts — bounded source splitting, comparison, export, HTTP client
- lib/answer-cache.ts — bounded per-document LRU cache
- lib/server/legal.ts — testable AI request handler
- lib/server/schemas.ts / prompts.ts — validation and document-only model instructions
- lib/server/rate-limit.ts / db/schema.ts / drizzle/ — persistent abuse counters and generated migrations
- lib/gemini.ts — fixed-endpoint Gemini transport and safe provider errors
- proxy.ts / lib/server/security.ts — fresh CSP nonces and browser security headers
- tests/ / .github/workflows/ci.yml — unit, integration, browser and accessibility checks

Keep the Sites hosting metadata and build integration when deploying this project.
