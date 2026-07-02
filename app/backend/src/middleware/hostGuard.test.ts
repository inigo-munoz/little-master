import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { makeHostGuard, hostnameFromHostHeader } from "./hostGuard.js";

describe("hostnameFromHostHeader", () => {
  it("strips the port from IPv4 and hostname values", () => {
    expect(hostnameFromHostHeader("127.0.0.1:3001")).toBe("127.0.0.1");
    expect(hostnameFromHostHeader("localhost:3050")).toBe("localhost");
    expect(hostnameFromHostHeader("attacker.example")).toBe("attacker.example");
  });

  it("handles IPv6 literals with and without a port", () => {
    expect(hostnameFromHostHeader("[::1]:3001")).toBe("::1");
    expect(hostnameFromHostHeader("[::1]")).toBe("::1");
  });
});

describe("makeHostGuard", () => {
  async function appWith(allowed: string[]) {
    const app = Fastify({ logger: false });
    app.addHook("onRequest", makeHostGuard(allowed));
    app.get("/ping", async () => ({ ok: true }));
    await app.ready();
    return app;
  }

  it("allows loopback hosts on any port", async () => {
    const app = await appWith(["127.0.0.1", "localhost", "::1"]);
    for (const host of ["127.0.0.1:3001", "localhost:3050", "[::1]:9"]) {
      const res = await app.inject({ method: "GET", url: "/ping", headers: { host } });
      expect(res.statusCode).toBe(200);
    }
    await app.close();
  });

  it("rejects a rebound attacker host with 403", async () => {
    const app = await appWith(["127.0.0.1", "localhost", "::1"]);
    const res = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { host: "attacker.example:3001" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN_HOST");
    await app.close();
  });

  it("rejects an empty Host header", async () => {
    const app = await appWith(["127.0.0.1"]);
    const res = await app.inject({ method: "GET", url: "/ping", headers: { host: "" } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
