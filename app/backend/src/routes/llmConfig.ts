import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { llmConfigService } from "../services/llmConfig.service.js";
import { oauthService } from "../services/oauth.service.js";
import { prisma } from "../db/prisma.js";

export const llmConfigRoutes: FastifyPluginAsync = async (server) => {
  server.get("/", async () => {
    const configs = await llmConfigService.list();
    return { success: true, data: configs };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      provider: z.enum(["openai", "anthropic", "openrouter", "ollama"]),
      model: z.string().min(1),
      apiKey: z.string().min(1).optional(),
    });

    const { provider, model, apiKey } = schema.parse(request.body);
    const config = await llmConfigService.upsert(provider, model, apiKey);
    return reply.status(201).send({ success: true, data: config });
  });

  server.post<{ Body: unknown }>("/validate", async (request) => {
    const schema = z.object({
      provider: z.enum(["openai", "anthropic", "openrouter", "ollama"]),
      apiKey: z.string().min(1),
    });

    const { provider, apiKey } = schema.parse(request.body);
    const valid = await llmConfigService.validateKey(provider, apiKey);
    return { success: true, data: { valid } };
  });

  server.post<{ Params: { id: string } }>("/:id/activate", async (request) => {
    const config = await llmConfigService.activate(request.params.id);
    return { success: true, data: config };
  });

  server.patch<{ Body: unknown }>("/oauth/model", async (request, reply) => {
    const schema = z.object({ model: z.string().min(1) });
    const { model } = schema.parse(request.body);

    const config = await prisma.llmConfig.findFirst({
      where: { provider: "openai-codex" },
    });

    if (!config) {
      return reply.status(404).send({ success: false });
    }

    await prisma.llmConfig.update({
      where: { id: config.id },
      data: { model },
    });

    return { success: true, data: { model } };
  });

  server.get("/oauth/start", async () => {
    const { authUrl } = await oauthService.startOAuth();
    return { success: true, data: { authUrl } };
  });

  server.get("/oauth/status", async () => {
    const status = await oauthService.getOAuthStatus();
    return { success: true, data: status };
  });

  server.post("/oauth/disconnect", async () => {
    await oauthService.disconnectOAuth();
    return { success: true, data: { disconnected: true } };
  });
};
