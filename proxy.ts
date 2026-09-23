import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "./lib/server/security";

export function proxy(request: NextRequest) {
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))),
  );
  const headers = securityHeaders(nonce, process.env.NODE_ENV === "production");
  const forwarded = new Headers(request.headers);
  forwarded.set("Content-Security-Policy", headers["Content-Security-Policy"]);
  const response = NextResponse.next({ request: { headers: forwarded } });
  for (const [name, value] of Object.entries(headers))
    response.headers.set(name, value);
  // A document response carrying a nonce must never be reused by a shared cache.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: ["/", "/api/:path*"] };
