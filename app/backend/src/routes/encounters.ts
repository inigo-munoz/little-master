import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";

export const encounterRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { campaignId: string; limit?: string } }>("/", async (request) => {
    const { campaignId, limit } = z
      .object({ campaignId: z.string(), limit: z.string().optional() })
      .parse(request.query);
    const take = limit ? Math.min(parseInt(limit, 10), 100) : undefined;
    const encounters = await prisma.encounter.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      ...(take ? { take } : {}),
    });
    return {
      success: true,
      data: encounters.map((e) => ({
        ...e,
        monsters: JSON.parse(e.monsters),
      })),
    };
  });

  server.get<{ Params: { id: string } }>("/:id", async (request) => {
    const encounter = await prisma.encounter.findUnique({ where: { id: request.params.id } });
    if (!encounter) throw AppError.notFound(ErrorCode.NOT_FOUND, "Encounter not found");
    return { success: true, data: { ...encounter, monsters: JSON.parse(encounter.monsters) } };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string(),
      title: z.string().optional(),
      monsters: z.array(z.object({
        name: z.string(),
        cr: z.string(),
        count: z.number().int().min(1),
      })),
      partySize: z.number().int().min(1),
      partyLevel: z.number().int().min(1).max(20),
      baseXp: z.number().int().min(0),
      adjustedXp: z.number().int().min(0),
      difficulty: z.enum(["trivial", "easy", "medium", "hard", "deadly", "impossible"]),
      notes: z.string().optional(),
    });

    const data = schema.parse(request.body);
    const encounter = await prisma.encounter.create({
      data: {
        campaignId: data.campaignId,
        title: data.title ?? null,
        monsters: JSON.stringify(data.monsters),
        partySize: data.partySize,
        partyLevel: data.partyLevel,
        baseXp: data.baseXp,
        adjustedXp: data.adjustedXp,
        difficulty: data.difficulty,
        notes: data.notes ?? null,
      },
    });

    return reply.status(201).send({
      success: true,
      data: { ...encounter, monsters: JSON.parse(encounter.monsters) },
    });
  });

  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await prisma.encounter.findUnique({ where: { id: request.params.id } });
    if (!existing) throw AppError.notFound(ErrorCode.NOT_FOUND, "Encounter not found");
    await prisma.encounter.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
};
