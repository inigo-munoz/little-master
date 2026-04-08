import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

export const wikiRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Params: { campaignId: string; name: string } }>(
    "/:campaignId/wiki/:name",
    async (request) => {
      const { campaignId, name } = z
        .object({ campaignId: z.string(), name: z.string() })
        .parse(request.params);

      const [npcs, players, sessions, locations, factions] = await Promise.all([
        prisma.npc.findMany({
          where: { campaignId, name: { contains: name } },
          select: { id: true, name: true, role: true, description: true },
          take: 3,
        }),
        prisma.player.findMany({
          where: { campaignId, name: { contains: name } },
          select: { id: true, name: true, class: true, level: true },
          take: 3,
        }),
        prisma.session.findMany({
          where: { campaignId, title: { contains: name } },
          select: { id: true, title: true, summary: true, sessionNumber: true },
          take: 3,
        }),
        prisma.location.findMany({
          where: { campaignId, name: { contains: name } },
          select: { id: true, name: true, description: true },
          take: 3,
        }),
        prisma.faction.findMany({
          where: { campaignId, name: { contains: name } },
          select: { id: true, name: true, description: true, disposition: true },
          take: 3,
        }),
      ]);

      const nameLower = name.toLowerCase();
      const results: Array<{ type: string; id: string; name: string; summary: string }> = [];

      for (const npc of npcs) {
        results.push({
          type: "npc",
          id: npc.id,
          name: npc.name,
          summary: npc.role ?? npc.description?.slice(0, 120) ?? "NPC",
        });
      }
      for (const player of players) {
        results.push({
          type: "player",
          id: player.id,
          name: player.name,
          summary: player.class
            ? `${player.class} nivel ${player.level}`
            : `Nivel ${player.level}`,
        });
      }
      for (const session of sessions) {
        results.push({
          type: "session",
          id: session.id,
          name: session.title,
          summary:
            session.summary?.slice(0, 120) ?? `Sesión ${session.sessionNumber}`,
        });
      }
      for (const location of locations) {
        results.push({
          type: "location",
          id: location.id,
          name: location.name,
          summary: location.description?.slice(0, 120) ?? "Localización",
        });
      }
      for (const faction of factions) {
        results.push({
          type: "faction",
          id: faction.id,
          name: faction.name,
          summary: faction.description?.slice(0, 120) ?? faction.disposition,
        });
      }

      // Exact matches first
      results.sort((a, b) => {
        const aExact = a.name.toLowerCase() === nameLower ? 0 : 1;
        const bExact = b.name.toLowerCase() === nameLower ? 0 : 1;
        return aExact - bExact;
      });

      return { success: true, data: results.slice(0, 5) };
    }
  );
};
