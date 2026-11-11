import type { FastifyRequest, FastifyReply } from "fastify";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery defense for a loopback-only service.
 *
 * The Host guard stops DNS rebinding, but not an ordinary malicious page that sends
 * `fetch("http://127.0.0.1:3001/...", { method: "POST", mode: "no-cors" })`. A POST with
 * no body or a multipart body is a CORS "simple request": no preflight runs, the Host
 * header is a valid loopback, and the handler executes its side effect even though the
 * page can never read the response.
 *
 * Browsers always attach `Origin` to cross-origin state-changing requests, so rejecting
 * a present-but-unknown Origin closes that gap. Requests with no Origin at all come
 * from non-browser clients (the MCP server, curl) and are allowed, matching the Host
 * guard's stance. The opaque origin `"null"` is never in the allowlist, so sandboxed
 * frames and file:// pages are rejected too.
 */
export function makeOriginGuard(allowedOrigins: Iterable<string>) {
  const allowed = new Set([...allowedOrigins].map((o) => o.trim()).filter(Boolean));

  return async function originGuard(request: FastifyRequest, reply: FastifyReply) {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (origin === undefined || allowed.has(origin)) return;
    return reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN_ORIGIN", message: "Origin not allowed" },
    });
  };
}
