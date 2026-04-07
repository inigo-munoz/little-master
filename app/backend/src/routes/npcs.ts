import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { npcService } from "../services/npc.service.js";

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
    });

    const { authorType, ...data } = schema.parse(request.body);
    const serviceAuthorType = authorType === "assistant" ? "ai" : "user";
    const npc = await npcService.create(data, serviceAuthorType);
    return reply.status(201).send({ success: true, data: npc });
  });

  server.patch<{ Params: { id: string }; Body: unknown }>("/:id", async (request) => {
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      role: z.string().max(200).optional(),
      description: z.string().max(10000).optional(),
      status: z.enum(["alive", "dead", "unknown", "missing"]).optional(),
      tags: z.array(z.string()).optional(),
    });

    const data = schema.parse(request.body);
    const npc = await npcService.update(request.params.id, data, "user");
    return { success: true, data: npc };
  });

  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await npcService.delete(request.params.id);
    return reply.status(204).send();
  });
};
