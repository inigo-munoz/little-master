import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { embeddingService } from "../services/embedding.service.js";

export const embeddingRoutes: FastifyPluginAsync = async (server) => {
  // Overall embedding status for a campaign
  server.get<{ Querystring: { campaignId?: string } }>("/status", async (request) => {
    const { campaignId } = z
      .object({ campaignId: z.string().optional() })
      .parse(request.query);

    const where = campaignId
      ? { OR: [{ campaignId }, { campaignId: null as unknown as string }] }
      : {};

    const [total, embedded] = await Promise.all([
      prisma.documentChunk.count({ where }),
      prisma.documentChunk.count({ where: { ...where, embeddingJson: { not: null } } }),
    ]);

    return {
      success: true,
      data: {
        totalChunks: total,
        embeddedChunks: embedded,
        pendingChunks: total - embedded,
        coverage: total === 0 ? 0 : Math.round((embedded / total) * 100),
      },
    };
  });

  // Embed all pending chunks (useful for initial migration)
  server.post<{ Body: unknown }>("/embed-all", async (request) => {
    const { campaignId } = z
      .object({ campaignId: z.string().optional() })
      .parse(request.body ?? {});

    const documents = await prisma.document.findMany({
      where: campaignId
        ? { OR: [{ campaignId }, { campaignId: null }] }
        : {},
      select: { id: true },
    });

    let totalEmbedded = 0;
    let totalFailed = 0;

    for (const doc of documents) {
      const result = await embeddingService.embedDocument(doc.id);
      totalEmbedded += result.embedded;
      totalFailed += result.failed;
    }

    return {
      success: true,
      data: {
        documentsProcessed: documents.length,
        chunksEmbedded: totalEmbedded,
        chunksFailed: totalFailed,
      },
    };
  });
};
