import { MAX_REQUEST_BYTES } from "../limits.ts";

export class HttpError extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
export function json(
  body: unknown,
  status = 200,
  retryAfter?: number,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
}
/** Bound chunked bodies too; reject malformed UTF-8 and stalled uploads. */
export async function readBoundedJSON(
  request: Request | Response,
  timeoutMs = 10_000,
  maxBytes = MAX_REQUEST_BYTES,
): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes))
    throw new HttpError(413, "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Send valid JSON document text.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const parts: string[] = [];
  let bytes = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      stopped = true;
      reject(new HttpError(408, "The upload timed out. Please try again."));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  const read = async () => {
    while (!stopped) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes)
        throw new HttpError(413, "The request is too large.");
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return JSON.parse(parts.join(""));
  };
  try {
    return await Promise.race([read(), timeout]);
  } catch (error) {
    stopped = true;
    void reader.cancel().catch(() => {});
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Send valid UTF-8 JSON document text.");
  } finally {
    clearTimeout(timer);
  }
}
