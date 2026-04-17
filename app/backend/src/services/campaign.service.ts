import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode, type AuthorType } from "@dnd/shared";
import type { CreateCampaign } from "@dnd/domain";
import { changeLogService } from "./changeLog.service.js";

export const campaignService = {
  async list(userId: string) {
    return prisma.campaign.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            sessions: true,
            npcs: true,
            issues: { where: { status: "open" } },
          },
        },
      },
    });
  },

  async getById(id: string, userId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            sessions: true,
            npcs: true,
            locations: true,
            factions: true,
            documents: true,
            issues: { where: { status: "open" } },
          },
        },
      },
    });

    if (!campaign) {
      throw AppError.notFound(ErrorCode.CAMPAIGN_NOT_FOUND, `Campaign ${id} not found`);
    }

    return campaign;
  },

  async create(data: CreateCampaign, userId: string) {
    const campaign = await prisma.campaign.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        system: data.system ?? "D&D 2024",
        status: "active",
        userId,
      },
    });

    await changeLogService.log({
      campaignId: campaign.id,
      entityType: "campaign",
      entityId: campaign.id,
      beforeJson: null,
      afterJson: JSON.stringify(campaign),
      reason: "Campaign created",
      source: "user",
      authorType: "user",
    });

    return campaign;
  },

  async update(id: string, userId: string, data: Partial<CreateCampaign> & { status?: string }) {
    const existing = await this.getById(id, userId);

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.system !== undefined && { system: data.system }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    await changeLogService.log({
      campaignId: id,
      entityType: "campaign",
      entityId: id,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
      reason: "Campaign updated",
      source: "user",
      authorType: "user",
    });

    return updated;
  },

  async delete(id: string, userId: string) {
    const existing = await this.getById(id, userId);
    await prisma.campaign.delete({ where: { id } });

    await changeLogService.log({
      campaignId: id,
      entityType: "campaign",
      entityId: id,
      beforeJson: JSON.stringify(existing),
      afterJson: null,
      reason: "Campaign deleted",
      source: "user",
      authorType: "user",
    });
  },
};
