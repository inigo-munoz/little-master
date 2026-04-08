# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Preferencias

- Responde siempre en español. Todas las explicaciones, resúmenes de cambios y comentarios deben estar en castellano.

## Commands

```bash
# Install dependencies
pnpm install

# Development (runs backend + frontend in parallel)
pnpm dev
pnpm dev:backend        # Backend only — http://localhost:3001
pnpm dev:frontend       # Frontend only — http://localhost:3000
pnpm dev:mcp            # MCP server — http://localhost:3002

# Build & checks
pnpm build
pnpm typecheck
pnpm lint               # Frontend only

# Tests
cd app/frontend && pnpm test   # Vitest — tests unitarios del frontend
cd app/backend  && pnpm test   # Vitest — tests unitarios del backend

# Database
pnpm db:migrate         # Run Prisma migrations
pnpm db:studio          # Open Prisma Studio GUI
```

### First-time setup

```bash
cd app/backend
cp .env.example .env
# Add ENCRYPTION_KEY: openssl rand -hex 32
pnpm db:push
npx tsx src/db/setup.ts   # Create data dirs + seed (rule sources, default user, SRD)

cd ../frontend
echo 'NEXT_PUBLIC_BACKEND_URL=http://localhost:3001' > .env.local
```

### Utility scripts (run from `app/backend/`)

```bash
npx tsx src/db/srd-import-cli.ts [--force]   # Re-import SRD; --force deletes existing SRD docs first
npx tsx src/db/clean-npc-descriptions.ts     # One-off NPC description cleanup
```

## Architecture

Monorepo (pnpm workspaces) with three apps and three shared packages:

```
app/
  backend/      Fastify 4 + Prisma 5 + SQLite API (port 3001)
  frontend/     Next.js 14 App Router (port 3000)
  mcp-server/   MCP tools server via Fastify (port 3002)
packages/
  domain/       Zod entity schemas for all models
  shared/       AppError class, error codes, response types
  llm-providers/ OpenAI & Anthropic adapters + system prompts
data/           User-local data (gitignored): DB, docs, logs, embeddings
```

### Backend structure (`app/backend/src/`)

- `server.ts` — Fastify bootstrap, plugin registration, route mounting
- `routes/` — One file per resource (campaigns, sessions, npcs, chat, documents, llmConfig, obsidian, rules, changeLog, issues, players, embeddings, etc.)
- `services/` — Business logic. Key ones: `chat.service.ts` (AI context + LLM calls), `llmConfig.service.ts` (encrypted API key storage), `obsidian.service.ts` (vault sync), `embedding.service.ts` + `embedding-tiers.ts` (vector search con retrieval por tiers)
- `db/prisma.ts` — Prisma client singleton
- `crypto/encryption.ts` — AES-256-GCM for API keys
- `config/env.ts` — Zod-validated environment config
- `middleware/errorHandler.ts` — Global Fastify error handler

Routes are registered as Fastify plugins (`FastifyPluginAsync`). All routes use a hardcoded `MVP_USER_ID = "default-user"` — multi-user auth is not yet implemented. Standard response shape: `{ success: true, data: T }`. Errors go through `errorHandler.ts` which maps `AppError` codes to HTTP status codes (e.g. `INSUFFICIENT_CREDITS` → 402, `INVALID_API_KEY` → 401).

### Frontend structure (`app/frontend/src/`)

- `app/` — Next.js App Router pages
- `lib/api.ts` — Centralized typed API client (all HTTP calls go here); components never call `fetch()` directly
- `store/app.store.ts` — Zustand global state (`activeCampaignId`, `activeCampaign`, `chatMode`, `sidebarOpen`)
- Components use SWR for data fetching, Tailwind for styling, Lucide for icons

### LLM providers (`packages/llm-providers/`)

Factory pattern: `providers/factory.ts` selects OpenAI or Anthropic at runtime based on stored config. Five assistant modes defined in `prompts.ts`: `archivista`, `designer`, `rule_reviewer`, `auditor`, `session_director`. Temperature is 0.1 for `rule_reviewer`, 0.7 for all others. OpenRouter is aliased to the OpenAI adapter (not yet fully implemented); Ollama is TODO.

### Data flow for AI chat

1. Frontend calls `POST /api/chat` with campaign ID + message
2. `chat.service.ts` retrieves campaign context (NPCs, sessions, documents) from DB
3. Builds prompt using the appropriate mode from `llm-providers/prompts.ts`
4. Calls provider via factory → streams or returns response
5. Logs to `AssistantRun` table (tokens used, history)

### Database

SQLite via Prisma (schema at `app/backend/prisma/schema.prisma`). PostgreSQL-ready. Key tables: Campaign, Session, Npc, Player, Location, Faction, Document, DocumentChunk, LlmConfig (encrypted), AssistantRun, ChangeLog, Issue. API keys are encrypted before storage and never returned to the frontend in plaintext.

