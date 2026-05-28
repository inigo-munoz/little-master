import { z } from "zod";
import {
  CampaignStatusSchema,
  NpcStatusSchema,
  NpcDispositionSchema,
  ContentTypeSchema,
  SourceTypeSchema,
  AuthorityLevelSchema,
  IssueTypeSchema,
  IssueSeveritySchema,
  IssueStatusSchema,
  AuthorTypeSchema,
  EntityTypeSchema,
} from "@dnd/shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const id = () => z.string().cuid2();
const timestamp = () => z.coerce.date();

// ─── User ─────────────────────────────────────────────────────────────────────
export const UserSchema = z.object({
  id: id(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type User = z.infer<typeof UserSchema>;

// ─── Campaign ─────────────────────────────────────────────────────────────────
export const CampaignSchema = z.object({
  id: id(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  system: z.string().default("D&D 2024"),
  status: CampaignStatusSchema,
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type Campaign = z.infer<typeof CampaignSchema>;

export const CreateCampaignSchema = CampaignSchema.pick({
  title: true,
  description: true,
  system: true,
});
export type CreateCampaign = z.infer<typeof CreateCampaignSchema>;

// ─── Session ──────────────────────────────────────────────────────────────────
export const SessionSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2(),
  title: z.string().min(1).max(200),
  summary: z.string().max(10000).optional().nullable(),
  notes: z.string().max(50000).optional().nullable(),
  sessionNumber: z.number().int().positive(),
  playedAt: timestamp().optional().nullable(),
  sourceType: SourceTypeSchema.default("campaign"),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionSchema = SessionSchema.pick({
  campaignId: true,
  title: true,
  summary: true,
  notes: true,
  sessionNumber: true,
  playedAt: true,
}).extend({ sourceType: SourceTypeSchema.optional().default("campaign") });
export type CreateSession = z.infer<typeof CreateSessionSchema>;

// ─── NPC ──────────────────────────────────────────────────────────────────────
export const NpcSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2(),
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  status: NpcStatusSchema,
  disposition: NpcDispositionSchema.default("neutral"),
  sourceType: SourceTypeSchema.default("campaign"),
  tags: z.array(z.string()).default([]),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type Npc = z.infer<typeof NpcSchema>;

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

// ─── Location ─────────────────────────────────────────────────────────────────
export const LocationSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2(),
  name: z.string().min(1).max(200),
  description: z.string().max(10000).optional().nullable(),
  parentLocationId: z.string().cuid2().optional().nullable(),
  sourceType: SourceTypeSchema.default("campaign"),
  tags: z.array(z.string()).default([]),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type Location = z.infer<typeof LocationSchema>;

// ─── Faction ──────────────────────────────────────────────────────────────────
export const FactionSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2(),
  name: z.string().min(1).max(200),
  description: z.string().max(10000).optional().nullable(),
  alignment: z.string().max(50).optional().nullable(),
  disposition: z.enum(["allied", "neutral", "hostile", "unknown"]).default("unknown"),
  sourceType: SourceTypeSchema.default("campaign"),
  tags: z.array(z.string()).default([]),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type Faction = z.infer<typeof FactionSchema>;

// ─── Document ─────────────────────────────────────────────────────────────────
export const DocumentSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2().optional().nullable(),
  title: z.string().min(1).max(200),
  path: z.string(), // filesystem path relative to /data/documents/
  contentType: ContentTypeSchema,
  sourceType: SourceTypeSchema,
  authorityLevel: AuthorityLevelSchema,
  version: z.string().default("1.0"),
  isIndexed: z.boolean().default(false),
  chunkCount: z.number().int().default(0),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type Document = z.infer<typeof DocumentSchema>;

// ─── Rule Source ──────────────────────────────────────────────────────────────
// Represents a source of rules (e.g., "D&D 2024 PHB", "Andeavion Campaign Rules")
export const RuleSourceSchema = z.object({
  id: id(),
  name: z.string().min(1).max(200),
  sourceType: SourceTypeSchema,
  authorityLevel: AuthorityLevelSchema,
  version: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});
export type RuleSource = z.infer<typeof RuleSourceSchema>;

// ─── Campaign Rule ────────────────────────────────────────────────────────────
// A specific rule as it applies to a campaign (may override official rules)
export const CampaignRuleSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2(),
  title: z.string().min(1).max(200),
  content: z.string().max(20000),
  sourceId: z.string().cuid2().optional().nullable(),
  sourceType: SourceTypeSchema,
  authorityLevel: AuthorityLevelSchema,
  version: z.string().default("1.0"),
  active: z.boolean().default(true),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type CampaignRule = z.infer<typeof CampaignRuleSchema>;

// ─── Change Log ───────────────────────────────────────────────────────────────
// Every structural change to the campaign data must be logged.
// This is not optional. It's what separates a system from a chatbot.
export const ChangeLogSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2().optional().nullable(),
  entityType: EntityTypeSchema,
  entityId: z.string(),
  beforeJson: z.string().optional().nullable(), // JSON serialized
  afterJson: z.string().optional().nullable(),  // JSON serialized
  reason: z.string().max(1000).optional().nullable(),
  source: z.string().max(200).optional().nullable(),
  authorType: AuthorTypeSchema,
  createdAt: timestamp(),
});
export type ChangeLog = z.infer<typeof ChangeLogSchema>;

// ─── Issue ────────────────────────────────────────────────────────────────────
export const IssueSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2().optional().nullable(),
  type: IssueTypeSchema,
  severity: IssueSeveritySchema,
  status: IssueStatusSchema,
  description: z.string().max(5000),
  relatedEntityType: EntityTypeSchema.optional().nullable(),
  relatedEntityId: z.string().optional().nullable(),
  resolution: z.string().max(2000).optional().nullable(),
  createdAt: timestamp(),
  resolvedAt: timestamp().optional().nullable(),
});
export type Issue = z.infer<typeof IssueSchema>;

// ─── LLM Config ───────────────────────────────────────────────────────────────
export const LlmProviderSchema = z.enum(["openai", "anthropic", "openrouter", "ollama"]);
export type LlmProvider = z.infer<typeof LlmProviderSchema>;

export const LlmConfigSchema = z.object({
  id: id(),
  provider: LlmProviderSchema,
  model: z.string().min(1),
  // api_key_encrypted is stored in DB — NEVER returned to frontend as plain text
  apiKeyEncrypted: z.string().optional().nullable(),
  isActive: z.boolean().default(false),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type LlmConfig = z.infer<typeof LlmConfigSchema>;

// Safe version for frontend — key never exposed
export const LlmConfigPublicSchema = LlmConfigSchema.omit({ apiKeyEncrypted: true }).extend({
  hasApiKey: z.boolean(),
  keyValidated: z.boolean().optional(),
});
export type LlmConfigPublic = z.infer<typeof LlmConfigPublicSchema>;

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

export const AssistantRunSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2().optional().nullable(),
  mode: AssistantModeSchema,
  prompt: z.string(),
  response: z.string().optional().nullable(),
  contextChunks: z.array(z.string()).default([]), // IDs of chunks used as context
  toolsUsed: z.array(z.string()).default([]),
  tokensUsed: z.number().int().optional().nullable(),
  llmConfigId: z.string().cuid2().optional().nullable(),
  createdAt: timestamp(),
});
export type AssistantRun = z.infer<typeof AssistantRunSchema>;

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

export const MonsterStatBlockSchema = z.object({
  name: z.string().min(1),
  cr: z.union([z.string(), z.number()]),
  count: z.number().int().positive().optional(),
});
export type MonsterStatBlock = z.infer<typeof MonsterStatBlockSchema>;

// ─── Document Chunk (for semantic search) ────────────────────────────────────
export const DocumentChunkSchema = z.object({
  id: id(),
  documentId: z.string().cuid2(),
  campaignId: z.string().cuid2().optional().nullable(),
  content: z.string(),
  chunkIndex: z.number().int(),
  sourceType: SourceTypeSchema,
  authorityLevel: AuthorityLevelSchema,
  // embedding stored separately (binary blob or vector db)
  createdAt: timestamp(),
});
export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

// ─── Entity Relation ──────────────────────────────────────────────────────────
export const EntityRelationSchema = z.object({
  id: id(),
  campaignId: z.string().cuid2(),
  fromType: z.enum(["npc", "faction", "location"]),
  fromId: z.string(),
  toType: z.enum(["npc", "faction", "location"]),
  toId: z.string(),
  relationType: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
export type EntityRelation = z.infer<typeof EntityRelationSchema>;

export const CreateEntityRelationSchema = EntityRelationSchema.pick({
  campaignId: true,
  fromType: true,
  fromId: true,
  toType: true,
  toId: true,
  relationType: true,
  notes: true,
});
export type CreateEntityRelation = z.infer<typeof CreateEntityRelationSchema>;
