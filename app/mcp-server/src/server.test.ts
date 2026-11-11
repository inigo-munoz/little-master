import { describe, it, expect, vi, afterEach } from "vitest";
import { buildServer } from "./server.js";

const LOOPBACK = ["127.0.0.1", "localhost", "::1"];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MCP server Host guard", () => {
  it("rejects a DNS-rebinding request carrying a foreign Host before any tool runs", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const app = await buildServer({ allowedHosts: LOOPBACK, logger: false });

    const res = await app.inject({
      method: "POST",
      url: "/tools/create_npc",
      headers: { host: "attacker.example:3002" },
      payload: { campaignId: "c1", name: "Evil" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      success: false,
      error: { code: "FORBIDDEN_HOST", message: "Host not allowed" },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    await app.close();
  });

  it("still serves loopback clients", async () => {
    const app = await buildServer({ allowedHosts: LOOPBACK, logger: false });
    for (const host of ["127.0.0.1:3002", "localhost:3002", "[::1]:3002"]) {
      const res = await app.inject({ method: "GET", url: "/health", headers: { host } });
      expect(res.statusCode).toBe(200);
    }
    const tools = await app.inject({ method: "GET", url: "/tools", headers: { host: "127.0.0.1:3002" } });
    expect(tools.statusCode).toBe(200);
    expect(tools.json().tools.length).toBeGreaterThan(0);
    await app.close();
  });
});

describe("MCP tool execution errors", () => {
  it("returns a generic message instead of the raw internal error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:3001 secret-detail"))
    );
    const app = await buildServer({ allowedHosts: LOOPBACK, logger: false });

    const res = await app.inject({
      method: "POST",
      url: "/tools/get_campaign_state",
      headers: { host: "127.0.0.1:3002" },
      payload: { campaignId: "c1" },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      success: false,
      error: "Tool execution failed",
      tool: "get_campaign_state",
    });
    await app.close();
  });
});
