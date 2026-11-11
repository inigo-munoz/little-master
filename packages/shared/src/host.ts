// Host-header checks shared by the loopback-only services (backend and MCP server).
// They defend against DNS rebinding: the attacker's page reaches 127.0.0.1 under its
// own hostname, and the browser puts that hostname in the Host header.

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

/** Normalizes a list of allowed hostnames (trimmed, lowercased, empties dropped). */
export function toAllowedHostSet(allowedHosts: Iterable<string>): ReadonlySet<string> {
  return new Set([...allowedHosts].map((h) => h.trim().toLowerCase()).filter(Boolean));
}

/** True when the Host header names an allowed hostname. The port is ignored. */
export function isAllowedHost(host: string | undefined, allowed: ReadonlySet<string>): boolean {
  return !!host && allowed.has(hostnameFromHostHeader(host).toLowerCase());
}

export const FORBIDDEN_HOST_RESPONSE = {
  success: false,
  error: { code: "FORBIDDEN_HOST", message: "Host not allowed" },
} as const;
