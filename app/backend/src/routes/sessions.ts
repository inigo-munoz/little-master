import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { changeLogService } from "../services/changeLog.service.js";
import { AppError, ErrorCode } from "@dnd/shared";

export const sessionRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { campaignId: string } }>("/", async (request) => {
    const { campaignId } = z.object({ campaignId: z.string() }).parse(request.query);
    const sessions = await prisma.session.findMany({
      where: { campaignId },
      orderBy: { sessionNumber: "desc" },
    });
    return { success: true, data: sessions };
  });

  server.get<{ Params: { id: string } }>("/:id", async (request) => {
    const session = await prisma.session.findUnique({ where: { id: request.params.id } });
    if (!session) throw AppError.notFound(ErrorCode.SESSION_NOT_FOUND, "Session not found");
    return { success: true, data: session };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string(),
      title: z.string().min(1).max(200),
      summary: z.string().max(10000).optional(),
      notes: z.string().max(50000).optional(),
      sessionNumber: z.number().int().positive(),
      playedAt: z.string().datetime().optional(),
      authorType: z.enum(["user", "assistant"]).default("user"),
    });

    const { authorType, ...data } = schema.parse(request.body);
    const changelogAuthorType = authorType === "assistant" ? "ai" : "user";

    const duplicate = await prisma.session.findFirst({
      where: { campaignId: data.campaignId, sessionNumber: data.sessionNumber },
    });
    if (duplicate) {
      return reply.status(409).send({
        success: false,
        error: { code: "DUPLICATE_SESSION_NUMBER", message: "Ya existe una sesión con ese número en esta campaña" },
      });
    }

    const session = await prisma.session.create({
      data: {
        campaignId: data.campaignId,
        title: data.title,
        summary: data.summary ?? null,
        notes: data.notes ?? null,
        sessionNumber: data.sessionNumber,
        playedAt: data.playedAt ? new Date(data.playedAt) : null,
      },
    });

    await changeLogService.log({
      campaignId: data.campaignId,
      entityType: "session",
      entityId: session.id,
      beforeJson: null,
      afterJson: JSON.stringify(session),
      reason: "Session created",
      source: changelogAuthorType === "ai" ? "ai_assistant" : "user",
      authorType: changelogAuthorType,
    });

    return reply.status(201).send({ success: true, data: session });
  });

  server.patch<{ Params: { id: string }; Body: unknown }>("/:id", async (request) => {
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      summary: z.string().max(10000).optional(),
      notes: z.string().max(50000).optional(),
      playedAt: z.string().datetime().optional().nullable(),
    });

    const data = schema.parse(request.body);
    const existing = await prisma.session.findUnique({ where: { id: request.params.id } });
    if (!existing) throw AppError.notFound(ErrorCode.SESSION_NOT_FOUND, "Session not found");

    const updated = await prisma.session.update({
      where: { id: request.params.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.summary !== undefined && { summary: data.summary }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.playedAt !== undefined && {
          playedAt: data.playedAt ? new Date(data.playedAt) : null,
        }),
      },
    });

    await changeLogService.log({
      campaignId: existing.campaignId,
      entityType: "session",
      entityId: updated.id,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
      reason: "Session updated",
      source: "user",
      authorType: "user",
    });

    return { success: true, data: updated };
  });

  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await prisma.session.findUnique({ where: { id: request.params.id } });
    if (!existing) throw AppError.notFound(ErrorCode.SESSION_NOT_FOUND, "Session not found");
    await prisma.$transaction(async (tx) => {
      await changeLogService.log(
        {
          campaignId: existing.campaignId,
          entityType: "session",
          entityId: existing.id,
          beforeJson: JSON.stringify(existing),
          afterJson: null,
          reason: "Session deleted",
          source: "user",
          authorType: "user",
        },
        tx
      );
      await tx.session.delete({ where: { id: request.params.id } });
    });
    return reply.status(204).send();
  });
};
