import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { embeddingService } from "../services/embedding.service.js";
import { keywordSearch } from "../services/keyword-search.js";

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
    const scored = await keywordSearch({ query, campaignId, sourceTypes: allowedSources, limit });
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
