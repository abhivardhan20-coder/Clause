import test from "node:test";
import assert from "node:assert/strict";
import { generateGeminiJSON, GeminiError } from "../lib/gemini.ts";

const input = {
  apiKey: "test-key",
  instructions: "Explain only the source.",
  input: "Test document.",
  schema: { type: "object" },
  signal: new AbortController().signal,
};

test("uses a server header, separates instructions, and parses structured output", async () => {
  const result = await generateGeminiJSON(input, async (url, options) => {
    assert.equal(
      url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    assert(!url.includes(input.apiKey));
    assert.equal(options.headers["x-goog-api-key"], input.apiKey);
    const body = JSON.parse(options.body);
    assert.equal(body.systemInstruction.parts[0].text, input.instructions);
    assert.equal(body.contents[0].parts[0].text, input.input);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    return Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { thought: true, text: "not output" },
              { text: '{"answer":"Grounded answer","ids":[1]}' },
            ],
          },
        },
      ],
    });
  });
  assert.deepEqual(result, { answer: "Grounded answer", ids: [1] });
});

test("rejects truncated, blocked, and invalid JSON responses", async () => {
  await assert.rejects(
    generateGeminiJSON(input, async () =>
      Response.json({
        candidates: [
          { finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } },
        ],
      }),
    ),
    /incomplete/,
  );
  await assert.rejects(
    generateGeminiJSON(input, async () =>
      Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
    ),
    /could not answer/,
  );
  await assert.rejects(
    generateGeminiJSON(input, async () =>
      Response.json({
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: "not json" }] } },
        ],
      }),
    ),
    GeminiError,
  );
});

test("sanitizes provider errors and preserves quota status", async () => {
  await assert.rejects(
    generateGeminiJSON(
      input,
      async () =>
        new Response("private upstream account details", { status: 429 }),
    ),
    (e) =>
      e instanceof GeminiError &&
      e.status === 429 &&
      !e.message.includes("private"),
  );
  await assert.rejects(
    generateGeminiJSON(
      input,
      async () =>
        new Response("private upstream account details", { status: 403 }),
    ),
    /key, model access/,
  );
  await assert.rejects(
    generateGeminiJSON({ ...input, model: "../other-service" }, async () => {
      throw new Error("must not fetch");
    }),
    /configuration is invalid/,
  );
});
