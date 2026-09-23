import { readBoundedJSON } from "./server/http.ts";
/** Server-side Gemini adapter. Never import credentials into client components. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

export type GenerateOptions = {
  apiKey: string;
  model?: string;
  instructions: string;
  input: string;
  schema: object;
  signal: AbortSignal;
  maxOutputTokens?: number;
};

export async function generateGeminiJSON(
  options: GenerateOptions,
  transport: typeof fetch = fetch,
): Promise<unknown> {
  const model = options.model || DEFAULT_GEMINI_MODEL;
  if (!/^gemini-[a-zA-Z0-9.-]+$/.test(model)) {
    throw new GeminiError("The Gemini model configuration is invalid.", 503);
  }
  const response = await transport(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      signal: options.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.instructions }] },
        contents: [{ role: "user", parts: [{ text: options.input }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: options.schema,
          temperature: 0.2,
          maxOutputTokens: options.maxOutputTokens ?? 7000,
          ...(model.startsWith("gemini-2.5-")
            ? { thinkingConfig: { thinkingBudget: 1024 } }
            : {}),
        },
      }),
    },
  );

  // Do not expose upstream bodies: they can contain account or request details.
  if (!response.ok) {
    if (response.status === 429) {
      throw new GeminiError(
        "Gemini’s quota or rate limit has been reached. Check the API project’s quota and billing, or try again later.",
        429,
      );
    }
    if ([400, 401, 403, 404].includes(response.status)) {
      throw new GeminiError(
        "Gemini rejected the request. Check the server API key, model access, and API restrictions.",
        502,
      );
    }
    throw new GeminiError(
      "Gemini is unavailable right now. Please try again shortly.",
      502,
    );
  }

  let raw: unknown;
  try {
    raw = await readBoundedJSON(response, 15_000, 100_000);
  } catch {
    throw new GeminiError(
      "Gemini returned an invalid response. Please try again.",
      502,
    );
  }
  const result = raw as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  const candidate = result.candidates?.[0];
  if (
    result.promptFeedback?.blockReason ||
    candidate?.finishReason === "SAFETY"
  ) {
    throw new GeminiError(
      "Gemini could not answer this request. Try a different document question.",
      422,
    );
  }
  if (candidate?.finishReason !== "STOP") {
    throw new GeminiError(
      "The AI response was incomplete. Try a shorter document or question.",
      502,
    );
  }
  const output = candidate.content?.parts
    ?.filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  if (!output)
    throw new GeminiError(
      "Gemini did not return a document explanation. Please try again.",
      502,
    );
  try {
    return JSON.parse(output);
  } catch {
    throw new GeminiError(
      "Gemini returned invalid JSON. Please try again.",
      502,
    );
  }
}
