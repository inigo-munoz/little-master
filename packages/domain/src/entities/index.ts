import { z } from "zod";
import {
  NpcStatusSchema,
  NpcDispositionSchema,
  SourceTypeSchema,
} from "@dnd/shared";

// ─── Campaign ─────────────────────────────────────────────────────────────────
export const CreateCampaignSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  system: z.string().default("D&D 2024"),
});
export type CreateCampaign = z.infer<typeof CreateCampaignSchema>;

// ─── NPC ──────────────────────────────────────────────────────────────────────
const StatBlockEntrySchema = z.object({ name: z.string(), description: z.string() });

export const CreateNpcSchema = z.object({
  campaignId: z.string(),
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  status: NpcStatusSchema.default("alive"),
  disposition: NpcDispositionSchema.default("neutral"),
  sourceType: SourceTypeSchema.optional().default("campaign"),
  tags: z.array(z.string()).default([]),
  // Stat block de combate — todos opcionales
  armorClass: z.number().int().optional().nullable(),
  hitPoints: z.string().optional().nullable(),
  speed: z.string().optional().nullable(),
  strength: z.number().int().optional().nullable(),
  dexterity: z.number().int().optional().nullable(),
  constitution: z.number().int().optional().nullable(),
  intelligence: z.number().int().optional().nullable(),
  wisdom: z.number().int().optional().nullable(),
  charisma: z.number().int().optional().nullable(),
  savingThrows: z.string().optional().nullable(),
  skills: z.string().optional().nullable(),
  resistances: z.string().optional().nullable(),
  immunities: z.string().optional().nullable(),
  senses: z.string().optional().nullable(),
  languages: z.string().optional().nullable(),
  challengeRating: z.string().optional().nullable(),
  traits: z.array(StatBlockEntrySchema).optional().nullable(),
  actions: z.array(StatBlockEntrySchema).optional().nullable(),
  bonusActions: z.array(StatBlockEntrySchema).optional().nullable(),
  reactions: z.array(StatBlockEntrySchema).optional().nullable(),
  npcType: z.string().optional().nullable(),
  npcClass: z.string().optional().nullable(),
  npcLevel: z.number().int().optional().nullable(),
  npcSpecies: z.string().optional().nullable(),
});
export type CreateNpc = z.infer<typeof CreateNpcSchema>;

// ─── LLM Config ───────────────────────────────────────────────────────────────
// "openai-codex" se conecta por OAuth (rutas /oauth/*), no por API key.
export const LlmProviderSchema = z.enum([
  "openai",
  "anthropic",
  "openrouter",
  "ollama",
  "openai-codex",
]);
export type LlmProvider = z.infer<typeof LlmProviderSchema>;

// ─── Assistant Run ────────────────────────────────────────────────────────────
// Every AI-assisted operation must be logged. No invisible AI actions.
export const AssistantModeSchema = z.enum([
  "archivista",
  "designer",
  "rule_reviewer",
  "auditor",
  "session_director",
]);
export type AssistantMode = z.infer<typeof AssistantModeSchema>;

// ─── Ability Score Helpers ──────────────────────────────────────────────────────

/**
 * D&D 5E ability modifier formula: floor((score - 10) / 2).
 * Single source of truth — used by frontend character sheet calcs and
 * backend monster import.
 */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// ─── Encounter / Monster ──────────────────────────────────────────────────────

/**
 * CR puede ser string fraccional ("1/2", "1/4", "1/8") o número entero/decimal.
 * Convierte siempre a número para los cálculos de XP.
 */
export function parseCR(cr: string | number): number {
  if (typeof cr === "number") return cr;
  const fractions: Record<string, number> = {
    "1/8": 0.125,
    "1/4": 0.25,
    "1/2": 0.5,
  };
  if (cr in fractions) return fractions[cr]!;
  const n = parseFloat(cr);
  return isNaN(n) ? 0 : n;
}
