import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { changeLogService } from "../services/changeLog.service.js";
import { AppError, ErrorCode } from "@dnd/shared";

export const factionRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { campaignId: string } }>("/", async (request) => {
    const { campaignId } = z.object({ campaignId: z.string() }).parse(request.query);
    const factions = await prisma.faction.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: factions };
  });

  server.get<{ Params: { id: string } }>("/:id", async (request) => {
    const faction = await prisma.faction.findUnique({ where: { id: request.params.id } });
    if (!faction) throw AppError.notFound(ErrorCode.NOT_FOUND, "Faction not found");
    return { success: true, data: faction };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string(),
      name: z.string().min(1).max(200),
      description: z.string().max(10000).optional(),
      alignment: z.string().max(100).optional(),
      disposition: z.string().max(100).optional(),
      tags: z.array(z.string()).default([]),
      authorType: z.enum(["user", "assistant"]).default("user"),
    });

    const { authorType, ...data } = schema.parse(request.body);
    const changelogAuthorType = authorType === "assistant" ? "ai" : "user";

    const faction = await prisma.faction.create({
      data: {
        campaignId: data.campaignId,
        name: data.name,
        description: data.description ?? null,
        alignment: data.alignment ?? null,
        disposition: data.disposition ?? "unknown",
        tags: JSON.stringify(data.tags),
      },
    });

    await changeLogService.log({
      campaignId: data.campaignId,
      entityType: "faction",
      entityId: faction.id,
      beforeJson: null,
      afterJson: JSON.stringify(faction),
      reason: "Faction created",
      source: changelogAuthorType === "ai" ? "ai_assistant" : "user",
      authorType: changelogAuthorType,
    });

    return reply.status(201).send({ success: true, data: faction });
  });

  server.patch<{ Params: { id: string }; Body: unknown }>("/:id", async (request) => {
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(10000).optional(),
      alignment: z.string().max(100).optional(),
      disposition: z.string().max(100).optional(),
      tags: z.array(z.string()).optional(),
    });

    const data = schema.parse(request.body);
    const existing = await prisma.faction.findUnique({ where: { id: request.params.id } });
    if (!existing) throw AppError.notFound(ErrorCode.NOT_FOUND, "Faction not found");

    const updated = await prisma.faction.update({
      where: { id: request.params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.alignment !== undefined && { alignment: data.alignment }),
        ...(data.disposition !== undefined && { disposition: data.disposition }),
        ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
      },
    });

    await changeLogService.log({
      campaignId: existing.campaignId,
      entityType: "faction",
      entityId: updated.id,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
      reason: "Faction updated",
      source: "user",
      authorType: "user",
    });

    return { success: true, data: updated };
  });

  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await prisma.faction.findUnique({ where: { id: request.params.id } });
    if (!existing) throw AppError.notFound(ErrorCode.NOT_FOUND, "Faction not found");
    await prisma.$transaction(async (tx) => {
      await changeLogService.log(
        {
          campaignId: existing.campaignId,
          entityType: "faction",
          entityId: existing.id,
          beforeJson: JSON.stringify(existing),
          afterJson: null,
          reason: "Faction deleted",
          source: "user",
          authorType: "user",
        },
        tx
      );
      await tx.entityRelation.deleteMany({
        where: { OR: [{ fromId: existing.id }, { toId: existing.id }] },
      });
      await tx.faction.delete({ where: { id: request.params.id } });
    });
    return reply.status(204).send();
  });
};
