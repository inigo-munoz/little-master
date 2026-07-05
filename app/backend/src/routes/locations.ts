import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { changeLogService } from "../services/changeLog.service.js";
import { deleteWithChangeLog } from "../db/delete-with-changelog.js";
import { AppError, ErrorCode } from "@dnd/shared";

export const locationRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { campaignId: string } }>("/", async (request) => {
    const { campaignId } = z.object({ campaignId: z.string() }).parse(request.query);
    const locations = await prisma.location.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: locations };
  });

  server.get<{ Params: { id: string } }>("/:id", async (request) => {
    const location = await prisma.location.findUnique({ where: { id: request.params.id } });
    if (!location) throw AppError.notFound(ErrorCode.NOT_FOUND, "Location not found");
    return { success: true, data: location };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string(),
      name: z.string().min(1).max(200),
      description: z.string().max(10000).optional(),
      tags: z.array(z.string()).default([]),
      authorType: z.enum(["user", "assistant"]).default("user"),
    });

    const { authorType, ...data } = schema.parse(request.body);
    const changelogAuthorType = authorType === "assistant" ? "ai" : "user";

    const location = await prisma.location.create({
      data: {
        campaignId: data.campaignId,
        name: data.name,
        description: data.description ?? null,
        tags: JSON.stringify(data.tags),
      },
    });

    await changeLogService.log({
      campaignId: data.campaignId,
      entityType: "location",
      entityId: location.id,
      beforeJson: null,
      afterJson: JSON.stringify(location),
      reason: "Location created",
      source: changelogAuthorType === "ai" ? "ai_assistant" : "user",
      authorType: changelogAuthorType,
    });

    return reply.status(201).send({ success: true, data: location });
  });

  server.patch<{ Params: { id: string }; Body: unknown }>("/:id", async (request) => {
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(10000).optional(),
      tags: z.array(z.string()).optional(),
    });

    const data = schema.parse(request.body);
    const existing = await prisma.location.findUnique({ where: { id: request.params.id } });
    if (!existing) throw AppError.notFound(ErrorCode.NOT_FOUND, "Location not found");

    const updated = await prisma.location.update({
      where: { id: request.params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
      },
    });

    await changeLogService.log({
      campaignId: existing.campaignId,
      entityType: "location",
      entityId: updated.id,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
      reason: "Location updated",
      source: "user",
      authorType: "user",
    });

    return { success: true, data: updated };
  });

  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await prisma.location.findUnique({ where: { id: request.params.id } });
    if (!existing) throw AppError.notFound(ErrorCode.NOT_FOUND, "Location not found");
    await deleteWithChangeLog({
      prisma,
      existing,
      campaignId: existing.campaignId,
      entityType: "location",
      reason: "Location deleted",
      cleanupEntityRelations: true,
      deleteEntity: (tx) => tx.location.delete({ where: { id: request.params.id } }),
    });
    return reply.status(204).send();
  });
};
