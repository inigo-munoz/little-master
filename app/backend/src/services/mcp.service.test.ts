import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import { mcpService } from "./mcp.service.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "@dnd/shared";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── getCampaignState (camino directo vía Prisma, sin MCP server) ────────────

describe("mcpService.getCampaignState", () => {
  let campaignId: string;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: "default-user" },
      update: {},
      create: { id: "default-user", name: "Default User" },
    });

    const campaign = await prisma.campaign.create({
      data: { title: "Campaña Estado Directo", system: "D&D 2024", userId: "default-user" },
    });
    campaignId = campaign.id;

    await prisma.session.createMany({
      data: [
        { campaignId, title: "Sesión 1", sessionNumber: 1 },
        { campaignId, title: "Sesión 2", sessionNumber: 2 },
        { campaignId, title: "Sesión 3", sessionNumber: 3 },
        { campaignId, title: "Sesión 4", sessionNumber: 4 },
      ],
    });

    await prisma.npc.createMany({
      data: [
        { campaignId, name: "Strahd", role: "Vampiro señor", status: "alive" },
        { campaignId, name: "Ireena", role: "Protegida", status: "alive" },
        { campaignId, name: "Sergei", status: "dead" },
      ],
    });

    await prisma.issue.createMany({
      data: [
        { campaignId, type: "narrative_inconsistency", severity: "major", description: "Issue abierta" },
        { campaignId, type: "rules_conflict", severity: "minor", description: "Issue resuelta", status: "resolved" },
      ],
    });

    await prisma.player.create({
      data: { campaignId, name: "Aldric", playerName: "Jugador1", class: "Guerrero", level: 5 },
    });
  });

  afterAll(async () => {
    await prisma.player.deleteMany({ where: { campaignId } });
    await prisma.issue.deleteMany({ where: { campaignId } });
    await prisma.npc.deleteMany({ where: { campaignId } });
    await prisma.session.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    // No borrar el usuario "default-user" ya que es compartido
  });

  it("devuelve el estado completo con el mismo shape que la tool MCP", async () => {
    const state = await mcpService.getCampaignState(campaignId);

    expect(state.campaign.title).toBe("Campaña Estado Directo");
    expect(state.recentSessions).toHaveLength(3);
    expect(state.activeNpcs.map((n) => n.name).sort()).toEqual(["Ireena", "Strahd"]);
    expect(state.openIssues).toHaveLength(1);
    expect(state.openIssues[0]?.description).toBe("Issue abierta");
    expect(state.players).toHaveLength(1);
    expect(state.players[0]?.name).toBe("Aldric");
  });

  it("limita las sesiones a las 3 más recientes en orden descendente", async () => {
    const state = await mcpService.getCampaignState(campaignId);
    expect(state.recentSessions.map((s) => s.sessionNumber)).toEqual([4, 3, 2]);
  });

  it("excluye NPCs muertos del estado", async () => {
    const state = await mcpService.getCampaignState(campaignId);
    expect(state.activeNpcs.some((n) => n.name === "Sergei")).toBe(false);
  });

  it("no usa fetch — obtiene el estado directamente de la BD", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const state = await mcpService.getCampaignState(campaignId);
    expect(state.campaign.id).toBe(campaignId);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lanza AppError NOT_FOUND si la campaña no existe", async () => {
    await expect(mcpService.getCampaignState("no-existe")).rejects.toThrow(AppError);
  });

  it("formatCampaignState acepta el output del camino directo", async () => {
    const state = await mcpService.getCampaignState(campaignId);
    const text = mcpService.formatCampaignState(state);

    expect(text).toContain("Campaña Estado Directo");
    expect(text).toContain("Aldric");
    expect(text).toContain("Strahd");
    expect(text).toContain("#4 Sesión 4");
    expect(text).toContain("[MAJOR]");
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
