/**
 * Rules Engine
 *
 * Responsibilities:
 * - Enforce source authority hierarchy when answering rules questions
 * - Detect conflicts between rules of different authority levels
 * - Validate encounter balance using official CR guidelines
 * - Never return an answer without indicating which source governs it
 *
 * Design principle: this service deals with structured rule data.
 * The LLM is not involved here — it receives the output of this service
 * as context. Separation is intentional.
 */

import { prisma } from "../db/prisma.js";
import { issueService } from "./issue.service.js";

// Authority ordering — lower index = higher authority
const AUTHORITY_ORDER = ["high", "medium", "low"] as const;
const SOURCE_AUTHORITY: Record<string, (typeof AUTHORITY_ORDER)[number]> = {
  official: "high",
  srd: "high",
  campaign: "medium",
  homebrew_external: "medium",
  homebrew_user: "low",
  ai_inferred: "low",
};

function authorityRank(level: string): number {
  return AUTHORITY_ORDER.indexOf(level as (typeof AUTHORITY_ORDER)[number]);
}

// ─── CR / XP tables (D&D 2024) ────────────────────────────────────────────────
// Source: D&D 2024 DMG encounter building guidelines
const XP_BY_CR: Record<number, number> = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
  6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
  16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
};

// XP thresholds per character level [easy, medium, hard, deadly]
const XP_THRESHOLDS_BY_LEVEL: Record<number, [number, number, number, number]> = {
  1:  [25, 50, 75, 100],     2:  [50, 100, 150, 200],
  3:  [75, 150, 225, 400],   4:  [125, 250, 375, 500],
  5:  [250, 500, 750, 1100], 6:  [300, 600, 900, 1400],
  7:  [350, 750, 1100, 1700],8:  [450, 900, 1400, 2100],
  9:  [550, 1100, 1600, 2400],10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],20: [2800, 5700, 8500, 12700],
};

// Multiplier for number of monsters
function monsterMultiplier(monsterCount: number, partySize: number): number {
  const adjusted = partySize < 3 ? monsterCount + 1
    : partySize > 5 ? Math.max(1, monsterCount - 1)
    : monsterCount;
  if (adjusted === 1) return 1;
  if (adjusted === 2) return 1.5;
  if (adjusted <= 6) return 2;
  if (adjusted <= 10) return 2.5;
  if (adjusted <= 14) return 3;
  return 4;
}

export interface Monster {
  name: string;
  cr: number; // 0, 0.125, 0.25, 0.5, 1, 2, ...
  count?: number;
}

export interface PartyInfo {
  size: number;
  averageLevel: number;
  levels?: number[]; // individual levels for more accurate calculation
}

export interface EncounterValidationResult {
  difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly" | "impossible";
  totalXp: number;
  adjustedXp: number;
  thresholds: { easy: number; medium: number; hard: number; deadly: number };
  recommendation: string;
  warnings: string[];
  source: "official D&D 2024 DMG";
}

export interface RulesConflict {
  ruleAId: string;
  ruleBId: string;
  ruleATitle: string;
  ruleBTitle: string;
  ruleASource: string;
  ruleBSource: string;
  ruleAAuthority: string;
  ruleBAuthority: string;
  governingRuleId: string;
  description: string;
}

