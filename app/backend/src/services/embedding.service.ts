/**
 * Embedding Service
 *
 * Responsibilities:
 * - Generate embeddings via the active LLM provider (or a dedicated embeddings provider)
 * - Store embeddings as JSON arrays in SQLite (MVP)
 * - Perform cosine similarity search in-process
 *
 * SQLite note: We store embeddings as JSON strings because SQLite has no native
 * vector type. For anything beyond a few thousand chunks, migrate to PostgreSQL
 * + pgvector. The interface here is designed so that migration only touches this
 * file — callers never deal with the storage format directly.
 */

import { prisma } from "../db/prisma.js";
import { llmConfigService } from "./llmConfig.service.js";
import { OpenAIProvider } from "@dnd/llm-providers";
import { AppError, ErrorCode } from "@dnd/shared";

// text-embedding-3-small: 1536 dims, cheap, good quality
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

// ─── Cosine similarity ────────────────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Get embeddings provider ──────────────────────────────────────────────────
// For now: always OpenAI (only provider with public embeddings API).
// Anthropic doesn't have one. Ollama can serve local embedding models — Sprint 3.
async function getEmbeddingProvider(): Promise<OpenAIProvider> {
  const { provider, apiKey } = await llmConfigService.getActiveKey();

  if (provider !== "openai") {
    // Try to find an OpenAI config even if it's not the active chat provider
    const configs = await prisma.llmConfig.findFirst({
      where: { provider: "openai", apiKeyEncrypted: { not: null } },
    });

    if (!configs) {
      throw new AppError(
        ErrorCode.LLM_PROVIDER_ERROR,
        "Embeddings require an OpenAI API key. Configure OpenAI in Settings.",
        400
      );
    }

    const { decrypt } = await import("../crypto/encryption.js");
    const { env } = await import("../config/env.js");
    const key = decrypt(configs.apiKeyEncrypted!, env.ENCRYPTION_KEY);
    return new OpenAIProvider(key, EMBEDDING_MODEL);
  }

  if (!apiKey) {
    throw new AppError(ErrorCode.LLM_INVALID_API_KEY, "No API key available", 400);
  }

  return new OpenAIProvider(apiKey, EMBEDDING_MODEL);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const embeddingService = {
  /**
   * Generate an embedding vector for a text string.
   * Cached per chunk — do not call this on the same text twice.
   */
  async embed(text: string): Promise<number[]> {
    const provider = await getEmbeddingProvider();
    return provider.embedText(text.slice(0, 8000)); // truncate to ~8k chars safety limit
  },

  /**
   * Generate and persist embeddings for all un-embedded chunks of a document.
   * Called after document indexing (chunking) is complete.
   */
  async embedDocument(documentId: string): Promise<{ embedded: number; failed: number }> {
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId, embeddingJson: null },
      orderBy: { chunkIndex: "asc" },
    });

    if (chunks.length === 0) return { embedded: 0, failed: 0 };

    const provider = await getEmbeddingProvider();
    let embedded = 0;
    let failed = 0;

    // Batch in groups of 20 to avoid rate limits
    const BATCH_SIZE = 20;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (chunk: any) => {
          try {
            const vector = await provider.embedText(chunk.content.slice(0, 8000));
            await prisma.documentChunk.update({
              where: { id: chunk.id },
              data: { embeddingJson: JSON.stringify(vector) },
            });
            embedded++;
          } catch (err) {
            console.error(`Failed to embed chunk ${chunk.id}:`, err);
            failed++;
          }
        })
      );

      // Small delay between batches
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return { embedded, failed };
  },

  /**
   * Semantic search: embed the query, then rank chunks by cosine similarity.
   * Returns results sorted by relevance, with source authority as tiebreaker.
   */
  async search(input: {
    query: string;
    campaignId?: string;
    sourceTypes?: string[];
    limit?: number;
    minScore?: number;
  }): Promise<SemanticSearchResult[]> {
    const { query, campaignId, sourceTypes, limit = 8, minScore = 0.3 } = input;

    // Get query embedding
    const queryVector = await this.embed(query);

    // Fetch candidates — only chunks that have been embedded
    const candidates = await prisma.documentChunk.findMany({
      where: {
        embeddingJson: { not: null },
        ...(campaignId
          ? { OR: [{ campaignId }, { campaignId: null }] }
          : { campaignId: null }),
        ...(sourceTypes?.length ? { sourceType: { in: sourceTypes } } : {}),
      },
      include: {
        document: { select: { title: true, sourceType: true } },
      },
    });

    if (candidates.length === 0) return [];

    // Score each candidate
    const authorityBoost: Record<string, number> = { high: 0.05, medium: 0.02, low: 0 };

    const scored = candidates
      .map((chunk: any) => {
        const chunkVector = JSON.parse(chunk.embeddingJson!) as number[];
        const similarity = cosineSimilarity(queryVector, chunkVector);
        const boost = authorityBoost[chunk.authorityLevel] ?? 0;

        return {
          id: chunk.id,
          content: chunk.content,
          sourceType: chunk.sourceType,
          authorityLevel: chunk.authorityLevel,
          documentTitle: chunk.document.title,
          chunkIndex: chunk.chunkIndex,
          relevanceScore: similarity + boost,
          rawSimilarity: similarity,
        };
      })
      .filter((r: any) => r.rawSimilarity >= minScore)
      .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return scored;
  },
};

export interface SemanticSearchResult {
  id: string;
  content: string;
  sourceType: string;
  authorityLevel: string;
  documentTitle: string;
  chunkIndex: number;
  relevanceScore: number;
  rawSimilarity: number;
}
