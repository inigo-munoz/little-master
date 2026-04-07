import { z } from "zod";

// ─── Tool Schema Registry ─────────────────────────────────────────────────────
// Each tool has: name, description, input schema, and handler.
// The MCP server exposes these to the LLM. The LLM calls them.
// The MCP server delegates execution to the backend API.
// No tool has direct DB access — that boundary is intentional.

const BACKEND_URL = process.env["BACKEND_URL"] ?? "http://127.0.0.1:3001";

export async function backendCall<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: "Unknown error" } }));
    throw new Error(`Backend error ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json() as T;
}

// ─── Tool Type ────────────────────────────────────────────────────────────────
export interface MCPTool<TInput extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: TInput;
  execute(input: z.infer<TInput>): Promise<unknown>;
}

// ─── Tool Implementations ─────────────────────────────────────────────────────

export const getCampaignState: MCPTool = {
  name: "get_campaign_state",
  description:
    "Retrieve the current state of a campaign: active NPCs, recent sessions (last 3), open issues, and players. Use this before any analysis or generation that requires campaign context.",
  inputSchema: z.object({
    campaignId: z.string().describe("The campaign ID to retrieve state for"),
  }),
  async execute({ campaignId }) {
    const [campaign, sessionsRaw, npcsRaw, issuesRaw, playersRaw] = await Promise.all([
      backendCall<{ data: unknown }>("GET", `/api/campaigns/${campaignId}`),
      backendCall<{ data: unknown[] }>("GET", `/api/sessions?campaignId=${campaignId}`),
      backendCall<{ data: unknown[] }>("GET", `/api/npcs?campaignId=${campaignId}`),
      backendCall<{ data: unknown[] }>("GET", `/api/issues?campaignId=${campaignId}&status=open`),
      backendCall<{ data: unknown[] }>("GET", `/api/players?campaignId=${campaignId}`),
    ]);

    // Limit sessions to most recent 3
    const allSessions = (sessionsRaw.data ?? []) as { sessionNumber?: number }[];
    const recentSessions = [...allSessions]
      .sort((a, b) => (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0))
      .slice(0, 3);

    // Only active NPCs (not dead)
    const allNpcs = (npcsRaw.data ?? []) as { status?: string }[];
    const activeNpcs = allNpcs.filter((n) => n.status !== "dead");

    return {
      campaign: campaign.data,
      recentSessions,
      activeNpcs,
      openIssues: issuesRaw.data ?? [],
      players: playersRaw.data ?? [],
    };
  },
};

export const searchDocuments: MCPTool = {
  name: "search_documents",
  description:
    "Search indexed documents and notes for relevant content. Returns chunks with source type and authority level. Always use this before answering questions about specific campaign content.",
  inputSchema: z.object({
    campaignId: z.string().optional().describe("Scope search to this campaign. Omit for global docs."),
    query: z.string().min(1).describe("What to search for"),
    limit: z.number().int().min(1).max(20).default(8).describe("Max chunks to return"),
  }),
  async execute({ campaignId, query, limit }) {
    const params = new URLSearchParams({ query, limit: String(limit) });
    if (campaignId) params.set("campaignId", campaignId);
    return backendCall("GET", `/api/documents/search?${params}`);
  },
};

export const searchRules: MCPTool = {
  name: "search_rules",
  description:
    "Search campaign rules and rule sources. Returns results sorted by authority level (official > srd > campaign > homebrew). Always cite the source type in your response.",
  inputSchema: z.object({
    campaignId: z.string().describe("Campaign ID to search rules for"),
    query: z.string().min(1).describe("Rule or mechanic to search for"),
    sourceTypes: z
      .array(z.enum(["official", "srd", "campaign", "homebrew_external", "homebrew_user"]))
      .optional()
      .describe("Filter by source type. Omit to search all."),
  }),
  async execute({ campaignId, query, sourceTypes }) {
    const params = new URLSearchParams({ campaignId, query });
    if (sourceTypes) params.set("sourceTypes", sourceTypes.join(","));
    return backendCall("GET", `/api/campaign-rules/search?${params}`);
  },
};

export const createNpc: MCPTool = {
  name: "create_npc",
  description:
    "Create a new NPC in the campaign. The NPC is saved to the database and a changelog entry is created with authorType 'ai'. All AI-created NPCs are tagged as such.",
  inputSchema: z.object({
    campaignId: z.string(),
    name: z.string().min(1).max(200),
    role: z.string().max(200).optional().describe("Role in the world (e.g. 'Blacksmith', 'Guild Leader')"),
    description: z.string().max(10000).optional(),
    status: z.enum(["alive", "dead", "unknown", "missing"]).default("alive"),
    tags: z.array(z.string()).default([]),
  }),
  async execute(input) {
    return backendCall("POST", "/api/npcs", { ...input, authorType: "assistant" });
  },
};

export const updateEntity: MCPTool = {
  name: "update_entity",
  description:
    "Update an existing entity (NPC, faction, location, session). Creates a changelog entry automatically. Use this when confirmed information needs to be recorded.",
  inputSchema: z.object({
    entityType: z.enum(["npc", "session", "faction", "location"]),
    entityId: z.string(),
    updates: z.record(z.unknown()).describe("Fields to update"),
    reason: z.string().describe("Why this update is being made"),
  }),
  async execute({ entityType, entityId, updates, reason }) {
    const routeMap: Record<string, string> = {
      npc: "/api/npcs",
      session: "/api/sessions",
      faction: "/api/factions",
      location: "/api/locations",
    };
    const route = routeMap[entityType];
    if (!route) throw new Error(`Entity type '${entityType}' not supported`);
    return backendCall("PATCH", `${route}/${entityId}`, { ...updates, reason });
  },
};

export const logChange: MCPTool = {
  name: "log_change",
  description:
    "Explicitly log a change to the campaign changelog. Use when an AI action modifies or confirms canon.",
  inputSchema: z.object({
    campaignId: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    before: z.string().optional().describe("JSON string of previous state"),
    after: z.string().optional().describe("JSON string of new state"),
    reason: z.string().min(1).describe("Why this change happened"),
  }),
  async execute(input) {
    return backendCall("POST", "/api/changelog", {
      campaignId: input.campaignId,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.before,
      afterJson: input.after,
      reason: input.reason,
      authorType: "ai",
    });
  },
};

export const logIssue: MCPTool = {
  name: "log_issue",
  description:
    "Create an issue when a conflict, inconsistency, or problem is detected. Do not suppress findings — log them and let the DM decide.",
  inputSchema: z.object({
    campaignId: z.string(),
    type: z.enum([
      "rules_conflict",
      "narrative_inconsistency",
      "duplicate_entity",
      "unbalanced_encounter",
      "broken_reference",
      "data_inconsistency",
    ]),
    severity: z.enum(["critical", "major", "minor", "info"]),
    description: z.string().min(1).max(5000),
    relatedEntityType: z.string().optional(),
    relatedEntityId: z.string().optional(),
  }),
  async execute(input) {
    return backendCall("POST", "/api/issues", input);
  },
};

export const generateSessionSummary: MCPTool = {
  name: "generate_session_summary",
  description:
    "Generate a structured summary for a session based on its notes. The summary is NOT automatically saved — return it to the user for review first.",
  inputSchema: z.object({
    sessionId: z.string(),
    additionalContext: z.string().optional().describe("Extra context to include"),
  }),
  async execute({ sessionId, additionalContext }) {
    const session = await backendCall<{ data: { notes?: string; campaignId?: string } }>("GET", `/api/sessions/${sessionId}`);
    const notes = session?.data?.notes ?? "";

    const prompt = `Summarize this D&D session based on the notes below.
Return a structured summary with:
- Key events (bullet list)
- NPCs encountered
- Decisions made by the party
- Open plot threads
- DM notes for next session

SESSION NOTES:
${notes}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}` : ""}`;

    return backendCall("POST", "/api/chat", {
      campaignId: session?.data?.campaignId,
      mode: "archivista",
      messages: [{ role: "user", content: prompt }],
    });
  },
};


