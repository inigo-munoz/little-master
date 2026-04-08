/**
 * Tiered retrieval logic for semantic search.
 * Pure functions — no external dependencies, fully unit-testable.
 *
 * Priority: HIGH (official/srd) → MEDIUM (campaign/homebrew_external) → LOW (homebrew_user/ai_inferred)
 * Unused slots in a lower tier are redistributed to the tier immediately above.
 */

const HIGH_SOURCES = new Set(["official", "srd"]);
const MEDIUM_SOURCES = new Set(["campaign", "homebrew_external"]);

export function getTier(sourceType: string): "high" | "medium" | "low" {
  if (HIGH_SOURCES.has(sourceType)) return "high";
  if (MEDIUM_SOURCES.has(sourceType)) return "medium";
  return "low";
}

/**
 * Select chunks using tiered quotas.
 * Within each tier, chunks are sorted by rawSimilarity descending.
 * Output order: all HIGH chunks first, then MEDIUM, then LOW.
 */
export function selectByTier<T extends { sourceType: string; rawSimilarity: number }>(
  scored: T[],
  limit: number,
  tierQuotas?: { high?: number; medium?: number; low?: number }
): T[] {
  const defaultHigh = Math.round(limit * 0.5);
  const defaultMedium = Math.round(limit * 0.375);
  const defaultLow = Math.max(0, limit - defaultHigh - defaultMedium);

  const quotaHigh = tierQuotas?.high ?? defaultHigh;
  const quotaMedium = tierQuotas?.medium ?? defaultMedium;
  const quotaLow = tierQuotas?.low ?? defaultLow;

  // Separate into tiers, sorted by similarity within each
  const tiers: Record<"high" | "medium" | "low", T[]> = { high: [], medium: [], low: [] };
  for (const r of scored) {
    tiers[getTier(r.sourceType)].push(r);
  }
  for (const key of ["high", "medium", "low"] as const) {
    tiers[key].sort((a, b) => b.rawSimilarity - a.rawSimilarity);
  }

  // Take from each tier, then redistribute unused slots upward
  let takeHigh = Math.min(tiers.high.length, quotaHigh);
  let takeMedium = Math.min(tiers.medium.length, quotaMedium);
  let takeLow = Math.min(tiers.low.length, quotaLow);

  const unusedLow = quotaLow - takeLow;
  takeMedium = Math.min(tiers.medium.length, quotaMedium + unusedLow);

  const unusedMedium = quotaMedium + unusedLow - takeMedium;
  takeHigh = Math.min(tiers.high.length, quotaHigh + unusedMedium);

  return [
    ...tiers.high.slice(0, takeHigh),
    ...tiers.medium.slice(0, takeMedium),
    ...tiers.low.slice(0, takeLow),
  ];
}
