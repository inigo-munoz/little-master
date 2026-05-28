/**
 * API Client
 *
 * All requests to the backend go through this module.
 * Components never call fetch() directly.
 * The backend URL comes from an env var — never hardcoded.
 */

const BASE = process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:3001";

class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: isFormData ? undefined : { "Content-Type": "application/json" },
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const hasBody =
    res.status !== 204 && res.headers.get("content-length") !== "0";

  if (!hasBody) {
    if (!res.ok) {
      throw new ApiError("UNKNOWN", "Request failed", res.status);
    }
    return null as T;
  }

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new ApiError(
      json.error?.code ?? "UNKNOWN",
      json.error?.message ?? "Request failed",
      res.status
    );
  }

  return json.data as T;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body: unknown) => request<T>("POST", path, body);
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del = (path: string) => request<void>("DELETE", path);

async function requestBlob(path: string): Promise<Blob> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new ApiError("UNKNOWN", "Request failed", res.status);
  return res.blob();
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
export const api = {
  campaigns: {
    list: () => get<Campaign[]>("/api/campaigns"),
    get: (id: string) => get<Campaign>(`/api/campaigns/${id}`),
    create: (data: { title: string; description?: string; system?: string }) =>
      post<Campaign>("/api/campaigns", data),
    update: (id: string, data: Partial<Campaign>) =>
      patch<Campaign>(`/api/campaigns/${id}`, data),
    delete: (id: string) => del(`/api/campaigns/${id}`),
  },

  sessions: {
    list: (campaignId: string) =>
      get<Session[]>(`/api/sessions?campaignId=${campaignId}`),
    get: (id: string) => get<Session>(`/api/sessions/${id}`),
    create: (data: CreateSession) => post<Session>("/api/sessions", data),
    update: (id: string, data: Partial<Session>) =>
      patch<Session>(`/api/sessions/${id}`, data),
  },

  npcs: {
    list: (campaignId: string) =>
      get<Npc[]>(`/api/npcs?campaignId=${campaignId}`),
    get: (id: string) => get<Npc>(`/api/npcs/${id}`),
    create: (data: CreateNpc) => post<Npc>("/api/npcs", data),
    update: (id: string, data: UpdateNpc) =>
      patch<Npc>(`/api/npcs/${id}`, data),
    delete: (id: string) => del(`/api/npcs/${id}`),
  },

  documents: {
    list: (campaignId?: string) =>
      get<Document[]>(
        `/api/documents${campaignId ? `?campaignId=${campaignId}` : ""}`
      ),
    get: (id: string) => get<Document>(`/api/documents/${id}`),
    content: (id: string) =>
      get<{ content: string }>(`/api/documents/${id}/content`),
    create: (data: CreateDocument) => post<Document>("/api/documents", data),
    upload: (formData: FormData) =>
      post<Document>("/api/documents/upload", formData),
    reindex: (id: string) =>
      post<{ chunkCount: number }>(`/api/documents/${id}/reindex`, {}),
    delete: (id: string) => del(`/api/documents/${id}`),
  },

  chat: {
    send: (data: {
      campaignId?: string;
      mode: AssistantMode;
      messages: ChatMessage[];
    }) => post<ChatResponse>("/api/chat", data),
    history: (campaignId: string) =>
      get<AssistantRun[]>(`/api/chat/history?campaignId=${campaignId}`),
  },

  llmConfig: {
    list: () => get<LlmConfigPublic[]>("/api/llm-config"),
    save: (data: { provider: string; model: string; apiKey?: string }) =>
      post<LlmConfigPublic>("/api/llm-config", data),
    validate: (data: { provider: string; apiKey: string }) =>
      post<{ valid: boolean }>("/api/llm-config/validate", data),
    activate: (id: string) =>
      post<LlmConfigPublic>(`/api/llm-config/${id}/activate`, {}),
    oauthStart: () =>
      get<{ authUrl: string }>("/api/llm-config/oauth/start"),
    oauthStatus: () =>
      get<{ connected: boolean; provider: string | null; expiresAt: string | null }>("/api/llm-config/oauth/status"),
    oauthDisconnect: () =>
      post<{ disconnected: boolean }>("/api/llm-config/oauth/disconnect", {}),
  },

  changelog: {
    byCampaign: (campaignId: string, limit = 50) =>
      get<ChangeLog[]>(
        `/api/changelog?campaignId=${campaignId}&limit=${limit}`
      ),
  },

  rules: {
    validateEncounter: (data: {
      campaignId?: string;
      party: { size: number; averageLevel: number; levels?: number[] };
      monsters: { name: string; cr: number; count?: number }[];
    }) => post<{
      difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly" | "impossible";
      totalXp: number;
      adjustedXp: number;
      thresholds: { easy: number; medium: number; hard: number; deadly: number };
      recommendation: string;
      warnings: string[];
      source: string;
    }>("/api/rules/validate-encounter", data),
    auditRules: (campaignId: string) =>
      post<{
        conflicts: { ruleAId: string; ruleBId: string; type: string; severity: string; description: string }[];
        issuesCreated: number;
      }>("/api/rules/audit-rules", { campaignId }),
  },

  obsidian: {
    getConfig: () => get<{ vaultPath: string | null }>("/api/obsidian/config"),
    saveConfig: (vaultPath: string) =>
      post<{ vaultPath: string }>("/api/obsidian/config", { vaultPath }),
    browse: (path?: string) =>
      get<{
        current: string;
        parent: string;
        isVault: boolean;
        dirs: { name: string; path: string; isVault: boolean; hidden: boolean }[];
        breadcrumb: { name: string; path: string }[];
        quickAccess: { name: string; path: string }[];
        platform: string;
      }>(`/api/obsidian/browse${path ? `?path=${encodeURIComponent(path)}` : ""}`),
    verify: (vaultPath: string) =>
      post<{
        valid: boolean;
        hasTemplates: boolean;
        hasPeople: boolean;
        hasJournals: boolean;
        detectedFolders: string[];
      }>("/api/obsidian/verify", { vaultPath }),
    scan: (vaultPath?: string) =>
      post<{
        totalNotes: number;
        skipped: number;
        groups: {
          type: string;
          count: number;
          confidence: string;
          sampleNames: string[];
          topFields: string[];
        }[];
      }>("/api/obsidian/scan", { vaultPath }),
    import: (campaignId: string, mapping?: Record<string, boolean>) =>
      post<{
        players: { imported: number; skipped: number; errors: string[] };
        npcs: { imported: number; skipped: number; errors: string[] };
        sessions: { imported: number; skipped: number; errors: string[] };
        factions: { imported: number; skipped: number; errors: string[] };
        locations: { imported: number; skipped: number; errors: string[] };
        quests: { imported: number; skipped: number; errors: string[] };
      }>("/api/obsidian/import", { campaignId, mapping }),
    export: (campaignId: string) =>
      post<{
        npcs: { exported: number; errors: string[] };
        sessions: { exported: number; errors: string[] };
        factions: { exported: number; errors: string[] };
        locations: { exported: number; errors: string[] };
      }>("/api/obsidian/export", { campaignId }),
  },

  srd: {
    status: () =>
      get<{
        documents: { id: string; title: string; version: string; isIndexed: boolean; chunkCount: number; embeddedChunks: number }[];
        totalDocuments: number;
        totalChunks: number;
        embeddedChunks: number;
        coverage: number;
        fullyImported: boolean;
        version: string;
      }>("/api/srd/status"),
    customRules: () =>
      get<{
        documents: { id: string; title: string; version: string; isIndexed: boolean; chunkCount: number; embeddedChunks: number; authorityLevel: string }[];
        totalDocuments: number;
        totalChunks: number;
        embeddedChunks: number;
        coverage: number;
      }>("/api/srd/custom-rules"),
    monsters: (q?: string) =>
      get<{ name: string; cr: string; type: string; size: string; source?: "srd" | "phb" }[]>(
        `/api/srd/monsters${q ? `?q=${encodeURIComponent(q)}` : ""}`
      ),
    monsterDetail: (name: string) =>
      get<MonsterDetail | null>(`/api/srd/monsters/${encodeURIComponent(name)}`),
    import: (force = false) =>
      post<{ message: string }>("/api/srd/import", { force }),
  },

  encounters: {
    list: (campaignId: string, limit?: number) =>
      get<Encounter[]>(
        `/api/encounters?campaignId=${campaignId}${limit ? `&limit=${limit}` : ""}`
      ),
    create: (data: CreateEncounter) =>
      post<Encounter>("/api/encounters", data),
    delete: (id: string) => del(`/api/encounters/${id}`),
  },

  embeddings: {
    status: (campaignId?: string) =>
      get<{
        totalChunks: number;
        embeddedChunks: number;
        pendingChunks: number;
        coverage: number;
        bySourceType: Record<string, { total: number; embedded: number }>;
        byAuthorityLevel: Record<string, { total: number; embedded: number }>;
      }>(`/api/embeddings/status${campaignId ? `?campaignId=${campaignId}` : ""}`),
    embedAll: (campaignId?: string) =>
      post<{ documentsProcessed: number; chunksEmbedded: number; chunksFailed: number }>(
        "/api/embeddings/embed-all",
        { campaignId }
      ),
    reindexPending: (campaignId?: string) =>
      post<{ documentsProcessed: number; chunksEmbedded: number; chunksFailed: number }>(
        "/api/embeddings/reindex-pending",
        { campaignId }
      ),
  },

  issues: {
    list: (campaignId: string, status?: string) =>
      get<Issue[]>(
        `/api/issues?campaignId=${campaignId}${status ? `&status=${status}` : ""}`
      ),
    create: (data: CreateIssue) => post<Issue>("/api/issues", data),
    resolve: (id: string, resolution: string) =>
      post<Issue>(`/api/issues/${id}/resolve`, { resolution }),
    dismiss: (id: string) => post<Issue>(`/api/issues/${id}/dismiss`, {}),
  },

  locations: {
    list: (campaignId: string) =>
      get<Location[]>(`/api/locations?campaignId=${campaignId}`),
    get: (id: string) => get<Location>(`/api/locations/${id}`),
    create: (data: CreateLocation) => post<Location>("/api/locations", data),
    update: (id: string, data: UpdateLocation) =>
      patch<Location>(`/api/locations/${id}`, data),
    delete: (id: string) => del(`/api/locations/${id}`),
  },

  factions: {
    list: (campaignId: string) =>
      get<Faction[]>(`/api/factions?campaignId=${campaignId}`),
    get: (id: string) => get<Faction>(`/api/factions/${id}`),
    create: (data: CreateFaction) => post<Faction>("/api/factions", data),
    update: (id: string, data: UpdateFaction) =>
      patch<Faction>(`/api/factions/${id}`, data),
    delete: (id: string) => del(`/api/factions/${id}`),
  },

  players: {
    list: (campaignId: string) =>
      get<Player[]>(`/api/players?campaignId=${campaignId}`),
    get: (id: string) => get<Player>(`/api/players/${id}`),
    create: (data: CreatePlayer) => post<Player>("/api/players", data),
    update: (id: string, data: UpdatePlayer) =>
      patch<Player>(`/api/players/${id}`, data),
    delete: (id: string) => del(`/api/players/${id}`),
  },

  wiki: {
    search: (campaignId: string, name: string) =>
      get<Array<{ type: string; id: string; name: string; summary: string }>>(
        `/api/campaigns/${campaignId}/wiki/${encodeURIComponent(name)}`
      ),
  },

  pdf: {
    sessionPdf: (sessionId: string) =>
      requestBlob(`/api/pdf/session/${sessionId}`),
  },

  relations: {
    list: (campaignId: string, entityType: string, entityId: string) =>
      get<RelationItem[]>(
        `/api/relations?campaignId=${campaignId}&entityType=${entityType}&entityId=${entityId}`
      ),
    create: (data: CreateEntityRelationPayload) =>
      post<{ id: string; relationType: string }>("/api/relations", data),
    delete: (id: string) => del(`/api/relations/${id}`),
  },

  spells: {
    lookup: (name: string) =>
      get<SpellFullData | null>(`/api/spells/${encodeURIComponent(name)}`),
  },

};

