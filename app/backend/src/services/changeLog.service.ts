import { prisma } from "../db/prisma.js";
import type { EntityType, AuthorType } from "@dnd/shared";

interface LogChangeInput {
  campaignId?: string | null;
  entityType: EntityType;
  entityId: string;
  beforeJson?: string | null;
  afterJson?: string | null;
  reason?: string;
  source?: string;
  authorType: AuthorType;
}

export const changeLogService = {
  async log(input: LogChangeInput) {
    return prisma.changeLog.create({
      data: {
        campaignId: input.campaignId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeJson: input.beforeJson ?? null,
        afterJson: input.afterJson ?? null,
        reason: input.reason ?? null,
        source: input.source ?? null,
        authorType: input.authorType,
      },
    });
  },

  async listByCampaign(campaignId: string, limit = 50, offset = 0) {
    return prisma.changeLog.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  },

  async listByEntity(entityType: EntityType, entityId: string) {
    return prisma.changeLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
  },
};
