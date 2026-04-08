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

    // Fetch lightweight projection to compute breakdowns in-process
    const chunks = await prisma.documentChunk.findMany({
      where,
      select: { sourceType: true, authorityLevel: true, embeddingJson: true },
    });

    const total = chunks.length;
    const embedded = chunks.filter((c) => c.embeddingJson !== null).length;

    const bySourceType: Record<string, { total: number; embedded: number }> = {};
    const byAuthorityLevel: Record<string, { total: number; embedded: number }> = {};

    for (const chunk of chunks) {
      const isEmbedded = chunk.embeddingJson !== null;

      bySourceType[chunk.sourceType] ??= { total: 0, embedded: 0 };
      bySourceType[chunk.sourceType]!.total++;
      if (isEmbedded) bySourceType[chunk.sourceType]!.embedded++;

      byAuthorityLevel[chunk.authorityLevel] ??= { total: 0, embedded: 0 };
      byAuthorityLevel[chunk.authorityLevel]!.total++;
      if (isEmbedded) byAuthorityLevel[chunk.authorityLevel]!.embedded++;
    }

    return {
      success: true,
      data: {
        totalChunks: total,
        embeddedChunks: embedded,
        pendingChunks: total - embedded,
        coverage: total === 0 ? 0 : Math.round((embedded / total) * 100),
        bySourceType,
        byAuthorityLevel,
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

  // Re-embed documents that still have pending (null) chunks, prioritising HIGH authority first
  server.post<{ Body: unknown }>("/reindex-pending", async (request) => {
    const { campaignId } = z
      .object({ campaignId: z.string().optional() })
      .parse(request.body ?? {});

    const AUTHORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

    // One row per document that has at least one unembedded chunk
    const pendingRows = await prisma.documentChunk.findMany({
      where: {
        embeddingJson: null,
        ...(campaignId
          ? { OR: [{ campaignId }, { campaignId: null as unknown as string }] }
          : {}),
      },
      select: { documentId: true, authorityLevel: true },
      distinct: ["documentId"],
    });

    // Sort HIGH → MEDIUM → LOW so high-authority content is re-embedded first
    pendingRows.sort((a, b) => {
      const aOrd = AUTHORITY_ORDER[a.authorityLevel] ?? 2;
      const bOrd = AUTHORITY_ORDER[b.authorityLevel] ?? 2;
      return aOrd - bOrd;
    });

    let totalEmbedded = 0;
    let totalFailed = 0;

    for (const { documentId } of pendingRows) {
      const result = await embeddingService.embedDocument(documentId);
      totalEmbedded += result.embedded;
      totalFailed += result.failed;
    }

    return {
      success: true,
      data: {
        documentsProcessed: pendingRows.length,
        chunksEmbedded: totalEmbedded,
        chunksFailed: totalFailed,
      },
    };
  });
};
