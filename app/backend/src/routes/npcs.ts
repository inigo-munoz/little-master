import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { npcService } from "../services/npc.service.js";

const TraitEntrySchema = z.union([
  z.string(),
  z.object({ name: z.string(), description: z.string().optional() }),
]);

const ActionEntrySchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    description: z.string().optional(),
    type: z.string().optional(),
    attackBonus: z.number().optional(),
    damage: z.string().optional(),
  }),
]);

function normalizeEntry(entry: z.infer<typeof ActionEntrySchema>): { name: string; description: string } {
  if (typeof entry === "string") return { name: entry, description: "" };
  const e = entry as { name: string; description?: string; attackBonus?: number; damage?: string };
  let desc = e.description ?? "";
  if (!desc && (e.attackBonus != null || e.damage != null)) {
    const parts: string[] = [];
    if (e.damage) parts.push(`daño: ${e.damage}`);
    if (e.attackBonus != null) parts.push(`ataque: +${e.attackBonus}`);
    desc = parts.join(", ");
  }
  return { name: e.name, description: desc };
}

const StatBlockFields = {
  armorClass: z.number().int().optional(),
  hitPoints: z.string().optional(),
  speed: z.string().optional(),
  strength: z.number().int().optional(),
  dexterity: z.number().int().optional(),
  constitution: z.number().int().optional(),
  intelligence: z.number().int().optional(),
  wisdom: z.number().int().optional(),
  charisma: z.number().int().optional(),
  savingThrows: z.string().optional(),
  skills: z.string().optional(),
  resistances: z.string().optional(),
  immunities: z.string().optional(),
  senses: z.string().optional(),
  languages: z.string().optional(),
  challengeRating: z.string().optional(),
  traits: z.array(TraitEntrySchema).optional(),
  actions: z.array(ActionEntrySchema).optional(),
  bonusActions: z.array(ActionEntrySchema).optional(),
  reactions: z.array(ActionEntrySchema).optional(),
  npcType: z.string().optional(),
  npcClass: z.string().optional(),
  npcLevel: z.number().int().optional(),
} as const;

export const npcRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { campaignId: string } }>("/", async (request) => {
    const { campaignId } = z.object({ campaignId: z.string() }).parse(request.query);
    const npcs = await npcService.listByCampaign(campaignId);
    return { success: true, data: npcs };
  });

  server.get<{ Params: { id: string } }>("/:id", async (request) => {
    const npc = await npcService.getById(request.params.id);
    return { success: true, data: npc };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string(),
      name: z.string().min(1).max(200),
      role: z.string().max(200).optional(),
      description: z.string().max(10000).optional(),
      status: z.enum(["alive", "dead", "unknown", "missing"]).default("alive"),
      tags: z.array(z.string()).default([]),
      authorType: z.enum(["user", "assistant"]).default("user"),
      ...StatBlockFields,
    });

    const { authorType, traits, actions, bonusActions, reactions, ...rest } = schema.parse(request.body);
    const data = {
      ...rest,
      traits: traits?.map(normalizeEntry),
      actions: actions?.map(normalizeEntry),
      bonusActions: bonusActions?.map(normalizeEntry),
      reactions: reactions?.map(normalizeEntry),
    };
    const serviceAuthorType = authorType === "assistant" ? "ai" : "user";
    const npc = await npcService.create(data as any, serviceAuthorType);
    return reply.status(201).send({ success: true, data: npc });
  });

  server.patch<{ Params: { id: string }; Body: unknown }>("/:id", async (request) => {
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      role: z.string().max(200).optional(),
      description: z.string().max(10000).optional(),
      status: z.enum(["alive", "dead", "unknown", "missing"]).optional(),
      tags: z.array(z.string()).optional(),
      ...StatBlockFields,
    });

    const { traits, actions, bonusActions, reactions, ...rest } = schema.parse(request.body);
    const data = {
      ...rest,
      ...(traits !== undefined && { traits: traits.map(normalizeEntry) }),
      ...(actions !== undefined && { actions: actions.map(normalizeEntry) }),
      ...(bonusActions !== undefined && { bonusActions: bonusActions.map(normalizeEntry) }),
      ...(reactions !== undefined && { reactions: reactions.map(normalizeEntry) }),
    };
    const npc = await npcService.update(request.params.id, data as any, "user");
    return { success: true, data: npc };
  });

  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await npcService.delete(request.params.id);
    return reply.status(204).send();
  });
};