### Semantic search / embeddings

`embedding-tiers.ts` contiene la lógica pura de selección por tiers (sin dependencias externas — testeable). `embedding.service.ts` orquesta DB + OpenAI + tiered selection. Tiers:
- **HIGH**: `official`, `srd` — cuota por defecto 50% del límite
- **MEDIUM**: `campaign`, `homebrew_external` — cuota 37.5%
- **LOW**: `homebrew_user`, `ai_inferred` — cuota 12.5%

Los slots sobrantes de un tier se redistribuyen al tier inmediatamente superior. La función `selectByTier` acepta `tierQuotas` opcional para override.

Endpoints: `GET /api/embeddings/status` (incluye `bySourceType` y `byAuthorityLevel`), `POST /api/embeddings/embed-all`, `POST /api/embeddings/reindex-pending` (procesa documentos con chunks sin embeddings, orden HIGH→MEDIUM→LOW).

### Player (PJ) model

`Player` en Prisma tiene campos completos de D&D 2024: habilidades, tiradas de salvación, habilidades, inventario, magia (`spellsPrepared` — sistema de preparación de hechizos), rasgos de especie (`speciesTraits`), dones (`feats`), armas, objetos mágicos, monedas, etc.

`lib/dnd-2024-data.ts` expone constantes del PHB 2024: `DND_CLASSES` (12 clases con 4 subclases cada una), `DND_SPECIES` (10 especies), `DND_SPECIES_VARIANTS` (linajes para Dracónido/Elfo/Gnomo/Tiefling), `DND_BACKGROUNDS` (16 trasfondos), `DND_ALIGNMENTS` (9 alineamientos). La ficha de personaje (`app/players/[id]/page.tsx`) usa selects dependientes: Especie → Linaje, Clase → Subclase.

### Designer chat (modo AI)

`chat/page.tsx` usa `entityType` state para indicar el tipo de entidad que el usuario quiere crear (npc/location/faction). Este hint se propaga a `ExtendedMessage.entityHint` y lo usa `DesignerSaveButton` para parsear la respuesta con el parser correcto en lugar de intentar inferir el tipo.

- `lib/npc-parser.ts` — extrae NPC (nombre, descripción, rol) rechazando headings de localización/facción
- `lib/entity-parser.ts` — `parseLocationFromResponse`, `parseFactionFromResponse`, `parseGenericEntityFromResponse`

## Contenido PHB 2024

Los archivos en `data/phb2024/` contienen el contenido oficial del PHB 2024. Se importan automáticamente en el setup del proyecto (`npx tsx src/db/setup.ts`).

Archivos disponibles:
- `clases.md` — 12 clases con subclases
- `especies.md` — 10 especies
- `trasfondos.md` — 16 trasfondos
- `hechizos-listas.md` — Listas de hechizos por clase
- `dones.md` — Dones de Origen, Generales, Estilo de Combate y Épicos
- `equipo.md` — Armas, armaduras, equipo de aventurero
- `reglas.md` — Mecánicas de juego, combate, condiciones
- `multiverso.md` — Planos de existencia
- `criaturas.md` — Bloques de estadísticas (bestias, familiares, monturas, no muertos)
- `glosario.md` — Glosario oficial de reglas

Los documentos se importan con `sourceType: "official"` y `authorityLevel: "high"` — máxima prioridad en retrieval. Los embeddings se generan por separado vía Settings → Semantic Search → Embed All.

Para reimportar: `cd app/backend && pnpm phb:import`
Para reimportar forzando (borra y recrea): `cd app/backend && pnpm phb:import:force`

## Environment variables

**Backend** (`app/backend/.env`):
- `ENCRYPTION_KEY` — Required, 64 hex chars (`openssl rand -hex 32`)
- `DATABASE_URL` — defaults to `file:../../../data/dnd-assistant.db`
- `PORT` — defaults to `3001`, `HOST` defaults to `127.0.0.1`
- `DATA_DIR`, `DOCUMENTS_DIR`, `LOGS_DIR` — paths under `data/`
- `MCP_SERVER_URL` — defaults to `http://127.0.0.1:3002`
- `CORS_ORIGIN` — defaults to `http://localhost:3000`

**Frontend** (`app/frontend/.env.local`):
- `NEXT_PUBLIC_BACKEND_URL` — defaults to `http://localhost:3001`

## TypeScript config

Strict mode throughout. Base config at `tsconfig.base.json` (ES2022 target, ESNext modules, bundler resolution). All packages reference the base. The frontend `next.config.mjs` uses `transpilePackages` to handle shared monorepo packages.
