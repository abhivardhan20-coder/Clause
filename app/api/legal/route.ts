import { env } from "cloudflare:workers";
import { createLegalHandler, type LegalRuntime } from "@/lib/server/legal";
import { json } from "@/lib/server/http";

const runtime = () => env as unknown as LegalRuntime;
export function GET() {
  const { GEMINI_API_KEY, DB } = runtime();
  return json({
    available: Boolean(GEMINI_API_KEY && DB),
    provider: "Google Gemini",
  });
}
export const POST = createLegalHandler(runtime);
