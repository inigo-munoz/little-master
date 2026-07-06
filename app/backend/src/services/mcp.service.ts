/**
 * MCP Service — estado de campaña para el chat.
 *
 * Expone `getCampaignState`, que obtiene el estado de campaña DIRECTAMENTE de la
 * BD (vía Prisma/servicios) con el mismo shape que la tool `get_campaign_state`
 * del MCP server, y `formatCampaignState`, que lo formatea como texto para el
 * system prompt. El chat usa este camino directo para evitar el bucle
 * backend → :3002 → :3001 → backend.
 */

import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";
import { npcService } from "./npc.service.js";
import { issueService } from "./issue.service.js";

export const mcpService = {
  /**
   * Obtiene el estado de campaña directamente de la BD, sin pasar por el
   * MCP server. Mismo shape que la tool `get_campaign_state` del MCP server:
   * campaña, últimas 3 sesiones, NPCs activos (no muertos), issues abiertas
   * y jugadores. Lanza AppError NOT_FOUND si la campaña no existe.
   */
  async getCampaignState(campaignId: string) {
    const [campaign, recentSessions, npcs, openIssues, players] = await Promise.all([
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.session.findMany({
        where: { campaignId },
        orderBy: { sessionNumber: "desc" },
        take: 3,
      }),
      npcService.listByCampaign(campaignId),
      issueService.listByCampaign(campaignId, "open"),
      prisma.player.findMany({
        where: { campaignId },
        orderBy: { name: "asc" },
      }),
    ]);

    if (!campaign) {
      throw AppError.notFound(ErrorCode.CAMPAIGN_NOT_FOUND, `Campaign ${campaignId} not found`);
    }

    return {
      campaign,
      recentSessions,
      activeNpcs: npcs.filter((n) => n.status !== "dead"),
      openIssues,
      players,
    };
  },

  /**
   * Formatea el estado de campaña como texto para inyectar en el system prompt.
   */
  formatCampaignState(data: unknown): string {
    if (!data || typeof data !== "object") return "";

    const d = data as {
      campaign?: { title?: string; system?: string };
      activeNpcs?: { name?: string; role?: string; status?: string }[];
      recentSessions?: { sessionNumber?: number; title?: string; summary?: string }[];
      openIssues?: { severity?: string; description?: string }[];
      players?: { name?: string; class?: string; level?: number }[];
    };

    const lines: string[] = ["═══════ CAMPAIGN STATE (current) ═══════"];

    if (d.campaign?.title) {
      lines.push(`Campaign: ${d.campaign.title}${d.campaign.system ? ` (${d.campaign.system})` : ""}`);
    }

    if (d.players && d.players.length > 0) {
      const playerList = d.players
        .map((p) => `${p.name ?? "?"}${p.class ? ` (${p.class} Nv.${p.level ?? "?"})` : ""}`)
        .join(", ");
      lines.push(`Players: ${playerList}`);
    }

    if (d.activeNpcs && d.activeNpcs.length > 0) {
      const npcList = d.activeNpcs
        .slice(0, 10)
        .map((n) => `${n.name ?? "?"}${n.role ? ` — ${n.role}` : ""}`)
        .join("; ");
      lines.push(`Active NPCs: ${npcList}`);
    }

    if (d.recentSessions && d.recentSessions.length > 0) {
      lines.push("Recent sessions:");
      for (const s of d.recentSessions) {
        const summary = s.summary ? ` — ${s.summary.slice(0, 120)}${s.summary.length > 120 ? "…" : ""}` : "";
        lines.push(`  #${s.sessionNumber ?? "?"} ${s.title ?? "Untitled"}${summary}`);
      }
    }

    if (d.openIssues && d.openIssues.length > 0) {
      const issueList = d.openIssues
        .slice(0, 5)
        .map((i) => `[${i.severity?.toUpperCase() ?? "?"}] ${i.description?.slice(0, 80) ?? ""}`)
        .join("; ");
      lines.push(`Open issues: ${issueList}`);
    }

    lines.push("═══════════════════════════════════════");
    return lines.join("\n");
  },
};
