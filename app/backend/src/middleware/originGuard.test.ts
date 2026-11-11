import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { makeOriginGuard } from "./originGuard.js";

const ALLOWED = ["http://localhost:3000", "tauri://localhost"];

async function appWith(allowed: string[]) {
  const app = Fastify({ logger: false });
  app.addHook("onRequest", makeOriginGuard(allowed));
  await app.register(multipart);
  let sideEffects = 0;
  app.get("/ping", async () => ({ ok: true }));
  app.post("/act", async () => {
    sideEffects++;
    return { ok: true };
  });
  app.delete("/act", async () => {
    sideEffects++;
    return { ok: true };
  });
  await app.ready();
  return { app, sideEffects: () => sideEffects };
}

describe("makeOriginGuard", () => {
  it("rejects a cross-site body-less POST before the handler runs", async () => {
    const { app, sideEffects } = await appWith(ALLOWED);
    const res = await app.inject({
      method: "POST",
      url: "/act",
      headers: { origin: "https://attacker.example" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      success: false,
      error: { code: "FORBIDDEN_ORIGIN", message: "Origin not allowed" },
    });
    expect(sideEffects()).toBe(0);
    await app.close();
  });

  it("rejects a cross-site multipart POST (a simple request with no CORS preflight)", async () => {
    const { app, sideEffects } = await appWith(ALLOWED);
    const boundary = "----x";
    const res = await app.inject({
      method: "POST",
      url: "/act",
      headers: {
        origin: "https://attacker.example",
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="f"; filename="a.md"\r\n\r\nx\r\n--${boundary}--\r\n`,
    });
    expect(res.statusCode).toBe(403);
    expect(sideEffects()).toBe(0);
    await app.close();
  });

  it("rejects the opaque \"null\" origin sent by sandboxed frames and file:// pages", async () => {
    const { app, sideEffects } = await appWith(ALLOWED);
    const res = await app.inject({ method: "DELETE", url: "/act", headers: { origin: "null" } });
    expect(res.statusCode).toBe(403);
    expect(sideEffects()).toBe(0);
    await app.close();
  });

  it("allows state-changing requests from an allowed origin", async () => {
    const { app, sideEffects } = await appWith(ALLOWED);
    for (const origin of ALLOWED) {
      const res = await app.inject({ method: "POST", url: "/act", headers: { origin } });
      expect(res.statusCode).toBe(200);
    }
    expect(sideEffects()).toBe(2);
    await app.close();
  });

  it("allows requests without an Origin header (non-browser clients such as the MCP server)", async () => {
    const { app, sideEffects } = await appWith(ALLOWED);
    const res = await app.inject({ method: "POST", url: "/act" });
    expect(res.statusCode).toBe(200);
    expect(sideEffects()).toBe(1);
    await app.close();
  });

  it("leaves safe methods alone, since CORS already blocks reading the response", async () => {
    const { app } = await appWith(ALLOWED);
    const res = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { origin: "https://attacker.example" },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
