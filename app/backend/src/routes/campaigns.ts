import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { campaignService } from "../services/campaign.service.js";

// Hardcoded userId for MVP — Sprint 2 adds real auth
const MVP_USER_ID = "default-user";

export const campaignRoutes: FastifyPluginAsync = async (server) => {
  server.get("/", async () => {
    const campaigns = await campaignService.list(MVP_USER_ID);
    return { success: true, data: campaigns };
  });

  server.get<{ Params: { id: string } }>("/:id", async (request) => {
    const campaign = await campaignService.getById(request.params.id, MVP_USER_ID);
    return { success: true, data: campaign };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      system: z.string().default("D&D 2024"),
    });

    const data = schema.parse(request.body);
    const campaign = await campaignService.create(data, MVP_USER_ID);
    return reply.status(201).send({ success: true, data: campaign });
  });

  server.patch<{ Params: { id: string }; Body: unknown }>("/:id", async (request) => {
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      system: z.string().optional(),
      status: z.enum(["active", "paused", "completed", "archived"]).optional(),
    });

    const data = schema.parse(request.body);
    const campaign = await campaignService.update(request.params.id, MVP_USER_ID, data);
    return { success: true, data: campaign };
  });

  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await campaignService.delete(request.params.id, MVP_USER_ID);
    return reply.status(204).send();
  });
};
