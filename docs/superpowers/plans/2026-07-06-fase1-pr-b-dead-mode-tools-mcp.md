# Fase 1 · PR-B — Eliminar MODE_TOOLS decorativo + cliente MCP HTTP muerto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove two pieces of confirmed dead code — the decorative `MODE_TOOLS` panel in the chat UI, and the unused HTTP client methods of the backend `mcpService` — without touching the parts that are actually used.

**Architecture:** `mcpService` is NOT fully dead: `chat.service.ts` calls `getCampaignState` and `formatCampaignState` (direct Prisma path). Only the HTTP client trio — `callTool`, `isAvailable`, `listTools` (which `fetch` `MCP_SERVER_URL`) — is dead in production, along with the symbols that only they use (`McpToolResult`, `withTimeout`, `TIMEOUT_MS`, `HEALTH_TIMEOUT_MS`, the `env` import). In the frontend, `MODE_TOOLS` is a `chatMode → string[]` map rendered as non-functional badges; nothing invokes those tools. Its removal leaves the `Wrench` icon import intact (used elsewhere at lines 166/174).

**Tech Stack:** TypeScript (Fastify backend service + Next.js client component), Vitest.

## Global Constraints

- Do NOT remove `getCampaignState` / `formatCampaignState` from `mcpService` or their tests — they are live.
- Do NOT remove the `Wrench` import from `chat/page.tsx` — still used at lines 166 and 174.
- Do NOT touch `MCP_SERVER_URL` in `config/env.ts` — the MCP server app still exists and the var is documented (out of scope for this slice).
- Verification for dead-code removal = `pnpm typecheck` green + backend test suite green + zero remaining references to the removed symbols.
- Conventional commits, no AI attribution. Comments/identifiers in the file's existing language (Spanish comments are already present in these files — keep neutral Spanish).

---

### Task 1: Remove the dead HTTP client from `mcpService`

**Files:**
- Modify: `app/backend/src/services/mcp.service.ts`
- Modify: `app/backend/src/services/mcp.service.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `mcpService` with exactly two methods remaining — `getCampaignState(campaignId: string)` and `formatCampaignState(data: unknown): string` (signatures unchanged). `chat.service.ts` continues to compile against these.

- [ ] **Step 1: Confirm the HTTP trio has zero production callers (baseline)**

Run:
```bash
rg -n "callTool|isAvailable|listTools" app packages --type ts | rg -v "mcp.service.ts|mcp.service.test.ts|mcp-server/"
```
Expected: no output (only the service file, its test, and the standalone mcp-server reference these names).

- [ ] **Step 2: Rewrite `mcp.service.ts` without the HTTP client**

Replace the file's header comment, the timeout constants, `McpToolResult`, `withTimeout`, and the three HTTP methods. The resulting file keeps only what `getCampaignState`/`formatCampaignState` need:

```ts
/**
 * MCP Service — estado de campaña para el chat.
 *
 * Expone `getCampaignState`, que obtiene el estado de campaña DIRECTAMENTE de la
 * BD (vía Prisma/servicios) con el mismo shape que la tool `get_campaign_state`
 * del MCP server, y `formatCampaignState`, que lo formatea como texto para el
 * system prompt. El chat usa este camino directo para evitar el bucle
 * backend → :3002 → :3001 → backend.
 */

import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";
import { npcService } from "./npc.service.js";
import { issueService } from "./issue.service.js";

