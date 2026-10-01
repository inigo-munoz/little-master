import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError, AuthorTypeSchema, EntityTypeSchema, ErrorCode } from "@dnd/shared";
import { prisma } from "../db/prisma.js";
import { changeLogService } from "../services/changeLog.service.js";

export const changeLogRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { campaignId: string; limit?: string; offset?: string } }>(
    "/",
    async (request) => {
      const { campaignId, limit, offset } = z
        .object({
          campaignId: z.string(),
          limit: z.coerce.number().int().positive().max(100).default(50),
          offset: z.coerce.number().int().min(0).default(0),
        })
        .parse(request.query);

      const logs = await changeLogService.listByCampaign(campaignId, limit, offset);
      return { success: true, data: logs };
    }
  );

  server.get<{ Querystring: { entityType: string; entityId: string } }>(
    "/entity",
    async (request) => {
      const { entityType, entityId } = z
        .object({ entityType: z.string(), entityId: z.string() })
        .parse(request.query);

      const validEntityType = EntityTypeSchema.parse(entityType);
      const logs = await changeLogService.listByEntity(validEntityType, entityId);
      return { success: true, data: logs };
    }
  );

  // Usado por la herramienta log_change del servidor MCP. Los campos desconocidos
  // se descartan: solo se pasan al servicio los campos validados.
  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const body = z
      .object({
        campaignId: z.string().min(1),
        entityType: EntityTypeSchema,
        entityId: z.string().min(1),
        beforeJson: z.string().optional(),
        afterJson: z.string().optional(),
        reason: z.string().min(1).max(1000),
        authorType: AuthorTypeSchema.default("user"),
      })
      .parse(request.body);

    const campaign = await prisma.campaign.findUnique({ where: { id: body.campaignId } });
    if (!campaign) {
      throw AppError.notFound(ErrorCode.CAMPAIGN_NOT_FOUND, `Campaign ${body.campaignId} not found`);
    }

    const entry = await changeLogService.log({
      campaignId: body.campaignId,
      entityType: body.entityType,
      entityId: body.entityId,
      beforeJson: body.beforeJson ?? null,
      afterJson: body.afterJson ?? null,
      reason: body.reason,
      source: body.authorType === "ai" ? "ai_assistant" : body.authorType,
      authorType: body.authorType,
    });
    return reply.status(201).send({ success: true, data: entry });
  });
};
