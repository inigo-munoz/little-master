import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { llmConfigService } from "../services/llmConfig.service.js";

export const llmConfigRoutes: FastifyPluginAsync = async (server) => {
  // List configs — safe view, no keys exposed
  server.get("/", async () => {
    const configs = await llmConfigService.list();
    return { success: true, data: configs };
  });

  // Save or update a provider config + encrypted key
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

  // Validate a key before saving
  server.post<{ Body: unknown }>("/validate", async (request) => {
    const schema = z.object({
      provider: z.enum(["openai", "anthropic", "openrouter", "ollama"]),
      apiKey: z.string().min(1),
    });

    const { provider, apiKey } = schema.parse(request.body);
    const valid = await llmConfigService.validateKey(provider, apiKey);
    return { success: true, data: { valid } };
  });

  // Activate a config (only one active at a time)
  server.post<{ Params: { id: string } }>("/:id/activate", async (request) => {
    const config = await llmConfigService.activate(request.params.id);
    return { success: true, data: config };
  });
};
