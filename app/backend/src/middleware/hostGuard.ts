import type { FastifyRequest, FastifyReply } from "fastify";
import { FORBIDDEN_HOST_RESPONSE, isAllowedHost, toAllowedHostSet } from "@dnd/shared";

export { hostnameFromHostHeader } from "@dnd/shared";

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
  const allowed = toAllowedHostSet(allowedHosts);

  return async function hostGuard(request: FastifyRequest, reply: FastifyReply) {
    if (!isAllowedHost(request.headers.host, allowed)) {
      return reply.status(403).send(FORBIDDEN_HOST_RESPONSE);
    }
  };
}
