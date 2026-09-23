/** Nonce is generated per response and forwarded to Vinext's CSP-aware renderer. */
export function securityHeaders(
  nonce: string,
  production: boolean,
): Record<string, string> {
  if (!/^[a-zA-Z0-9+/=_-]+$/.test(nonce)) throw new Error("Invalid CSP nonce");
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'nonce-" +
      nonce +
      "'" +
      (production ? "" : " 'unsafe-eval'"),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'" + (production ? "" : " ws:"),
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  return {
    "Content-Security-Policy": policy,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=()",
    ...(production
      ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
      : {}),
  };
}
