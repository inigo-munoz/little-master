import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCampaignState,
  createNpc,
  logIssue,
  searchRules,
  searchDocuments,
} from "./index.js";

// ─── Mock global fetch ─────────────────────────────────────────────────────────

function mockFetchResponse(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── get_campaign_state ────────────────────────────────────────────────────────

describe("get_campaign_state", () => {
  it("devuelve estado estructurado con sesiones limitadas y NPCs activos", async () => {
    const mockSessions = [
      { id: "s1", sessionNumber: 3, title: "Sesión 3" },
      { id: "s2", sessionNumber: 2, title: "Sesión 2" },
      { id: "s3", sessionNumber: 1, title: "Sesión 1" },
      { id: "s4", sessionNumber: 4, title: "Sesión 4" },
    ];
    const mockNpcs = [
      { id: "n1", name: "Aldric", status: "alive" },
      { id: "n2", name: "Morgath", status: "dead" },
      { id: "n3", name: "Lyria", status: "alive" },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: { id: "c1", title: "Test Campaign" } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: mockSessions }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: mockNpcs }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) })
    );

    const result = await getCampaignState.execute({ campaignId: "c1" }) as {
      recentSessions: unknown[];
      activeNpcs: unknown[];
    };

    // Solo debe devolver 3 sesiones (las más recientes: 4, 3, 2)
    expect(result.recentSessions).toHaveLength(3);
    expect((result.recentSessions[0] as { sessionNumber: number }).sessionNumber).toBe(4);
    expect((result.recentSessions[1] as { sessionNumber: number }).sessionNumber).toBe(3);

    // Solo debe devolver NPCs no muertos
    expect(result.activeNpcs).toHaveLength(2);
    expect((result.activeNpcs as { status: string }[]).every(n => n.status !== "dead")).toBe(true);
  });

  it("lanza error cuando el backend no está disponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: "Server error" }) }));

    await expect(getCampaignState.execute({ campaignId: "c1" })).rejects.toThrow();
  });
});

// ─── create_npc ───────────────────────────────────────────────────────────────

describe("create_npc", () => {
  it("llama al backend con authorType assistant", async () => {
    const fetchMock = mockFetchResponse({ success: true, data: { id: "n1", name: "Grendel" } }, 201);
    vi.stubGlobal("fetch", fetchMock);

    const result = await createNpc.execute({
      campaignId: "c1",
      name: "Grendel",
      role: "Señor de la guerra",
      description: "Un orco temible",
      status: "alive",
      tags: ["orco", "antagonista"],
    }) as { success: boolean };

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/npcs");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string);
    expect(body.name).toBe("Grendel");
    expect(body.authorType).toBe("assistant"); // El NPC se crea con authorType assistant
  });

  it("falla si el backend devuelve error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ error: "Invalid name" }) }));

    await expect(
      createNpc.execute({ campaignId: "c1", name: "X", status: "alive", tags: [] })
    ).rejects.toThrow("Backend error 400");
  });
});

// ─── log_issue ────────────────────────────────────────────────────────────────

describe("log_issue", () => {
  it("crea un issue con los campos correctos", async () => {
    const fetchMock = mockFetchResponse({ success: true, data: { id: "i1" } }, 201);
    vi.stubGlobal("fetch", fetchMock);

    await logIssue.execute({
      campaignId: "c1",
      type: "narrative_inconsistency",
      severity: "major",
      description: "El personaje mencionó estar en dos lugares a la vez",
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/issues");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string);
    expect(body.severity).toBe("major");
    expect(body.type).toBe("narrative_inconsistency");
  });

  it("rechaza tipo de issue inválido (schema Zod)", async () => {
    const parseResult = logIssue.inputSchema.safeParse({
      campaignId: "c1",
      type: "invalid_type",
      severity: "major",
      description: "test",
    });
    expect(parseResult.success).toBe(false);
  });
});

// ─── search_rules ─────────────────────────────────────────────────────────────

describe("search_rules", () => {
  it("llama al endpoint correcto con los parámetros de búsqueda", async () => {
    const fetchMock = mockFetchResponse({ data: [] });
    vi.stubGlobal("fetch", fetchMock);

    await searchRules.execute({
      campaignId: "c1",
      query: "concentración de hechizos",
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/api/campaign-rules/search");
    expect(url).toContain("concentraci%C3%B3n");
    expect(url).toContain("campaignId=c1");
  });

  it("incluye filtros de sourceType cuando se especifican", async () => {
    const fetchMock = mockFetchResponse({ data: [] });
    vi.stubGlobal("fetch", fetchMock);

    await searchRules.execute({
      campaignId: "c1",
      query: "bola de fuego",
      sourceTypes: ["official", "srd"],
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("sourceTypes=official%2Csrd");
  });
});

// ─── search_documents ─────────────────────────────────────────────────────────

describe("search_documents", () => {
  it("busca con campaignId cuando se proporciona", async () => {
    const fetchMock = mockFetchResponse({ data: [] });
    vi.stubGlobal("fetch", fetchMock);

    await searchDocuments.execute({ campaignId: "c1", query: "dragón", limit: 5 });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("campaignId=c1");
    expect(url).toContain("limit=5");
  });

  it("busca globalmente cuando no hay campaignId", async () => {
    const fetchMock = mockFetchResponse({ data: [] });
    vi.stubGlobal("fetch", fetchMock);

    await searchDocuments.execute({ query: "SRD", limit: 8 });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain("campaignId");
    expect(url).toContain("/api/documents/search");
  });

  it("rechaza query vacía (schema Zod)", async () => {
    const parseResult = searchDocuments.inputSchema.safeParse({ query: "", limit: 5 });
    expect(parseResult.success).toBe(false);
  });
});