// ─── Types (mirrors backend domain) ─────────────────────────────────────────
export interface RelationItem {
  id: string;
  relationType: string;
  notes: string | null;
  direction: "from" | "to";
  entity: { type: "npc" | "faction" | "location"; id: string; name: string };
}

export interface CreateEntityRelationPayload {
  campaignId: string;
  fromType: "npc" | "faction" | "location";
  fromId: string;
  toType: "npc" | "faction" | "location";
  toId: string;
  relationType: string;
  notes?: string | null;
}

export interface Campaign {
  id: string;
  title: string;
  description?: string | null;
  system: string;
  status: "active" | "paused" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
  _count?: {
    sessions: number;
    npcs: number;
    issues: number;
    locations: number;
    factions: number;
    players: number;
  };
}

export interface Session {
  id: string;
  campaignId: string;
  title: string;
  summary?: string | null;
  notes?: string | null;
  sessionNumber: number;
  playedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSession {
  campaignId: string;
  title: string;
  summary?: string;
  notes?: string;
  sessionNumber: number;
  playedAt?: string;
  authorType?: "user" | "assistant";
}

export interface StatBlockEntry { name: string; description: string; }

export interface NpcStatBlock {
  armorClass?: number | null;
  hitPoints?: string | null;
  speed?: string | null;
  strength?: number | null;
  dexterity?: number | null;
  constitution?: number | null;
  intelligence?: number | null;
  wisdom?: number | null;
  charisma?: number | null;
  savingThrows?: string | null;
  skills?: string | null;
  resistances?: string | null;
  immunities?: string | null;
  senses?: string | null;
  languages?: string | null;
  challengeRating?: string | null;
  // DB may return these as JSON strings; use parseNpcEntries() to normalize at the call site
  traits?: StatBlockEntry[] | string | null;
  actions?: StatBlockEntry[] | string | null;
  bonusActions?: StatBlockEntry[] | string | null;
  reactions?: StatBlockEntry[] | string | null;
  npcType?: string | null;
  npcClass?: string | null;
  npcLevel?: number | null;
  npcSpecies?: string | null;
}

export interface Npc extends NpcStatBlock {
  id: string;
  campaignId: string;
  name: string;
  role?: string | null;
  description?: string | null;
  status: "alive" | "dead" | "unknown" | "missing";
  disposition: "ally" | "neutral" | "enemy";
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNpc extends NpcStatBlock {
  campaignId: string;
  name: string;
  role?: string;
  description?: string;
  status?: "alive" | "dead" | "unknown" | "missing";
  disposition?: "ally" | "neutral" | "enemy";
  tags?: string[];
  authorType?: "user" | "assistant";
}

export interface Document {
  id: string;
  campaignId?: string | null;
  title: string;
  path: string;
  contentType: "markdown" | "plaintext" | "pdf";
  sourceType: string;
  authorityLevel: string;
  version: string;
  isIndexed: boolean;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocument {
  title: string;
  content: string;
  contentType: "markdown" | "plaintext";
  sourceType: string;
  authorityLevel: string;
  campaignId?: string;
  version?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AssistantMode =
  | "archivista"
  | "designer"
  | "rule_reviewer"
  | "auditor"
  | "session_director";

export interface ChatResponse {
  content: string;
  contextChunks: ContextChunk[];
  tokensUsed: number;
  model: string;
  mode: AssistantMode;
  toolsUsed: string[];
}

export interface ContextChunk {
  id: string;
  content: string;
  sourceType: string;
  authorityLevel: string;
  documentTitle: string;
  relevanceScore: number;
}

export interface ExtendedMessage extends ChatMessage {
  id: string;
  contextChunks?: ContextChunk[];
  tokensUsed?: number;
  model?: string;
  mode?: AssistantMode;
  toolsUsed?: string[];
  entityHint?: "npc" | "location" | "faction";
}

export interface AssistantRun {
  id: string;
  mode: string;
  prompt: string;
  response?: string | null;
  tokensUsed?: number | null;
  createdAt: string;
}

export interface LlmConfigPublic {
  id: string;
  provider: string;
  model: string;
  authMethod: "apikey" | "oauth";
  isActive: boolean;
  hasApiKey: boolean;
  hasOAuth: boolean;
  keyIsValid: boolean | null;
  keyValidatedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeLog {
  id: string;
  entityType: string;
  entityId: string;
  beforeJson?: string | null;
  afterJson?: string | null;
  reason?: string | null;
  authorType: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  type: string;
  severity: "critical" | "major" | "minor" | "info";
  status: "open" | "in_progress" | "resolved" | "dismissed";
  description: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  resolution?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface CreateIssue {
  campaignId?: string;
  type: string;
  severity: string;
  description: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface Location {
  id: string;
  campaignId: string;
  name: string;
  description?: string | null;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocation {
  campaignId: string;
  name: string;
  description?: string;
  tags?: string[];
  authorType?: "user" | "assistant";
}

export interface Faction {
  id: string;
  campaignId: string;
  name: string;
  description?: string | null;
  alignment?: string | null;
  disposition: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFaction {
  campaignId: string;
  name: string;
  description?: string;
  alignment?: string;
  disposition?: string;
  tags?: string[];
  authorType?: "user" | "assistant";
}

export interface UpdateNpc extends NpcStatBlock {
  name?: string;
  role?: string;
  description?: string;
  status?: "alive" | "dead" | "unknown" | "missing";
  disposition?: "ally" | "neutral" | "enemy";
  tags?: string[];
}

export interface UpdateLocation {
  name?: string;
  description?: string;
  tags?: string[];
}

export interface UpdateFaction {
  name?: string;
  description?: string;
  alignment?: string;
  disposition?: string;
  tags?: string[];
}

export interface Player {
  id: string;
  campaignId: string;
  name: string;
  playerName?: string | null;
  class?: string | null;
  race?: string | null;
  level: number;
  hp?: number | null;
  ac?: number | null;
  status: "active" | "inactive" | "dead" | "retired";
  notes?: string | null;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlayer {
  campaignId: string;
  name: string;
  playerName?: string;
  class?: string;
  subclass?: string;
  race?: string;
  level?: number;
  hp?: number;
  ac?: number;
  status?: "active" | "inactive" | "dead" | "retired";
  notes?: string;
}

export type UpdatePlayer = Record<string, string | number | boolean | null | undefined>;

export interface MonsterDetail {
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: string;
  hp: string;
  speed: string;
  initiative: string;
  str: number | null;
  dex: number | null;
  con: number | null;
  int: number | null;
  wis: number | null;
  cha: number | null;
  savingThrows: string;
  skills: string;
  resistances: string;
  immunities: string;
  conditionImmunities: string;
  vulnerabilities: string;
  senses: string;
  languages: string;
  cr: string;
  xp: string;
  profBonus: string;
  traits: { name: string; description: string }[];
  actions: { name: string; description: string }[];
  bonusActions: { name: string; description: string }[];
  reactions: { name: string; description: string }[];
  legendaryActions: { name: string; description: string }[];
  rawText: string;
}

export interface Encounter {
  id: string;
  campaignId: string;
  title?: string | null;
  monsters: { name: string; cr: string; count: number }[];
  partySize: number;
  partyLevel: number;
  baseXp: number;
  adjustedXp: number;
  difficulty: string;
  notes?: string | null;
  createdAt: string;
}

export interface CreateEncounter {
  campaignId: string;
  title?: string;
  monsters: { name: string; cr: string; count: number }[];
  partySize: number;
  partyLevel: number;
  baseXp: number;
  adjustedXp: number;
  difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly" | "impossible";
  notes?: string;
}

export interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  materialDesc: string;
  consumed: boolean;
  hasCost: boolean;
}

export interface SpellFullData {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: SpellComponents;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels: string | null;
}

