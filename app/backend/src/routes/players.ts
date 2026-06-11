import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { changeLogService } from "../services/changeLog.service.js";
import { AppError, ErrorCode } from "@dnd/shared";

export const playerRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { campaignId: string } }>("/", async (request) => {
    const { campaignId } = z.object({ campaignId: z.string() }).parse(request.query);
    const players = await prisma.player.findMany({
      where: { campaignId },
      orderBy: { name: "asc" },
    });
    return { success: true, data: players };
  });

  server.get<{ Params: { id: string } }>("/:id", async (request) => {
    const player = await prisma.player.findUnique({ where: { id: request.params.id } });
    if (!player) throw AppError.notFound(ErrorCode.NOT_FOUND, "Player not found");
    return { success: true, data: player };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string(),
      name: z.string().min(1).max(200),
      playerName: z.string().optional(),
      class: z.string().optional(),
      subclass: z.string().optional(),
      race: z.string().optional(),
      level: z.number().int().min(1).max(20).default(1),
      hp: z.number().int().optional(),
      ac: z.number().int().optional(),
      status: z.enum(["active", "inactive", "dead", "retired"]).default("active"),
      notes: z.string().optional(),
    });

    const data = schema.parse(request.body);
    const player = await prisma.player.create({
      data: {
        campaignId: data.campaignId,
        name: data.name,
        playerName: data.playerName ?? null,
        class: data.class ?? null,
        subclass: data.subclass ?? null,
        race: data.race ?? null,
        level: data.level,
        hp: data.hp ?? null,
        ac: data.ac ?? null,
        status: data.status,
        notes: data.notes ?? null,
        tags: "[]",
      },
    });

    await changeLogService.log({
      campaignId: data.campaignId,
      entityType: "player",
      entityId: player.id,
      beforeJson: null,
      afterJson: JSON.stringify(player),
      reason: "Player character created",
      source: "user",
      authorType: "user",
    });

    return reply.status(201).send({ success: true, data: player });
  });

  server.patch<{ Params: { id: string }; Body: unknown }>("/:id", async (request) => {
    const schema = z.object({
      name: z.string().optional(),
      playerName: z.string().nullish(),
      class: z.string().nullish(),
      subclass: z.string().nullish(),
      race: z.string().nullish(),
      background: z.string().nullish(),
      alignment: z.string().nullish(),
      level: z.number().int().min(1).max(20).optional(),
      experiencePoints: z.number().int().optional(),
      // Nullable Int fields use .nullish() so the form can send null to clear them
      hp: z.number().int().nullish(),
      hpMax: z.number().int().nullish(),
      hpTemp: z.number().int().nullish(),
      ac: z.number().int().nullish(),
      initiative: z.number().int().nullish(),
      speed: z.number().int().nullish(),
      size: z.string().nullish(),
      shield: z.boolean().optional(),
      hitDice: z.string().nullish(),
      hitDiceSpent: z.number().int().optional(),
      deathSaveSuccesses: z.number().int().optional(),
      deathSaveFailures: z.number().int().optional(),
      exhaustionLevel: z.number().int().optional(),
      strength: z.number().int().min(1).max(30).nullish(),
      dexterity: z.number().int().min(1).max(30).nullish(),
      constitution: z.number().int().min(1).max(30).nullish(),
      intelligence: z.number().int().min(1).max(30).nullish(),
      wisdom: z.number().int().min(1).max(30).nullish(),
      charisma: z.number().int().min(1).max(30).nullish(),
      savingThrows: z.string().optional(),
      skillProficiencies: z.string().optional(),
      skillExpertise: z.string().optional(),
      armorProficiencies: z.string().nullish(),
      armorTraining: z.string().nullish(),
      weaponProficiencies: z.string().nullish(),
      toolProficiencies: z.string().nullish(),
      languages: z.string().nullish(),
      proficiencyBonus: z.number().int().nullish(),
      spellcastingAbility: z.string().nullish(),
      spellSaveDC: z.number().int().nullish(),
      spellAttackBonus: z.number().int().nullish(),
      spellSlots: z.string().optional(),
      spellsPrepared: z.string().optional(),
      cantrips: z.string().optional(),
      spells: z.string().optional(),
      inventory: z.string().optional(),
      weapons: z.string().optional(),
      magicItems: z.string().optional(),
      currency: z.string().optional(),
      features: z.string().optional(),
      speciesTraits: z.string().optional(),
      feats: z.string().optional(),
      classes: z.string().optional(),
      hpRolls: z.string().optional(),
      equippedArmor: z.string().nullish(),
      hpUseAverage: z.boolean().optional(),
      traits: z.string().nullish(),
      ideals: z.string().nullish(),
      bonds: z.string().nullish(),
      flaws: z.string().nullish(),
      backstory: z.string().nullish(),
      age: z.string().nullish(),
      height: z.string().nullish(),
      weight: z.string().nullish(),
      eyes: z.string().nullish(),
      skin: z.string().nullish(),
      hair: z.string().nullish(),
      appearance: z.string().nullish(),
      passivePerception: z.number().int().nullish(),
      inspiration: z.boolean().optional(),
      heroicInspiration: z.boolean().optional(),
      status: z.enum(["active", "inactive", "dead", "retired"]).optional(),
      notes: z.string().nullish(),
      tags: z.string().optional(),
    });

    const data = schema.parse(request.body);
    const existing = await prisma.player.findUnique({ where: { id: request.params.id } });
    if (!existing) throw AppError.notFound(ErrorCode.NOT_FOUND, "Player not found");

    const updated = await prisma.player.update({
      where: { id: request.params.id },
      data,
    });

    await changeLogService.log({
      campaignId: existing.campaignId,
      entityType: "player",
      entityId: existing.id,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
      reason: "Player character updated",
      source: "user",
      authorType: "user",
    });

    return { success: true, data: updated };
  });

  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await prisma.player.findUnique({ where: { id: request.params.id } });
    if (!existing) throw AppError.notFound(ErrorCode.NOT_FOUND, "Player not found");
    await prisma.$transaction(async (tx) => {
      await changeLogService.log(
        {
          campaignId: null,
          entityType: "player",
          entityId: existing.id,
          beforeJson: JSON.stringify(existing),
          afterJson: null,
          reason: "Player deleted",
          source: "user",
          authorType: "user",
        },
        tx
      );
      await tx.player.delete({ where: { id: request.params.id } });
    });
    return reply.status(204).send();
  });
};