export const rulesEngine = {
  /**
   * Validate encounter balance using official D&D 2024 CR/XP guidelines.
   * Returns structured result — no LLM involved.
   */
  validateEncounter(
    party: PartyInfo,
    monsters: Monster[]
  ): EncounterValidationResult {
    const warnings: string[] = [];

    // Calculate party XP thresholds
    const levels = party.levels?.length === party.size
      ? party.levels
      : Array(party.size).fill(party.averageLevel);

    const thresholds = levels.reduce(
      (acc, lvl) => {
        const t = XP_THRESHOLDS_BY_LEVEL[Math.min(Math.max(lvl, 1), 20)] ?? XP_THRESHOLDS_BY_LEVEL[1]!;
        return {
          easy: acc.easy + t[0],
          medium: acc.medium + t[1],
          hard: acc.hard + t[2],
          deadly: acc.deadly + t[3],
        };
      },
      { easy: 0, medium: 0, hard: 0, deadly: 0 }
    );

    // Calculate monster XP
    const totalXp = monsters.reduce((sum, m) => {
      const xp = XP_BY_CR[(m as any).cr] ?? 0;
      const count = (m as any).count ?? 1;
      if (!XP_BY_CR[(m as any).cr]) {
        warnings.push(`Unknown CR ${m.cr} for ${m.name} — XP set to 0`);
      }
      return sum + xp * count;
    }, 0);

    // Apply multiplier
    const totalMonsters = monsters.reduce((sum, m) => sum + (m.count ?? 1), 0);
    const multiplier = monsterMultiplier(totalMonsters, party.size);
    const adjustedXp = Math.round(totalXp * multiplier);

    // Determine difficulty
    let difficulty: EncounterValidationResult["difficulty"];
    if (adjustedXp === 0) difficulty = "trivial";
    else if (adjustedXp < thresholds.easy) difficulty = "trivial";
    else if (adjustedXp < thresholds.medium) difficulty = "easy";
    else if (adjustedXp < thresholds.hard) difficulty = "medium";
    else if (adjustedXp < thresholds.deadly) difficulty = "hard";
    else if (adjustedXp < thresholds.deadly * 2) difficulty = "deadly";
    else difficulty = "impossible";

    const recommendations: Record<string, string> = {
      trivial: "This encounter poses minimal challenge. Consider adding monsters or increasing CR.",
      easy: "A comfortable encounter. Good for resource attrition or warming up.",
      medium: "Standard challenge. Party will likely expend some resources.",
      hard: "Significant challenge. Real risk of character incapacitation.",
      deadly: "One or more characters may die. Ensure this is intentional.",
      impossible: "This encounter will likely kill the entire party. Reserved for boss encounters with escape options or narrative protection.",
    };

    if (totalMonsters > 15) {
      warnings.push("Very large number of monsters — consider action economy carefully.");
    }

    if (monsters.some((m: any) => m.cr >= party.averageLevel + 5)) {
      warnings.push("One or more monsters have CR significantly above party level — legendary actions/resistances may be overwhelming.");
    }

    return {
      difficulty,
      totalXp,
      adjustedXp,
      thresholds,
      recommendation: recommendations[difficulty] ?? "",
      warnings,
      source: "official D&D 2024 DMG",
    };
  },

  /**
   * Detect conflicts between active campaign rules.
   * A conflict exists when two rules from different sources address the same keyword
   * and have different content.
   */
  async detectRuleConflicts(campaignId: string): Promise<RulesConflict[]> {
    const rules = await prisma.campaignRule.findMany({
      where: { campaignId, active: true },
      orderBy: { authorityLevel: "asc" },
    });

    const conflicts: RulesConflict[] = [];

    // Simple keyword overlap detection
    // Sprint 4: replace with embedding similarity
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const ruleA = rules[i]!;
        const ruleB = rules[j]!;

        // Skip if same source type (no conflict, just redundancy)
        if (ruleA.sourceType === ruleB.sourceType) continue;

        // Extract significant keywords (nouns > 4 chars)
        const keywordsA = new Set(
          ruleA.title.toLowerCase().split(/\W+/).filter((w: any) => w.length > 4)
        );
        const keywordsB = new Set(
          ruleB.title.toLowerCase().split(/\W+/).filter((w: any) => w.length > 4)
        );

        const shared = [...keywordsA].filter((k) => keywordsB.has(k));
        if (shared.length === 0) continue;

        // They share keywords — potential conflict
        const rankA = authorityRank(ruleA.authorityLevel);
        const rankB = authorityRank(ruleB.authorityLevel);
        const governingId = rankA <= rankB ? ruleA.id : ruleB.id;

        conflicts.push({
          ruleAId: ruleA.id,
          ruleBId: ruleB.id,
          ruleATitle: ruleA.title,
          ruleBTitle: ruleB.title,
          ruleASource: ruleA.sourceType,
          ruleBSource: ruleB.sourceType,
          ruleAAuthority: ruleA.authorityLevel,
          ruleBAuthority: ruleB.authorityLevel,
          governingRuleId: governingId,
          description: `"${ruleA.title}" (${ruleA.sourceType}) and "${ruleB.title}" (${ruleB.sourceType}) both address: ${shared.join(", ")}. Governing rule: ${governingId === ruleA.id ? ruleA.title : ruleB.title} (higher authority).`,
        });
      }
    }

    return conflicts;
  },

  /**
   * Run conflict detection and auto-log issues for new conflicts.
   */
  async auditRules(campaignId: string): Promise<{
    conflicts: RulesConflict[];
    issuesCreated: number;
  }> {
    const conflicts = await this.detectRuleConflicts(campaignId);

    // Log each conflict as an issue (avoid duplicates by checking description)
    let issuesCreated = 0;
    for (const conflict of conflicts) {
      const existing = await prisma.issue.findFirst({
        where: {
          campaignId,
          type: "rules_conflict",
          status: { in: ["open", "in_progress"] },
          description: { contains: conflict.ruleAId },
        },
      });

      if (!existing) {
        await issueService.create({
          campaignId,
          type: "rules_conflict",
          severity: "major",
          description: conflict.description,
          relatedEntityType: "campaign_rule",
          relatedEntityId: conflict.governingRuleId,
        });
        issuesCreated++;
      }
    }

    return { conflicts, issuesCreated };
  },
};
