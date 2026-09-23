import { z } from "zod";
import { MAX_DOCUMENT_CHARS } from "../limits.ts";

const textSchema = z
  .string()
  .min(1)
  .max(MAX_DOCUMENT_CHARS)
  .refine(
    (value) => value.trim().length > 0 && !value.includes("\u0000"),
    "Add readable document text.",
  );
export const inputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("review"),
      title: z.string().trim().min(1).max(100),
      text: textSchema,
      consent: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("question"),
      question: z.string().trim().min(1).max(1000),
      text: textSchema,
      consent: z.literal(true),
    })
    .strict(),
]);
const explanationSchema = z
  .object({
    sourceId: z.number().int().positive(),
    title: z.string().trim().min(1).max(150),
    explanation: z.string().trim().min(1).max(1800),
    attention: z.enum(["review", "clarify", "info"]),
    question: z.string().trim().min(1).max(700),
  })
  .strict();
export const reviewSchema = z
  .object({
    summary: z.string().trim().min(1).max(3500),
    clauses: z.array(explanationSchema).min(1).max(12),
    checklist: z.array(z.string().trim().min(1).max(700)).max(6),
  })
  .strict();
export const answerSchema = z
  .object({
    answer: z.string().trim().min(1).max(6000),
    ids: z.array(z.number().int().positive()).max(15),
  })
  .strict();
const stringField = { type: "string" };
export const reviewFormat = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "clauses", "checklist"],
  properties: {
    summary: stringField,
    clauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "title", "explanation", "attention", "question"],
        properties: {
          sourceId: { type: "integer" },
          title: stringField,
          explanation: stringField,
          attention: { type: "string", enum: ["review", "clarify", "info"] },
          question: stringField,
        },
      },
    },
    checklist: { type: "array", items: stringField },
  },
};
export const answerFormat = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "ids"],
  properties: {
    answer: stringField,
    ids: { type: "array", items: { type: "integer" } },
  },
};
