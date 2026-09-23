# Security and privacy

Clause is a public, document-focused information prototype. It does not establish enforceability or replace a qualified legal professional. Source references verify where wording came from; they do not prove an AI interpretation is correct.

## Trust boundaries

- The browser holds documents, notes and short-lived answer caches in memory. Refreshing clears them; removing a document removes its current workspace state. There is no server document store.
- Text comparison and the illustrative sample run locally. Live AI requires explicit consent and sends the document and current question to Google Gemini. Each question is independent.
- The API key exists only in runtime secrets. It is sent to the fixed Google API endpoint in an HTTPS header, never in a URL or a browser bundle.
- Document text and questions are untrusted data. System instructions are separate from user content. The model has no tools, browser, database, or access to application secrets. Prompt instructions reduce misuse but cannot guarantee correct interpretation.
- Strict schemas bound requests and model output. Quotes are copied from the original source, not generated. Unknown, duplicate review citations and unsupported output fields are rejected.
- Plain React text nodes render source and model output; no raw HTML or Markdown execution is used.

## Abuse and browser protections

- Public requests require a matching Origin and reject cross-site Fetch Metadata. These checks help browser security; they are not authentication.
- D1 conditional writes enforce six accepted reservations per client per minute and 120 shared AI reservations per hour across Worker instances. Failed provider calls still consume a reservation. The provider's billing controls remain the final spending control.
- Client buckets use HMAC-SHA256 with the server key and an hourly period. Raw IPs and document content are not stored. Expired counters are removed during the next AI request; infrastructure backups may retain older database state.
- Cloudflare's edge-provided client IP is used. Custom user-ID and forwarded-IP headers are ignored. People behind one address share a quota.
- Missing or failing quota storage disables AI calls rather than falling back to unlimited requests. The local sample, comparison, and export remain usable.
- Request bodies are limited to 400,000 bytes, 60,000 document characters and 100 excerpts. Streamed uploads time out, malformed UTF-8 is rejected, and provider responses are bounded.
- Production HTML uses fresh script nonces, framing restrictions, no-referrer, MIME sniffing protection and restricted browser capabilities. Inline styles remain necessary for the component library. Responses containing documents or a nonce are not cached.
- Session document and chat counts are bounded. Answers are cached only within the current document component, for five minutes and at most 20 entries. No shared AI result cache exists.

## Limits and reporting

A distributed botnet can still consume the shared demo allowance. There is no CAPTCHA or account-based entitlement. Quotas are conservative prototype controls, not a paid-service billing system. Gemini processing and retention depend on Google's terms and the API account.

Keep confidential documents out of a public demo unless their processing is authorized. Revoke any exposed API key in the provider console and replace the runtime secret. Never put real documents, credentials, or vulnerabilities containing secrets into a public issue; contact the repository owner privately.
