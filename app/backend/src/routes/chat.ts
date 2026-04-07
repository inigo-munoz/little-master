import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { chatService } from "../services/chat.service.js";
import { prisma } from "../db/prisma.js";

export const chatRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Body: unknown }>("/", async (request) => {
    const schema = z.object({
      campaignId: z.string().optional(),
      mode: z.enum([
        "archivista",
        "designer",
        "rule_reviewer",
        "auditor",
        "session_director",
      ]),
      messages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1),
          })
        )
        .min(1),
    });

    const data = schema.parse(request.body);
    const result = await chatService.chat(data);
    return { success: true, data: result };
  });

  // History of assistant runs for a campaign
  server.get<{ Querystring: { campaignId: string; limit?: string } }>(
    "/history",
    async (request) => {
      const { campaignId, limit } = z
        .object({
          campaignId: z.string(),
          limit: z.coerce.number().int().positive().max(50).default(20),
        })
        .parse(request.query);

      const runs = await prisma.assistantRun.findMany({
        where: { campaignId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          mode: true,
          prompt: true,
          response: true,
          tokensUsed: true,
          toolsUsed: true,
          contextChunks: true,
          createdAt: true,
        },
      });

      return { success: true, data: runs };
    }
  );
};
