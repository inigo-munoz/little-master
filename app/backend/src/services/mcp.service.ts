/**
 * MCP Service — cliente del MCP server para el backend.
 *
 * Permite al chat.service.ts llamar a las tools del MCP server vía HTTP.
 * Si el MCP server no está disponible, las llamadas fallan silenciosamente
 * (graceful degradation): el chat continúa sin tools.
 */

import { env } from "../config/env.js";

const TIMEOUT_MS = 5_000; // 5 segundos máx por tool call
const HEALTH_TIMEOUT_MS = 2_000;

export interface McpToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  tool?: string;
}

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export const mcpService = {
  /**
   * Llama a una tool del MCP server y devuelve el resultado.
   * Si el servidor no está disponible o la tool falla, devuelve success: false
   * sin lanzar excepción (graceful degradation).
   */
  async callTool(name: string, input: unknown): Promise<McpToolResult> {
    try {
      const res = await fetch(`${env.MCP_SERVER_URL}/tools/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: withTimeout(TIMEOUT_MS),
      });

      const json = await res.json() as McpToolResult;

      if (!res.ok) {
        return {
          success: false,
          error: `MCP tool '${name}' responded ${res.status}: ${JSON.stringify(json)}`,
          tool: name,
        };
      }

      return json;
    } catch (err: unknown) {
      // El MCP server no está disponible, red caída, o timeout
      const message = err instanceof Error ? err.message : "MCP unavailable";
      console.warn(`[mcp] Tool '${name}' unavailable: ${message}`);
      return { success: false, error: message, tool: name };
    }
  },

  /**
   * Comprueba si el MCP server está arrancado.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${env.MCP_SERVER_URL}/health`, {
        signal: withTimeout(HEALTH_TIMEOUT_MS),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Lista las tools disponibles en el MCP server.
   */
  async listTools(): Promise<string[]> {
    try {
      const res = await fetch(`${env.MCP_SERVER_URL}/tools`, {
        signal: withTimeout(HEALTH_TIMEOUT_MS),
      });
      if (!res.ok) return [];
      const json = await res.json() as { tools?: { name: string }[] };
      return json.tools?.map((t) => t.name) ?? [];
    } catch {
      return [];
    }
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
