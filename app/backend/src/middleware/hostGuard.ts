import type { FastifyRequest, FastifyReply } from "fastify";

/** Extracts the hostname (without port) from a Host header value, handling IPv6 literals. */
export function hostnameFromHostHeader(host: string): string {
  const h = host.trim();
  if (h.startsWith("[")) {
    // IPv6 literal, e.g. "[::1]:3001" or "[::1]"
    const end = h.indexOf("]");
    return end === -1 ? h.slice(1) : h.slice(1, end);
  }
  const colon = h.indexOf(":");
  return colon === -1 ? h : h.slice(0, colon);
}

/**
 * DNS-rebinding defense for a loopback-only service.
 *
 * A rebinding attack forces a victim's browser to send requests to the local backend
 * from a page served on the attacker's own domain (rebound to 127.0.0.1). CORS blocks
 * the attacker from *reading* the response, but the request still executes its side
 * effect. The reliable defense is the Host header: the browser sends the attacker's
 * hostname there, so rejecting any non-loopback Host defeats the attack — without
 * depending on Origin, which legitimate non-browser clients omit. The port is ignored
 * because the backend picks a dynamic one (3001-3100).
 */
export function makeHostGuard(allowedHosts: Iterable<string>) {
  const allowed = new Set(
    [...allowedHosts].map((h) => h.trim().toLowerCase()).filter(Boolean)
  );

  return async function hostGuard(request: FastifyRequest, reply: FastifyReply) {
    const host = request.headers.host;
    if (!host || !allowed.has(hostnameFromHostHeader(host).toLowerCase())) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN_HOST", message: "Host not allowed" },
      });
    }
  };
}
