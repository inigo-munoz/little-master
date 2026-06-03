import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";
import type { CreateNpc } from "@dnd/domain";
import { changeLogService } from "./changeLog.service.js";

function serializeEntries(entries: { name: string; description: string }[] | null | undefined): string | null {
  if (!entries) return null;
  return JSON.stringify(entries);
}

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
    const npc = await prisma.npc.create({
      data: {
        campaignId: data.campaignId,
        name: data.name,
        role: data.role ?? null,
        description: data.description ?? null,
        status: data.status ?? "alive",
        tags: JSON.stringify(data.tags ?? []),
        // Stat block
        armorClass: data.armorClass ?? null,
        hitPoints: data.hitPoints ?? null,
        speed: data.speed ?? null,
        strength: data.strength ?? null,
        dexterity: data.dexterity ?? null,
        constitution: data.constitution ?? null,
        intelligence: data.intelligence ?? null,
        wisdom: data.wisdom ?? null,
        charisma: data.charisma ?? null,
        savingThrows: data.savingThrows ?? null,
        skills: data.skills ?? null,
        resistances: data.resistances ?? null,
        immunities: data.immunities ?? null,
        senses: data.senses ?? null,
        languages: data.languages ?? null,
        challengeRating: data.challengeRating ?? null,
        traits: serializeEntries(data.traits),
        actions: serializeEntries(data.actions),
        bonusActions: serializeEntries(data.bonusActions),
        reactions: serializeEntries(data.reactions),
        npcType: data.npcType ?? null,
        npcClass: data.npcClass ?? null,
        npcLevel: data.npcLevel ?? null,
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
        // Stat block
        ...(data.armorClass !== undefined && { armorClass: data.armorClass }),
        ...(data.hitPoints !== undefined && { hitPoints: data.hitPoints }),
        ...(data.speed !== undefined && { speed: data.speed }),
        ...(data.strength !== undefined && { strength: data.strength }),
        ...(data.dexterity !== undefined && { dexterity: data.dexterity }),
        ...(data.constitution !== undefined && { constitution: data.constitution }),
        ...(data.intelligence !== undefined && { intelligence: data.intelligence }),
        ...(data.wisdom !== undefined && { wisdom: data.wisdom }),
        ...(data.charisma !== undefined && { charisma: data.charisma }),
        ...(data.savingThrows !== undefined && { savingThrows: data.savingThrows }),
        ...(data.skills !== undefined && { skills: data.skills }),
        ...(data.resistances !== undefined && { resistances: data.resistances }),
        ...(data.immunities !== undefined && { immunities: data.immunities }),
        ...(data.senses !== undefined && { senses: data.senses }),
        ...(data.languages !== undefined && { languages: data.languages }),
        ...(data.challengeRating !== undefined && { challengeRating: data.challengeRating }),
        ...(data.traits !== undefined && { traits: serializeEntries(data.traits) }),
        ...(data.actions !== undefined && { actions: serializeEntries(data.actions) }),
        ...(data.bonusActions !== undefined && { bonusActions: serializeEntries(data.bonusActions) }),
        ...(data.reactions !== undefined && { reactions: serializeEntries(data.reactions) }),
        ...(data.npcType !== undefined && { npcType: data.npcType }),
        ...(data.npcClass !== undefined && { npcClass: data.npcClass }),
        ...(data.npcLevel !== undefined && { npcLevel: data.npcLevel }),
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

    await prisma.entityRelation.deleteMany({
      where: { OR: [{ fromId: id }, { toId: id }] },
    });
    await prisma.npc.delete({ where: { id } });
  },
};
