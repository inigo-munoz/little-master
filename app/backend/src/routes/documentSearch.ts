import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { embeddingService } from "../services/embedding.service.js";

export const documentSearchRoutes: FastifyPluginAsync = async (server) => {
  server.get<{
    Querystring: {
      query: string;
      campaignId?: string;
      limit?: string;
      sourceTypes?: string;
      mode?: string;
    };
  }>("/search", async (request) => {
    const { query, campaignId, limit, sourceTypes, mode } = z
      .object({
        query: z.string().min(1).max(500),
        campaignId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(20).default(8),
        sourceTypes: z.string().optional(),
        mode: z.enum(["semantic", "keyword", "auto"]).default("auto"),
      })
      .parse(request.query);

    const allowedSources = sourceTypes?.split(",").filter(Boolean);

    if (mode === "semantic" || mode === "auto") {
      try {
        const results = await embeddingService.search({
          query,
          campaignId,
          sourceTypes: allowedSources,
          limit,
          minScore: 0.25,
        });

        if (results.length > 0) {
          return { success: true, data: results, meta: { method: "semantic", count: results.length } };
        }

        if (mode === "semantic") {
          return { success: true, data: [], meta: { method: "semantic", count: 0 } };
        }
      } catch (err: unknown) {
        request.log.warn({ err }, "Semantic search failed, falling back to keyword");
        if (mode === "semantic") throw err;
      }
    }

    // Keyword fallback
    const tokens = query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 5);

    if (tokens.length === 0) {
      return { success: true, data: [], meta: { method: "keyword", count: 0 } };
    }

    const primaryToken = tokens[0];

    const chunks = await prisma.documentChunk.findMany({
      where: {
        AND: [
          { OR: [...(campaignId ? [{ campaignId }] : []), { campaignId: null }] },
          { content: { contains: primaryToken } },
          ...(allowedSources?.length ? [{ sourceType: { in: allowedSources } }] : []),
        ],
      },
      include: { document: { select: { title: true } } },
      take: limit * 3,
    });

    const authorityScore = { high: 0.15, medium: 0.07, low: 0 };

    const scored = chunks
      .map((chunk: typeof chunks[number]) => {
        const text = chunk.content.toLowerCase();
        const tokenHits = tokens.filter((t) => text.includes(t)).length;
        const relevanceScore =
          tokenHits / tokens.length +
          (authorityScore[chunk.authorityLevel as keyof typeof authorityScore] ?? 0);
        return {
          id: chunk.id,
          content: chunk.content,
          sourceType: chunk.sourceType,
          authorityLevel: chunk.authorityLevel,
          documentTitle: chunk.document.title,
          chunkIndex: chunk.chunkIndex,
          relevanceScore,
          rawSimilarity: tokenHits / tokens.length,
        };
      })
      .filter((c: { relevanceScore: number }) => c.relevanceScore > 0)
      .sort((a: { relevanceScore: number }, b: { relevanceScore: number }) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return { success: true, data: scored, meta: { method: "keyword", count: scored.length } };
  });

  server.post<{ Params: { id: string } }>("/:id/embed", async (request) => {
    const { documentService } = await import("../services/document.service.js");
    const content = await documentService.readContent(request.params.id);
    const chunkCount = await documentService.indexDocument(request.params.id, content);
    const result = await embeddingService.embedDocument(request.params.id);
    return { success: true, data: { chunkCount, embedded: result.embedded, failed: result.failed } };
  });
};
