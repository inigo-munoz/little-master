import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";
import type { CreateNpc } from "@dnd/domain";
import { changeLogService } from "./changeLog.service.js";

export const npcService = {
  async listByCampaign(campaignId: string) {
    return prisma.npc.findMany({
      where: { campaignId },
      orderBy: { name: "asc" },
    });
  },

  async getById(id: string) {
    const npc = await prisma.npc.findUnique({ where: { id } });
    if (!npc) throw AppError.notFound(ErrorCode.NPC_NOT_FOUND, `NPC ${id} not found`);
    return npc;
  },

  async create(data: CreateNpc, authorType: "user" | "ai" = "user") {
    // SQLite stores arrays as JSON strings
    const npc = await prisma.npc.create({
      data: {
        campaignId: data.campaignId,
        name: data.name,
        role: data.role ?? null,
        description: data.description ?? null,
        status: data.status ?? "alive",
        tags: JSON.stringify(data.tags ?? []),
      },
    });

    await changeLogService.log({
      campaignId: data.campaignId,
      entityType: "npc",
      entityId: npc.id,
      beforeJson: null,
      afterJson: JSON.stringify(npc),
      reason: "NPC created",
      source: authorType === "ai" ? "ai_assistant" : "user",
      authorType,
    });

    return npc;
  },

  async update(id: string, data: Partial<Omit<CreateNpc, "campaignId">>, authorType: "user" | "ai" = "user") {
    const existing = await this.getById(id);

    const updated = await prisma.npc.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
      },
    });

    await changeLogService.log({
      campaignId: existing.campaignId,
      entityType: "npc",
      entityId: id,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
      reason: "NPC updated",
      source: authorType === "ai" ? "ai_assistant" : "user",
      authorType,
    });

    return updated;
  },

  async delete(id: string) {
    const existing = await this.getById(id);
    await prisma.npc.delete({ where: { id } });

    await changeLogService.log({
      campaignId: existing.campaignId,
      entityType: "npc",
      entityId: id,
      beforeJson: JSON.stringify(existing),
      afterJson: null,
      reason: "NPC deleted",
      source: "user",
      authorType: "user",
    });
  },
};
