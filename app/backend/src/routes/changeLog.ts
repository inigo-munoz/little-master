import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { EntityTypeSchema } from "@dnd/shared";
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
};
