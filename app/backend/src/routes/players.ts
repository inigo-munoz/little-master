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
      entityType: "npc",
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
      playerName: z.string().optional(),
      class: z.string().optional(),
      subclass: z.string().optional(),
      race: z.string().optional(),
      background: z.string().optional(),
      alignment: z.string().optional(),
      level: z.number().int().min(1).max(20).optional(),
      experiencePoints: z.number().int().optional(),
      hp: z.number().int().optional(),
      hpMax: z.number().int().optional(),
      hpTemp: z.number().int().optional(),
      ac: z.number().int().optional(),
      initiative: z.number().int().optional(),
      speed: z.number().int().optional(),
      hitDice: z.string().optional(),
      strength: z.number().int().min(1).max(30).optional(),
      dexterity: z.number().int().min(1).max(30).optional(),
      constitution: z.number().int().min(1).max(30).optional(),
      intelligence: z.number().int().min(1).max(30).optional(),
      wisdom: z.number().int().min(1).max(30).optional(),
      charisma: z.number().int().min(1).max(30).optional(),
      savingThrows: z.string().optional(),
      skillProficiencies: z.string().optional(),
      skillExpertise: z.string().optional(),
      armorProficiencies: z.string().optional(),
      weaponProficiencies: z.string().optional(),
      toolProficiencies: z.string().optional(),
      languages: z.string().optional(),
      spellcastingAbility: z.string().optional(),
      spellSaveDC: z.number().int().optional(),
      spellAttackBonus: z.number().int().optional(),
      spellSlots: z.string().optional(),
      spellsKnown: z.string().optional(),
      cantrips: z.string().optional(),
      inventory: z.string().optional(),
      currency: z.string().optional(),
      features: z.string().optional(),
      traits: z.string().optional(),
      ideals: z.string().optional(),
      bonds: z.string().optional(),
      flaws: z.string().optional(),
      backstory: z.string().optional(),
      age: z.string().optional(),
      height: z.string().optional(),
      weight: z.string().optional(),
      eyes: z.string().optional(),
      skin: z.string().optional(),
      hair: z.string().optional(),
      appearance: z.string().optional(),
      passivePerception: z.number().int().optional(),
      inspiration: z.boolean().optional(),
      status: z.enum(["active", "inactive", "dead", "retired"]).optional(),
      notes: z.string().optional(),
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
      entityType: "npc",
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
    await prisma.player.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
};
