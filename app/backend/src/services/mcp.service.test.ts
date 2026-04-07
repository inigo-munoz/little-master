import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mcpService } from "./mcp.service.js";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── callTool ─────────────────────────────────────────────────────────────────

describe("mcpService.callTool", () => {
  it("devuelve el resultado de la tool cuando el servidor responde 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { campaign: { title: "Test" } } }),
      })
    );

    const result = await mcpService.callTool("get_campaign_state", { campaignId: "c1" });
    expect(result.success).toBe(true);
    expect((result.data as { campaign: { title: string } }).campaign.title).toBe("Test");
  });

  it("devuelve success: false cuando el servidor responde error 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" }),
      })
    );

    const result = await mcpService.callTool("get_campaign_state", { campaignId: "c1" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
  });

  it("devuelve success: false (graceful degradation) cuando el servidor no está disponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await mcpService.callTool("get_campaign_state", { campaignId: "c1" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("devuelve success: false con error de timeout", async () => {
    const timeoutError = new DOMException("The operation was aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));

    const result = await mcpService.callTool("get_campaign_state", { campaignId: "c1" });
    expect(result.success).toBe(false);
  });
});

// ─── isAvailable ──────────────────────────────────────────────────────────────

describe("mcpService.isAvailable", () => {
  it("devuelve true cuando el servidor responde 200 en /health", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );

    const available = await mcpService.isAvailable();
    expect(available).toBe(true);
  });

  it("devuelve false cuando el servidor no está disponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const available = await mcpService.isAvailable();
    expect(available).toBe(false);
  });

  it("devuelve false cuando el servidor responde 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    );

    const available = await mcpService.isAvailable();
    expect(available).toBe(false);
  });
});

// ─── listTools ────────────────────────────────────────────────────────────────

describe("mcpService.listTools", () => {
  it("devuelve lista de nombres de tools", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            tools: [
              { name: "get_campaign_state" },
              { name: "create_npc" },
              { name: "log_issue" },
            ],
          }),
      })
    );

    const tools = await mcpService.listTools();
    expect(tools).toEqual(["get_campaign_state", "create_npc", "log_issue"]);
  });

  it("devuelve array vacío cuando el servidor no está disponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const tools = await mcpService.listTools();
    expect(tools).toEqual([]);
  });
});

// ─── formatCampaignState ──────────────────────────────────────────────────────

describe("mcpService.formatCampaignState", () => {
  it("formatea el estado de campaña como texto estructurado", () => {
    const data = {
      campaign: { title: "La Maldición de Strahd", system: "D&D 5e" },
      players: [
        { name: "Aldric", class: "Guerrero", level: 5 },
        { name: "Lyria", class: "Maga", level: 5 },
      ],
      activeNpcs: [
        { name: "Strahd", role: "Vampiro señor" },
        { name: "Ireena", role: "Protegida" },
      ],
      recentSessions: [
        { sessionNumber: 3, title: "El Castillo Ravenloft", summary: "El grupo entró al castillo." },
        { sessionNumber: 2, title: "La Aldea Barovia" },
      ],
      openIssues: [
        { severity: "major", description: "Strahd conoce la identidad del grupo" },
      ],
    };

    const text = mcpService.formatCampaignState(data);
    expect(text).toContain("La Maldición de Strahd");
    expect(text).toContain("D&D 5e");
    expect(text).toContain("Aldric");
    expect(text).toContain("Guerrero Nv.5");
    expect(text).toContain("Strahd");
    expect(text).toContain("Vampiro señor");
    expect(text).toContain("#3 El Castillo Ravenloft");
    expect(text).toContain("[MAJOR]");
  });

  it("devuelve string vacío para datos nulos", () => {
    expect(mcpService.formatCampaignState(null)).toBe("");
    expect(mcpService.formatCampaignState(undefined)).toBe("");
  });

  it("maneja datos parciales sin error", () => {
    const text = mcpService.formatCampaignState({ campaign: { title: "Test" } });
    expect(text).toContain("Test");
  });
});
