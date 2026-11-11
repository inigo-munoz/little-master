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
import { selectByTier } from "./embedding-tiers.js";

// text-embedding-3-small: 1536 dims, cheap, good quality
const EMBEDDING_MODEL = "text-embedding-3-small";

// ─── In-process vector cache ──────────────────────────────────────────────────
// Parsing every stored vector (≈30 KB of JSON each) on every query does not scale, so
// the parsed vectors are kept in memory. The cache is keyed by a cheap fingerprint of
// the embedded chunks (count + highest id): any insert, delete or newly embedded chunk
// changes it, including writes made by other processes such as the import scripts.
// Embedding writes in this process also invalidate it explicitly.

interface CachedVector {
  id: string;
  campaignId: string | null;
  sourceType: string;
  authorityLevel: string;
  vector: Float32Array;
  norm: number;
}

let vectorCache: { fingerprint: string; vectors: CachedVector[] } | null = null;
let vectorCacheLoad: Promise<CachedVector[]> | null = null;

async function embeddedChunksFingerprint(): Promise<string> {
  const stats = await prisma.documentChunk.aggregate({
    where: { embeddingJson: { not: null } },
    _count: { _all: true },
    _max: { id: true },
  });
  return `${stats._count._all}:${stats._max.id ?? ""}`;
}

function vectorNorm(vector: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) sum += vector[i]! * vector[i]!;
  return Math.sqrt(sum);
}

async function loadVectors(): Promise<CachedVector[]> {
  // Take the fingerprint before reading: a write that lands mid-load changes the
  // fingerprint again, so the next query reloads instead of keeping a stale cache.
  const fingerprint = await embeddedChunksFingerprint();
  if (vectorCache?.fingerprint === fingerprint) return vectorCache.vectors;

  const rows = await prisma.documentChunk.findMany({
    where: { embeddingJson: { not: null } },
    select: { id: true, campaignId: true, sourceType: true, authorityLevel: true, embeddingJson: true },
  });
  const vectors = rows.map((row) => {
    const vector = Float32Array.from(JSON.parse(row.embeddingJson!) as number[]);
    return {
      id: row.id,
      campaignId: row.campaignId,
      sourceType: row.sourceType,
      authorityLevel: row.authorityLevel,
      vector,
      norm: vectorNorm(vector),
    };
  });
  vectorCache = { fingerprint, vectors };
  return vectors;
}

function getVectors(): Promise<CachedVector[]> {
  // Concurrent queries share one load instead of each parsing every vector
  vectorCacheLoad ??= loadVectors().finally(() => {
    vectorCacheLoad = null;
  });
  return vectorCacheLoad;
}

function similarity(query: number[], queryNorm: number, cached: CachedVector): number {
  if (query.length !== cached.vector.length || queryNorm === 0 || cached.norm === 0) return 0;
  let dot = 0;
  for (let i = 0; i < query.length; i++) dot += query[i]! * cached.vector[i]!;
  return dot / (queryNorm * cached.norm);
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
  /** Drops the in-memory vectors; the next search reloads them. */
  invalidateVectorCache(): void {
    vectorCache = null;
  },

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
        batch.map(async (chunk: typeof chunks[number]) => {
          try {
            const vector = await provider.embedText(chunk.content.slice(0, 8000));
            await prisma.documentChunk.update({
              where: { id: chunk.id },
              data: { embeddingJson: JSON.stringify(vector) },
            });
            embedded++;
          } catch (err: unknown) {
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

    if (embedded > 0) this.invalidateVectorCache();
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
    tierQuotas?: { high?: number; medium?: number; low?: number };
  }): Promise<SemanticSearchResult[]> {
    const { query, campaignId, sourceTypes, limit = 8, minScore = 0.3, tierQuotas } = input;

    // Get query embedding
    const queryVector = await this.embed(query);

    const queryNorm = vectorNorm(queryVector);
    const vectors = await getVectors();

    const scored = vectors
      .filter((v) =>
        (campaignId ? v.campaignId === campaignId || v.campaignId === null : v.campaignId === null) &&
        (!sourceTypes?.length || sourceTypes.includes(v.sourceType))
      )
      .map((v) => ({ ...v, rawSimilarity: similarity(queryVector, queryNorm, v) }))
      .filter((v) => v.rawSimilarity >= minScore);

    if (scored.length === 0) return [];

    // Tiered selection: HIGH sources always fill their quota before MEDIUM/LOW
    const selected = selectByTier(scored, limit, tierQuotas);

    // Only the winners need their text, so load content for those rows alone
    const rows = await prisma.documentChunk.findMany({
      where: { id: { in: selected.map((v) => v.id) } },
      select: { id: true, content: true, chunkIndex: true, document: { select: { title: true } } },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));

    return selected.flatMap((v) => {
      const row = rowById.get(v.id);
      if (!row) return []; // deleted after the vectors were cached
      return [{
        id: v.id,
        content: row.content,
        sourceType: v.sourceType,
        authorityLevel: v.authorityLevel,
        documentTitle: row.document.title,
        chunkIndex: row.chunkIndex,
        relevanceScore: v.rawSimilarity,
        rawSimilarity: v.rawSimilarity,
      }];
    });
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
