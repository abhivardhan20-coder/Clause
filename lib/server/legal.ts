import { splitSources } from "../documents.ts";
import {
  generateGeminiJSON,
  GeminiError,
  DEFAULT_GEMINI_MODEL,
} from "../gemini.ts";
import {
  inputSchema,
  reviewSchema,
  answerSchema,
  reviewFormat,
  answerFormat,
} from "./schemas.ts";
import { legalInstructions } from "./prompts.ts";
import { HttpError, json, readBoundedJSON } from "./http.ts";
import { enforceRateLimit } from "./rate-limit.ts";

export type LegalRuntime = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  DB?: D1Database;
};
type Dependencies = {
  generate?: typeof generateGeminiJSON;
  limit?: typeof enforceRateLimit;
};
/** Runtime binding stays at the route edge; business rules are directly testable. */
export function createLegalHandler(
  runtime: () => LegalRuntime,
  dependencies: Dependencies = {},
) {
  const generate = dependencies.generate ?? generateGeminiJSON;
  const limit = dependencies.limit ?? enforceRateLimit;
  return async function handle(request: Request): Promise<Response> {
    try {
      if (request.method !== "POST")
        throw new HttpError(405, "Use POST for document analysis.");
      const origin = request.headers.get("origin");
      const site = request.headers.get("sec-fetch-site");
      if (
        origin !== new URL(request.url).origin ||
        (site && site !== "same-origin" && site !== "none")
      )
        throw new HttpError(403, "Send requests from the Clause website.");
      if (
        request.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() !== "application/json"
      )
        throw new HttpError(415, "Send JSON document text.");
      if (
        request.headers.get("content-encoding") &&
        request.headers.get("content-encoding") !== "identity"
      )
        throw new HttpError(415, "Compressed uploads are not supported.");
      const parsed = inputSchema.safeParse(await readBoundedJSON(request));
      if (!parsed.success)
        throw new HttpError(
          400,
          "Check your document, question, and consent. Documents support up to 60,000 characters.",
        );
      const input = parsed.data;
      let sources;
      try {
        sources = splitSources(input.text);
      } catch {
        throw new HttpError(
          400,
          "Use up to 100 source excerpts. Import a shorter section.",
        );
      }
      if (!sources.length)
        throw new HttpError(400, "The document contains no readable text.");
      const { GEMINI_API_KEY: key, GEMINI_MODEL: model, DB: db } = runtime();
      if (!key)
        throw new HttpError(
          503,
          "Live AI is not connected. You can still read, compare, and export documents.",
        );
      // Cloudflare overwrites this header at its edge. Do not trust user-supplied IDs or X-Forwarded-For.
      const identity = request.headers.get("cf-connecting-ip") || "unknown";
      await limit(db, identity, key);
      request.signal.throwIfAborted();
      const output = await generate({
        apiKey: key,
        model: model || DEFAULT_GEMINI_MODEL,
        instructions: legalInstructions(input.action),
        input: JSON.stringify({
          sources,
          ...(input.action === "question" ? { question: input.question } : {}),
        }),
        schema: input.action === "review" ? reviewFormat : answerFormat,
        maxOutputTokens: input.action === "review" ? 7000 : 2000,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
      });
      const ids = new Set(sources.map((s) => s.id));
      if (input.action === "question") {
        const answer = answerSchema.parse(output);
        if (answer.ids.some((id) => !ids.has(id)))
          throw new Error("Invalid reference");
        return json({ ...answer, ids: [...new Set(answer.ids)] });
      }
      const review = reviewSchema.parse(output);
      const explanations = new Map(review.clauses.map((c) => [c.sourceId, c]));
      if (
        explanations.size !== review.clauses.length ||
        review.clauses.some((c) => !ids.has(c.sourceId))
      )
        throw new Error("Invalid reference");
      return json({
        title: input.title,
        summary: review.summary,
        mode: "ai",
        checklist: review.checklist,
        // Quotes always come from input, including leading/trailing source whitespace.
        clauses: sources.map((source) => {
          const explanation = explanations.get(source.id);
          return {
            id: source.id,
            text: source.text,
            title: explanation?.title || "Source excerpt " + source.id,
            explanation: explanation?.explanation || "",
            attention: explanation?.attention || "info",
            question: explanation?.question || "",
          };
        }),
      });
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status, error.retryAfter);
      if (error instanceof GeminiError)
        return json(
          { error: error.message },
          error.status,
          error.status === 429 ? 60 : undefined,
        );
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      )
        return json(
          {
            error:
              "The AI request was cancelled or timed out. Please try again.",
          },
          504,
        );
      return json(
        {
          error:
            "The AI response could not be validated. Your original document is unchanged. Please try again.",
        },
        502,
      );
    }
  };
}
