import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { changeLogService } from "../services/changeLog.service.js";
import { AppError, ErrorCode, RELATION_TYPES, getRelationPairKey } from "@dnd/shared";

const ENTITY_TYPES = ["npc", "faction", "location"] as const;
type EntityKind = (typeof ENTITY_TYPES)[number];

async function resolveEntityName(
  type: EntityKind,
  id: string
): Promise<string | null> {
  if (type === "npc") {
    const e = await prisma.npc.findUnique({ where: { id }, select: { name: true } });
    return e?.name ?? null;
  }
  if (type === "faction") {
    const e = await prisma.faction.findUnique({ where: { id }, select: { name: true } });
    return e?.name ?? null;
  }
  const e = await prisma.location.findUnique({ where: { id }, select: { name: true } });
  return e?.name ?? null;
}

export const relationRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/relations?campaignId=X&entityType=npc&entityId=Y
  server.get<{ Querystring: unknown }>("/", async (request) => {
    const { campaignId, entityType, entityId } = z
      .object({
        campaignId: z.string(),
        entityType: z.enum(ENTITY_TYPES),
        entityId: z.string(),
      })
      .parse(request.query);

    const rows = await prisma.entityRelation.findMany({
      where: {
        campaignId,
        OR: [
          { fromType: entityType, fromId: entityId },
          { toType: entityType, toId: entityId },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const data = await Promise.all(
      rows.map(async (r: typeof rows[number]) => {
        const isFrom = r.fromType === entityType && r.fromId === entityId;
        const relatedType = (isFrom ? r.toType : r.fromType) as EntityKind;
        const relatedId = isFrom ? r.toId : r.fromId;
        const name = await resolveEntityName(relatedType, relatedId);
        return {
          id: r.id,
          relationType: r.relationType,
          notes: r.notes,
          direction: isFrom ? "from" : ("to" as const),
          entity: { type: relatedType, id: relatedId, name: name ?? "(eliminado)" },
        };
      })
    );

    return { success: true, data };
  });

  // POST /api/relations
  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string(),
      fromType: z.enum(ENTITY_TYPES),
      fromId: z.string(),
      toType: z.enum(ENTITY_TYPES),
      toId: z.string(),
      relationType: z.string().min(1),
      notes: z.string().max(500).optional().nullable(),
    });

    const data = schema.parse(request.body);

    const pairKey = getRelationPairKey(data.fromType, data.toType);
    if (!pairKey) {
      throw AppError.validation(
        `Par de tipos inválido: ${data.fromType}-${data.toType}`
      );
    }

    const validTypes = RELATION_TYPES[pairKey] as readonly string[];
    if (!validTypes.includes(data.relationType)) {
      throw AppError.validation(
        `Tipo de relación "${data.relationType}" no válido para el par ${pairKey}`
      );
    }

    const relation = await prisma.entityRelation.create({
      data: {
        campaignId: data.campaignId,
        fromType: data.fromType,
        fromId: data.fromId,
        toType: data.toType,
        toId: data.toId,
        relationType: data.relationType,
        notes: data.notes ?? null,
      },
    });

    await changeLogService.log({
      campaignId: data.campaignId,
      entityType: "relation",
      entityId: relation.id,
      beforeJson: null,
      afterJson: JSON.stringify(relation),
      reason: `Relación ${data.fromType}→${data.toType} creada: ${data.relationType}`,
      source: "user",
      authorType: "user",
    });

    return reply.status(201).send({ success: true, data: relation });
  });

  // DELETE /api/relations/:id
  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await prisma.entityRelation.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) {
      throw AppError.notFound(ErrorCode.NOT_FOUND, "Relación no encontrada");
    }

    await prisma.entityRelation.delete({ where: { id: request.params.id } });

    await changeLogService.log({
      campaignId: existing.campaignId,
      entityType: "relation",
      entityId: existing.id,
      beforeJson: JSON.stringify(existing),
      afterJson: null,
      reason: `Relación ${existing.fromType}→${existing.toType} eliminada`,
      source: "user",
      authorType: "user",
    });

    return reply.status(204).send();
  });
};