export const validateEncounter: MCPTool = {
  name: "validate_encounter",
  description:
    "Validate encounter balance using official D&D 2024 CR/XP guidelines. Returns difficulty rating, adjusted XP, thresholds, and warnings. Always call this before finalizing an encounter.",
  inputSchema: z.object({
    campaignId: z.string().optional(),
    party: z.object({
      size: z.number().int().min(1).max(20).describe("Number of player characters"),
      averageLevel: z.number().int().min(1).max(20).describe("Average party level"),
      levels: z.array(z.number().int().min(1).max(20)).optional().describe("Individual PC levels for accuracy"),
    }),
    monsters: z
      .array(
        z.object({
          name: z.string(),
          cr: z.number().min(0).describe("Challenge Rating (0, 0.125, 0.25, 0.5, 1, 2, ...)"),
          count: z.number().int().positive().default(1),
        })
      )
      .min(1),
  }),
  async execute(input) {
    return backendCall("POST", "/api/rules/validate-encounter", input);
  },
};

export const checkRulesConflict: MCPTool = {
  name: "check_rules_conflict",
  description:
    "Detect conflicts between active campaign rules. Checks for rules from different source types that address the same mechanics. Logs issues automatically for new conflicts found.",
  inputSchema: z.object({
    campaignId: z.string().describe("Campaign to audit"),
  }),
  async execute({ campaignId }) {
    return backendCall("POST", "/api/rules/audit-rules", { campaignId });
  },
};

// ─── Tool Registry ────────────────────────────────────────────────────────────
export const ALL_TOOLS: MCPTool[] = [
  getCampaignState,
  searchDocuments,
  searchRules,
  createNpc,
  updateEntity,
  logChange,
  logIssue,
  generateSessionSummary,
  validateEncounter,
  checkRulesConflict,
];

export const TOOL_MAP = new Map(ALL_TOOLS.map((t) => [t.name, t]));
