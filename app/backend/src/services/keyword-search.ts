import { prisma } from "../db/prisma.js";
import type { SemanticSearchResult } from "./embedding.service.js";

/**
 * Keyword retrieval used when semantic search is unavailable (no embeddings yet, no
 * OpenAI key, provider down). Shared by the chat context builder and the document
 * search endpoint so both rank the same way.
 */

const MAX_TOKENS = 6;
// Candidates are fetched unordered and ranked in memory, so the cap must comfortably
// exceed the matches for generic terms; otherwise they crowd out the best chunks.
const MAX_CANDIDATES = 5000;
const AUTHORITY_BOOST: Record<string, number> = { high: 0.15, medium: 0.07, low: 0 };

// Common Spanish and English words that carry no retrieval signal. Tokens of 1-2
// characters are dropped separately.
const STOPWORDS = new Set([
  // Spanish
  "como", "cómo", "que", "qué", "cual", "cuál", "cuales", "cuáles", "quien", "quién",
  "donde", "dónde", "cuando", "cuándo", "cuanto", "cuánto", "por", "para", "con", "sin",
  "sobre", "entre", "hasta", "desde", "una", "uno", "unos", "unas", "los", "las", "del",
  "esto", "esta", "este", "eso", "esa", "ese", "estos", "estas", "esos", "esas", "hay",
  "son", "está", "están", "ser", "tiene", "tienen", "puede", "pueden", "mis", "sus",
  "tus", "más", "mas", "muy", "pero", "porque", "también", "otro", "otra", "todo", "toda",
  "nos", "les", "fue", "era",
  // English
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "what", "which", "who",
  "whom", "how", "does", "did", "doing", "this", "that", "these", "those", "from", "into",
  "about", "can", "could", "should", "would", "will", "have", "has", "had", "was", "were",
  "been", "being", "its", "they", "them", "their", "there", "when", "where", "why",
  "any", "all", "some", "more", "most", "other", "than", "then", "also", "just",
]);

/** Splits a query into distinct, meaningful, lowercased terms (Unicode-aware). */
export function tokenizeQuery(query: string): string[] {
  const words = query.normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokens: string[] = [];
  for (const word of words) {
    if (word.length <= 2 || STOPWORDS.has(word) || tokens.includes(word)) continue;
    tokens.push(word);
    if (tokens.length === MAX_TOKENS) break;
  }
  return tokens;
}

// SQLite LIKE only folds ASCII case, so "ácido" would miss "Ácido" and "ÁCIDO".
function caseVariants(token: string): string[] {
  const capitalized = token.charAt(0).toUpperCase() + token.slice(1);
  return [...new Set([token, capitalized, token.toUpperCase()])];
}

export interface KeywordSearchOptions {
  query: string;
  /** Campaign chunks plus global ones; without it, only global chunks are searched. */
  campaignId?: string;
  sourceTypes?: string[];
  limit: number;
}

export async function keywordSearch(options: KeywordSearchOptions): Promise<SemanticSearchResult[]> {
  const { query, campaignId, sourceTypes, limit } = options;
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const chunks = await prisma.documentChunk.findMany({
    where: {
      AND: [
        { OR: [...(campaignId ? [{ campaignId }] : []), { campaignId: null }] },
        { OR: tokens.flatMap(caseVariants).map((variant) => ({ content: { contains: variant } })) },
        ...(sourceTypes?.length ? [{ sourceType: { in: sourceTypes } }] : []),
      ],
    },
    select: {
      id: true,
      content: true,
      sourceType: true,
      authorityLevel: true,
      chunkIndex: true,
      document: { select: { title: true } },
    },
    take: MAX_CANDIDATES,
  });

  return chunks
    .map((chunk) => {
      const text = chunk.content.normalize("NFC").toLowerCase();
      const coverage = tokens.filter((t) => text.includes(t)).length / tokens.length;
      return {
        id: chunk.id,
        content: chunk.content,
        sourceType: chunk.sourceType,
        authorityLevel: chunk.authorityLevel,
        documentTitle: chunk.document.title,
        chunkIndex: chunk.chunkIndex,
        relevanceScore: coverage + (AUTHORITY_BOOST[chunk.authorityLevel] ?? 0),
        rawSimilarity: coverage,
      };
    })
    .filter((result) => result.rawSimilarity > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}
