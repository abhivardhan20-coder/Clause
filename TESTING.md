# Validation

Run with Node 22.13+ after npm ci. The deterministic test suite makes no paid API calls and uses synthetic documents only.

- npm run typecheck — strict TypeScript across application, tests and configuration.
- npm test — source preservation, randomized diff reconstruction, UTF-8 import, request validation, consent, origin/media-type checks, streamed size limits, timeout cancellation, grounded citations, provider error redaction, LRU expiry and cache bounds.
- npm run test:coverage — native V8 coverage for application library files; generated reports are not committed.
- npm run build — actual Cloudflare-compatible production output.
- npm run test:e2e — Playwright against the built Worker, including document consent, citation navigation, text-only rendering of hostile markup, comparison, cache reuse, session removal, keyboard navigation, CSP nonces, mobile sizing and axe-core WCAG checks.
- npm run bench — repeatable median/p95 timings on maximum supported inputs. Results depend on hardware; there is no brittle wall-clock pass threshold.
- node scripts/check-source.mjs — source-size guard and credential-pattern scan.

The quota tests execute the generated migration and production SQL against real SQLite, including concurrent reservations and index use. They model D1's transactional batch semantics; production D1 integration is checked separately.

Browser tests mock only /api/legal responses so they do not consume Gemini quota. They still execute the real built HTML, JavaScript, styles, middleware and interactions. Node API tests exercise the handler with injected model/storage boundaries. Neither proves model correctness.

Before deployment, use an authorized fictional agreement to check one real review and one real question. Verify the returned original wording and source references. Do not run live tests on confidential documents or in public CI. A valid key and initialized local D1 are required.

Automated accessibility checks cannot establish complete WCAG conformance. Manual keyboard, zoom, mobile and screen-reader checks remain useful. CI reports build/test failures and retains browser traces only on failed runs; do not run these tests with real documents.