export const mcpService = {
  /**
   * Obtiene el estado de campaña directamente de la BD, sin pasar por el
   * MCP server. Mismo shape que la tool `get_campaign_state` del MCP server:
   * campaña, últimas 3 sesiones, NPCs activos (no muertos), issues abiertas
   * y jugadores. Lanza AppError NOT_FOUND si la campaña no existe.
   */
  async getCampaignState(campaignId: string) {
    const [campaign, recentSessions, npcs, openIssues, players] = await Promise.all([
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.session.findMany({
        where: { campaignId },
        orderBy: { sessionNumber: "desc" },
        take: 3,
      }),
      npcService.listByCampaign(campaignId),
      issueService.listByCampaign(campaignId, "open"),
      prisma.player.findMany({
        where: { campaignId },
        orderBy: { name: "asc" },
      }),
    ]);

    if (!campaign) {
      throw AppError.notFound(ErrorCode.CAMPAIGN_NOT_FOUND, `Campaign ${campaignId} not found`);
    }

    return {
      campaign,
      recentSessions,
      activeNpcs: npcs.filter((n) => n.status !== "dead"),
      openIssues,
      players,
    };
  },

  /**
   * Formatea el estado de campaña como texto para inyectar en el system prompt.
   */
  formatCampaignState(data: unknown): string {
    if (!data || typeof data !== "object") return "";

    const d = data as {
      campaign?: { title?: string; system?: string };
      activeNpcs?: { name?: string; role?: string; status?: string }[];
      recentSessions?: { sessionNumber?: number; title?: string; summary?: string }[];
      openIssues?: { severity?: string; description?: string }[];
      players?: { name?: string; class?: string; level?: number }[];
    };

    const lines: string[] = ["═══════ CAMPAIGN STATE (current) ═══════"];

    if (d.campaign?.title) {
      lines.push(`Campaign: ${d.campaign.title}${d.campaign.system ? ` (${d.campaign.system})` : ""}`);
    }

    if (d.players && d.players.length > 0) {
      const playerList = d.players
        .map((p) => `${p.name ?? "?"}${p.class ? ` (${p.class} Nv.${p.level ?? "?"})` : ""}`)
        .join(", ");
      lines.push(`Players: ${playerList}`);
    }

    if (d.activeNpcs && d.activeNpcs.length > 0) {
      const npcList = d.activeNpcs
        .slice(0, 10)
        .map((n) => `${n.name ?? "?"}${n.role ? ` — ${n.role}` : ""}`)
        .join("; ");
      lines.push(`Active NPCs: ${npcList}`);
    }

    if (d.recentSessions && d.recentSessions.length > 0) {
      lines.push("Recent sessions:");
      for (const s of d.recentSessions) {
        const summary = s.summary ? ` — ${s.summary.slice(0, 120)}${s.summary.length > 120 ? "…" : ""}` : "";
        lines.push(`  #${s.sessionNumber ?? "?"} ${s.title ?? "Untitled"}${summary}`);
      }
    }

    if (d.openIssues && d.openIssues.length > 0) {
      const issueList = d.openIssues
        .slice(0, 5)
        .map((i) => `[${i.severity?.toUpperCase() ?? "?"}] ${i.description?.slice(0, 80) ?? ""}`)
        .join("; ");
      lines.push(`Open issues: ${issueList}`);
    }

    lines.push("═══════════════════════════════════════");
    return lines.join("\n");
  },
};
```

- [ ] **Step 3: Remove the HTTP-client tests from `mcp.service.test.ts`**

Delete the three `describe` blocks `mcpService.callTool` (lines ~16-62), `mcpService.isAvailable` (~66-93) and `mcpService.listTools` (~97-125), plus their section comment banners. ALSO delete the now-purposeless global fetch stub in `beforeEach` (lines 6-8) — the only surviving test that touches `fetch` is "no usa fetch" inside the `getCampaignState` block, which stubs `fetch` itself. Keep the `afterEach(() => vi.restoreAllMocks())` (that test relies on it) and keep both surviving `describe` blocks intact. The resulting top of the file:

```ts
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { mcpService } from "./mcp.service.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "@dnd/shared";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── getCampaignState (camino directo vía Prisma, sin MCP server) ────────────

