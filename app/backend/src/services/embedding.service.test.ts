import { describe, it, expect } from "vitest";
import { selectByTier } from "./embedding-tiers.js";

// Helper to build minimal scored chunks
function chunk(sourceType: string, rawSimilarity: number) {
  return { sourceType, rawSimilarity };
}

describe("selectByTier", () => {
  it("chunks de HIGH aparecen antes que MEDIUM aunque tengan menor similitud coseno", () => {
    const scored = [
      chunk("srd", 0.54),               // HIGH, similitud más baja
      chunk("homebrew_external", 0.60), // MEDIUM, similitud más alta
    ];

    const result = selectByTier(scored, 8);

    expect(result[0]!.sourceType).toBe("srd");
    expect(result[1]!.sourceType).toBe("homebrew_external");
  });

  it("slots sobrantes de LOW se redistribuyen a MEDIUM", () => {
    // LOW tiene 0 chunks → su cuota (1) pasa a MEDIUM
    // Para que MEDIUM pueda absorberla necesita >3 chunks disponibles
    const scored = [
      chunk("srd", 0.9),
      chunk("srd", 0.8),
      chunk("srd", 0.7),
      chunk("srd", 0.6),
      chunk("campaign", 0.85),
      chunk("campaign", 0.75),
      chunk("campaign", 0.65),
      chunk("campaign", 0.55), // 4º chunk MEDIUM para poder absorber slot sobrante
      // sin ai_inferred ni homebrew_user
    ];

    // Con limit=8: HIGH=4, MEDIUM=3, LOW=1. LOW tiene 0 → slot va a MEDIUM
    const result = selectByTier(scored, 8);

    const mediumCount = result.filter((r) => r.sourceType === "campaign").length;
    // MEDIUM absorbe el slot sobrante de LOW: 3 + 1 = 4
    expect(mediumCount).toBe(4);
    expect(result.length).toBe(8);
  });

  it("slots sobrantes de MEDIUM se redistribuyen a HIGH", () => {
    // MEDIUM tiene 0 chunks, LOW tiene 0 → ambas cuotas van a HIGH
    const scored = [
      chunk("srd", 0.9),
      chunk("srd", 0.8),
      chunk("srd", 0.7),
      chunk("srd", 0.6),
      chunk("srd", 0.5),
      chunk("srd", 0.4),
      // sin campaign, homebrew, ai_inferred
    ];

    // Con limit=8: HIGH=4, MEDIUM=3, LOW=1. MEDIUM y LOW tienen 0 → HIGH absorbe todo
    const result = selectByTier(scored, 8);

    const highCount = result.filter((r) => r.sourceType === "srd").length;
    expect(highCount).toBe(6); // todos los disponibles (hay 6)
    expect(result.length).toBe(6);
  });

  it("tierQuotas permite limitar HIGH en favor de MEDIUM cuando hay chunks suficientes", () => {
    // 8 HIGH y 8 MEDIUM disponibles, sin LOW
    const srdChunks = Array.from({ length: 8 }, (_, i) =>
      chunk("srd", 1.0 - i * 0.01)
    );
    const campaignChunks = Array.from({ length: 8 }, (_, i) =>
      chunk("campaign", 0.9 - i * 0.01)
    );
    const scored = [...srdChunks, ...campaignChunks];

    // Con cuotas por defecto (limit=8): HIGH=4, MEDIUM=3, LOW=1
    const defaultResult = selectByTier(scored, 8);
    expect(defaultResult.filter((r) => r.sourceType === "srd").length).toBe(4);

    // Con override HIGH=2, MEDIUM=5, LOW=1:
    // LOW=0 chunks → su slot va a MEDIUM → MEDIUM toma 6 en total
    const customResult = selectByTier(scored, 8, { high: 2, medium: 5, low: 1 });
    const customHighCount = customResult.filter((r) => r.sourceType === "srd").length;
    const customMediumCount = customResult.filter((r) => r.sourceType === "campaign").length;

    expect(customHighCount).toBe(2);
    expect(customMediumCount).toBe(6); // 5 cuota + 1 slot sobrante de LOW
  });
});