describe("mcpService.getCampaignState", () => {
  // ...unchanged...
```

Note: `beforeEach` is no longer used after removing the stub — drop it from the vitest import to avoid an unused-import lint error (`import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";`).

- [ ] **Step 4: Verify typecheck and backend tests are green**

Run:
```bash
pnpm --filter backend exec prisma generate >/dev/null
pnpm typecheck
cd app/backend && pnpm test && cd ../..
```
Expected: typecheck passes; backend suite passes with the getCampaignState/formatCampaignState tests still present (the callTool/isAvailable/listTools tests are gone). Confirm the reported test count dropped by exactly the removed cases (4 + 3 + 2 = 9 fewer).

- [ ] **Step 5: Confirm no dangling references**

Run:
```bash
rg -n "McpToolResult|withTimeout|callTool|isAvailable|listTools|MCP_SERVER_URL" app/backend/src/services/mcp.service.ts || echo "clean"
rg -n "mcpService.callTool|mcpService.isAvailable|mcpService.listTools" app || echo "clean"
```
Expected: `clean` on both.

- [ ] **Step 6: Commit**

```bash
git add app/backend/src/services/mcp.service.ts app/backend/src/services/mcp.service.test.ts
git commit -m "refactor(backend): remove unused MCP HTTP client from mcpService"
```

---

### Task 2: Remove the decorative `MODE_TOOLS` panel from the chat UI

**Files:**
- Modify: `app/frontend/src/app/chat/page.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: chat header without the tools-badges row. `Wrench` import stays (still used at lines 166/174).

- [ ] **Step 1: Delete the `MODE_TOOLS` definition**

Remove the section comment and constant (currently lines 184-191):

```ts
// ─── Panel de tools disponibles por modo ─────────────────────────────────────
const MODE_TOOLS: Record<string, string[]> = {
  session_director: ["get_campaign_state", "search_rules", "log_issue"],
  designer: ["get_campaign_state", "create_npc", "search_rules", "search_documents"],
  rule_reviewer: ["search_rules", "search_documents"],
  auditor: ["get_campaign_state", "log_issue", "search_documents"],
  archivista: ["search_documents", "search_rules"],
};
```

- [ ] **Step 2: Delete the render block**

Remove the JSX that renders the badges (currently lines 610-620):

```tsx
            {/* Tools disponibles para el modo activo */}
            {(MODE_TOOLS[chatMode] ?? []).length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Wrench size={10} className="text-stone-600" />
                {(MODE_TOOLS[chatMode] ?? []).map((tool) => (
                  <span key={tool} className="text-xs text-stone-600 bg-stone-800 px-1.5 py-0.5 rounded font-mono">
                    {tool}
                  </span>
                ))}
              </div>
            )}
```

- [ ] **Step 3: Verify no dangling references and typecheck**

Run:
```bash
rg -n "MODE_TOOLS" app/frontend/src || echo "clean"
rg -n "Wrench" app/frontend/src/app/chat/page.tsx
pnpm typecheck
```
Expected: `clean` for MODE_TOOLS; `Wrench` still appears at lines ~166 and ~174 (import kept); typecheck passes.

- [ ] **Step 4: Commit**

```bash
git add app/frontend/src/app/chat/page.tsx
git commit -m "refactor(frontend): remove decorative MODE_TOOLS badges from chat"
```

---

## Self-Review

**Spec coverage:** Item #3 (H4 remanente) has two halves — dead MCP HTTP client (Task 1) and decorative MODE_TOOLS panel (Task 2). Both covered. ✅

**Placeholder scan:** No TBD/TODO. Full replacement file given for `mcp.service.ts`; exact deletions quoted for the test and the client component.

**Type/name consistency:** `getCampaignState` and `formatCampaignState` signatures are byte-for-byte the same as the original — `chat.service.ts:50-51` keeps compiling. `mcpService` stays a named export. `Wrench` import preserved.

## Notes for execution

- Branch already created: `refactor/fase1-pr-b-dead-mode-tools-mcp` (from `main`).
- This slice touches application code, so run a fresh-context adversarial review of the diff BEFORE opening the PR (unlike PR-A, which was infra/docs only).
- Frontend tests won't run in this local env (Node 20.18 < 20.19 floor); rely on typecheck locally and the CI (Node 22) on the PR.
