# Entity Relations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el sistema de relaciones entre entidades (NPC↔NPC, NPC↔Facción, NPC↔Localización, Facción↔Facción, Facción↔Localización, Localización↔Localización) gestionadas desde la ficha de cada entidad.

**Architecture:** Junction table genérica `EntityRelation` con `fromType/fromId/toType/toId`. La clave del par se ordena alfabéticamente para garantizar que `npc-faction` y `faction-npc` usen la misma lista de tipos. El componente `RelationsPanel` se integra al final de los modales existentes en NPC, Facción y Localización.

**Tech Stack:** Prisma 5 + SQLite (backend), Fastify 5 (routes), Zod (validación), React 18 + SWR + Tailwind (frontend), packages/shared (constantes), packages/domain (schemas).

---

## Mapa de archivos

| Fichero | Acción | Responsabilidad |
|---------|--------|-----------------|
| `packages/shared/src/relations.ts` | Crear | Constante `RELATION_TYPES` + tipos inferidos |
| `packages/shared/src/index.ts` | Modificar | Re-exportar `relations.ts` |
| `packages/domain/src/entities/index.ts` | Modificar | Añadir `EntityRelationSchema`, `CreateEntityRelationSchema` |
| `app/backend/prisma/schema.prisma` | Modificar | Modelo `EntityRelation` + relación en `Campaign` |
| `app/backend/src/routes/relations.ts` | Crear | GET / POST / DELETE endpoints |
| `app/backend/src/server.ts` | Modificar | Registrar `relationRoutes` |
| `app/frontend/src/lib/api.ts` | Modificar | Sección `relations` en el cliente API |
| `app/frontend/src/components/ui/RelationsPanel.tsx` | Crear | Componente React con lista + formulario inline |
| `app/frontend/src/components/ui/DetailModal.tsx` | Modificar | Importar y renderizar `RelationsPanel` para npc/faction/location |
| `app/backend/src/services/rulesEngine.service.test.ts` | No tocar | Ya existe, es tests independientes |

---

## Task 1: Constante RELATION_TYPES + schema de dominio

**Files:**
- Create: `packages/shared/src/relations.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/domain/src/entities/index.ts`

- [ ] **Step 1: Crear `packages/shared/src/relations.ts`**

```typescript
export const RELATION_TYPES = {
  "faction-faction": [
    "aliada", "enemiga", "rival", "subordinada a",
    "controla", "alianza temporal", "infiltrada por",
  ],
  "faction-location": [
    "controla", "base de operaciones", "territorio reclamado",
    "protege", "presencia oculta", "busca acceso",
  ],
  "location-location": [
    "frontera con", "acceso a través de", "controla", "rival de",
  ],
  "npc-faction": [
    "miembro", "líder", "agente", "simpatizante",
    "enemigo", "renegado", "protegido", "patrocinado",
  ],
  "npc-location": [
    "residente", "propietario", "guardián",
    "visitante frecuente", "nacido en", "controla", "exiliado de",
  ],
  "npc-npc": [
    "aliado", "enemigo", "rival", "mentor", "aprendiz",
    "familiar", "subordinado", "superior", "patrón", "asociado",
  ],
} as const;

export type EntityRelationKind = keyof typeof RELATION_TYPES;

export function getRelationPairKey(
  typeA: string,
  typeB: string
): EntityRelationKind | null {
  const key = [typeA, typeB].sort().join("-") as EntityRelationKind;
  return key in RELATION_TYPES ? key : null;
}
```

- [ ] **Step 2: Añadir re-export en `packages/shared/src/index.ts`**

El fichero actualmente contiene solo dos líneas. Añadir una tercera:

```typescript
export * from "./types.js";
export * from "./errors.js";
export * from "./relations.js";
```

- [ ] **Step 3: Añadir schemas en `packages/domain/src/entities/index.ts`**

Al final del fichero (después de `DocumentChunkSchema`), añadir:

```typescript
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
```

- [ ] **Step 4: Verificar que compila**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant
pnpm typecheck 2>&1 | head -30
```

Esperado: sin errores de tipo.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/relations.ts packages/shared/src/index.ts packages/domain/src/entities/index.ts
git commit -m "feat(relations): RELATION_TYPES constant + EntityRelation domain schema"
```

---

## Task 2: Migración de base de datos

**Files:**
- Modify: `app/backend/prisma/schema.prisma`

- [ ] **Step 1: Añadir modelo `EntityRelation` y relación en `Campaign`**

En `schema.prisma`, después del modelo `Faction` (línea ~139), añadir:

```prisma
// ─── Entity Relations ─────────────────────────────────────────────────────────
model EntityRelation {
  id           String   @id @default(cuid())
  campaignId   String
  fromType     String   // "npc" | "faction" | "location"
  fromId       String
  toType       String   // "npc" | "faction" | "location"
  toId         String
  relationType String
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId])
  @@index([fromType, fromId])
  @@index([toType, toId])
}
```

En el modelo `Campaign` (línea ~26), dentro del bloque de relaciones, añadir al final de la lista de campos relation:

```prisma
  entityRelations EntityRelation[]
```

- [ ] **Step 2: Ejecutar migración**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant
pnpm db:migrate
```

Cuando pida nombre para la migración, escribir: `add_entity_relations`

Esperado: `✔  Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Verificar con Prisma Studio (opcional)**

```bash
pnpm db:studio
```

Confirmar que existe la tabla `EntityRelation` con las columnas correctas. Cerrar Studio.

- [ ] **Step 4: Commit**

```bash
git add app/backend/prisma/schema.prisma app/backend/prisma/migrations/
git commit -m "feat(relations): add EntityRelation table to Prisma schema"
```

---

## Task 3: Tests del backend (escribir antes de implementar)

**Files:**
- Create: `app/backend/src/routes/relations.test.ts`

- [ ] **Step 1: Crear fichero de tests**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { prisma } from "../db/prisma.js";
import { relationRoutes } from "./relations.js";

// Datos de prueba — se crean y limpian en cada test
let campaignId: string;
let npcId: string;
let factionId: string;
let locationId: string;

async function buildApp() {
  const app = Fastify();
  await app.register(relationRoutes, { prefix: "/api/relations" });
  return app;
}

beforeAll(async () => {
  // Crear un usuario mínimo
  const user = await prisma.user.upsert({
    where: { id: "test-user-relations" },
    update: {},
    create: { id: "test-user-relations", name: "Test User" },
  });

  const campaign = await prisma.campaign.create({
    data: { title: "Campaña test relaciones", userId: user.id },
  });
  campaignId = campaign.id;

  const npc = await prisma.npc.create({
    data: { campaignId, name: "Gandalf", status: "alive" },
  });
  npcId = npc.id;

  const faction = await prisma.faction.create({
    data: { campaignId, name: "Gremio de los Magos" },
  });
  factionId = faction.id;

  const location = await prisma.location.create({
    data: { campaignId, name: "Torre del Hechicero" },
  });
  locationId = location.id;
});

afterAll(async () => {
  await prisma.entityRelation.deleteMany({ where: { campaignId } });
  await prisma.npc.deleteMany({ where: { campaignId } });
  await prisma.faction.deleteMany({ where: { campaignId } });
  await prisma.location.deleteMany({ where: { campaignId } });
  await prisma.campaign.delete({ where: { id: campaignId } });
  await prisma.user.delete({ where: { id: "test-user-relations" } });
  await prisma.$disconnect();
});

describe("POST /api/relations", () => {
  it("crea relación npc-faction válida", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/relations",
      payload: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "faction",
        toId: factionId,
        relationType: "miembro",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.relationType).toBe("miembro");
  });

  it("rechaza relationType inválido para el par", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/relations",
      payload: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "faction",
        toId: factionId,
        relationType: "frontera con", // válido para location-location, no para npc-faction
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rechaza par de tipos desconocido", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/relations",
      payload: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "session", // no existe en las relaciones
        toId: "any-id",
        relationType: "aliado",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/relations", () => {
  it("devuelve relaciones en ambas direcciones para la entidad", async () => {
    const app = await buildApp();

    // Crear relación npc→faction
    await prisma.entityRelation.create({
      data: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "faction",
        toId: factionId,
        relationType: "líder",
      },
    });

    // GET desde el punto de vista del npc
    const resNpc = await app.inject({
      method: "GET",
      url: `/api/relations?campaignId=${campaignId}&entityType=npc&entityId=${npcId}`,
    });
    expect(resNpc.statusCode).toBe(200);
    const npcBody = JSON.parse(resNpc.body);
    expect(npcBody.data.length).toBeGreaterThanOrEqual(1);
    expect(npcBody.data.some((r: any) => r.entity.id === factionId)).toBe(true);

    // GET desde el punto de vista de la facción
    const resFaction = await app.inject({
      method: "GET",
      url: `/api/relations?campaignId=${campaignId}&entityType=faction&entityId=${factionId}`,
    });
    expect(resFaction.statusCode).toBe(200);
    const factionBody = JSON.parse(resFaction.body);
    expect(factionBody.data.some((r: any) => r.entity.id === npcId)).toBe(true);
  });
});

describe("DELETE /api/relations/:id", () => {
  it("elimina la relación y devuelve 204", async () => {
    const app = await buildApp();

    const rel = await prisma.entityRelation.create({
      data: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "location",
        toId: locationId,
        relationType: "residente",
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/relations/${rel.id}`,
    });
    expect(res.statusCode).toBe(204);

    const found = await prisma.entityRelation.findUnique({ where: { id: rel.id } });
    expect(found).toBeNull();
  });

  it("devuelve 404 para relación inexistente", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/relations/no-existe-id",
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Ejecutar tests — verificar que fallan (el route no existe aún)**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant/app/backend
pnpm test src/routes/relations.test.ts 2>&1 | tail -20
```

Esperado: Error de importación ("Cannot find module ./relations.js") o tests fallando.

- [ ] **Step 3: Commit del fichero de tests**

```bash
git add app/backend/src/routes/relations.test.ts
git commit -m "test(relations): add backend route tests (failing — TDD)"
```

---

## Task 4: Ruta del backend

**Files:**
- Create: `app/backend/src/routes/relations.ts`
- Modify: `app/backend/src/server.ts`

- [ ] **Step 1: Crear `app/backend/src/routes/relations.ts`**

```typescript
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { changeLogService } from "../services/changeLog.service.js";
import { AppError, ErrorCode, RELATION_TYPES, getRelationPairKey } from "@dnd/shared";

const ENTITY_TYPES = ["npc", "faction", "location"] as const;
type EntityKind = (typeof ENTITY_TYPES)[number];

async function resolveEntityName(
  type: EntityKind,
  id: string
): Promise<string | null> {
  if (type === "npc") {
    const e = await prisma.npc.findUnique({ where: { id }, select: { name: true } });
    return e?.name ?? null;
  }
  if (type === "faction") {
    const e = await prisma.faction.findUnique({ where: { id }, select: { name: true } });
    return e?.name ?? null;
  }
  const e = await prisma.location.findUnique({ where: { id }, select: { name: true } });
  return e?.name ?? null;
}

export const relationRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/relations?campaignId=X&entityType=npc&entityId=Y
  server.get<{ Querystring: unknown }>("/", async (request) => {
    const { campaignId, entityType, entityId } = z.object({
      campaignId: z.string(),
      entityType: z.enum(ENTITY_TYPES),
      entityId: z.string(),
    }).parse(request.query);

    const rows = await prisma.entityRelation.findMany({
      where: {
        campaignId,
        OR: [
          { fromType: entityType, fromId: entityId },
          { toType: entityType, toId: entityId },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const data = await Promise.all(
      rows.map(async (r) => {
        const isFrom = r.fromType === entityType && r.fromId === entityId;
        const relatedType = (isFrom ? r.toType : r.fromType) as EntityKind;
        const relatedId = isFrom ? r.toId : r.fromId;
        const name = await resolveEntityName(relatedType, relatedId);
        return {
          id: r.id,
          relationType: r.relationType,
          notes: r.notes,
          direction: isFrom ? "from" : "to" as const,
          entity: { type: relatedType, id: relatedId, name: name ?? "(eliminado)" },
        };
      })
    );

    return { success: true, data };
  });

  // POST /api/relations
  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string(),
      fromType: z.enum(ENTITY_TYPES),
      fromId: z.string(),
      toType: z.enum(ENTITY_TYPES),
      toId: z.string(),
      relationType: z.string().min(1),
      notes: z.string().max(500).optional().nullable(),
    });

    const data = schema.parse(request.body);

    // Validar par de tipos
    const pairKey = getRelationPairKey(data.fromType, data.toType);
    if (!pairKey) {
      throw AppError.validation(ErrorCode.VALIDATION_ERROR, `Par de tipos inválido: ${data.fromType}-${data.toType}`);
    }

    // Validar relationType pertenece al par
    const validTypes = RELATION_TYPES[pairKey] as readonly string[];
    if (!validTypes.includes(data.relationType)) {
      throw AppError.validation(ErrorCode.VALIDATION_ERROR, `Tipo de relación "${data.relationType}" no válido para el par ${pairKey}`);
    }

    const relation = await prisma.entityRelation.create({
      data: {
        campaignId: data.campaignId,
        fromType: data.fromType,
        fromId: data.fromId,
        toType: data.toType,
        toId: data.toId,
        relationType: data.relationType,
        notes: data.notes ?? null,
      },
    });

    await changeLogService.log({
      campaignId: data.campaignId,
      entityType: "relation",
      entityId: relation.id,
      beforeJson: null,
      afterJson: JSON.stringify(relation),
      reason: `Relación ${data.fromType}→${data.toType} creada: ${data.relationType}`,
      source: "user",
      authorType: "user",
    });

    return reply.status(201).send({ success: true, data: relation });
  });

  // DELETE /api/relations/:id
  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await prisma.entityRelation.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) {
      throw AppError.notFound(ErrorCode.NOT_FOUND, "Relación no encontrada");
    }

    await prisma.entityRelation.delete({ where: { id: request.params.id } });

    await changeLogService.log({
      campaignId: existing.campaignId,
      entityType: "relation",
      entityId: existing.id,
      beforeJson: JSON.stringify(existing),
      afterJson: null,
      reason: `Relación ${existing.fromType}→${existing.toType} eliminada`,
      source: "user",
      authorType: "user",
    });

    return reply.status(204).send();
  });
};
```

- [ ] **Step 2: Verificar que `AppError.validation` existe — si no, ajustar**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant
grep -n "static validation\|static notFound\|static badRequest" packages/shared/src/errors.ts | head -10
```

Si `AppError.validation` no existe y solo existe `AppError.badRequest`, usar `AppError.badRequest` en las dos validaciones del POST. Ajustar el fichero `relations.ts` correspondientemente antes de continuar.

- [ ] **Step 3: Registrar la ruta en `server.ts`**

Añadir import al bloque de imports de rutas (al final del bloque existente):

```typescript
import { relationRoutes } from "./routes/relations.js";
```

Añadir registro después de `wikiRoutes`:

```typescript
  await server.register(relationRoutes, { prefix: "/api/relations" });
```

- [ ] **Step 4: Verificar que `relation` es un EntityType válido en `@dnd/shared`**

```bash
grep -n '"relation"' packages/shared/src/types.ts
```

Si `"relation"` no está en el enum `EntityType`, añadirlo:

```bash
grep -n "EntityType\|entityType" packages/shared/src/types.ts | head -20
```

Localizar la definición de `EntityType` y añadir `"relation"` a la lista.

- [ ] **Step 5: Ejecutar typecheck**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant
pnpm typecheck 2>&1 | grep -E "error TS" | head -20
```

Esperado: sin errores nuevos.

- [ ] **Step 6: Ejecutar los tests del backend**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant/app/backend
pnpm test src/routes/relations.test.ts 2>&1 | tail -30
```

Esperado: todos los tests en verde.

- [ ] **Step 7: Ejecutar suite completa del backend**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant/app/backend
pnpm test 2>&1 | tail -10
```

Esperado: todos los tests existentes siguen pasando + los nuevos de relaciones.

- [ ] **Step 8: Commit**

```bash
git add app/backend/src/routes/relations.ts app/backend/src/server.ts packages/shared/src/types.ts
git commit -m "feat(relations): backend route GET/POST/DELETE /api/relations"
```

---

## Task 5: API client del frontend

**Files:**
- Modify: `app/frontend/src/lib/api.ts`

- [ ] **Step 1: Añadir tipos y sección `relations` en `api.ts`**

Al final del bloque de tipos (antes de `export const api = {`), añadir:

```typescript
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
```

Al final del objeto `api` (después del último bloque), añadir:

```typescript
  relations: {
    list: (campaignId: string, entityType: string, entityId: string) =>
      get<RelationItem[]>(
        `/api/relations?campaignId=${campaignId}&entityType=${entityType}&entityId=${entityId}`
      ),
    create: (data: CreateEntityRelationPayload) =>
      post<{ id: string; relationType: string }>("/api/relations", data),
    delete: (id: string) => del(`/api/relations/${id}`),
  },
```

- [ ] **Step 2: Verificar typecheck del frontend**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant
pnpm typecheck 2>&1 | grep -E "error TS" | head -20
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/lib/api.ts
git commit -m "feat(relations): add api.relations client methods"
```

---

## Task 6: Componente RelationsPanel

**Files:**
- Create: `app/frontend/src/components/ui/RelationsPanel.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Plus, X, ChevronDown } from "lucide-react";
import { api, type RelationItem, type CreateEntityRelationPayload } from "../../lib/api";
import { RELATION_TYPES, getRelationPairKey } from "@dnd/shared";

// ─── Tipos locales ────────────────────────────────────────────────────────────
type EntityKind = "npc" | "faction" | "location";

interface EntityOption {
  id: string;
  name: string;
}

interface RelationsPanelProps {
  campaignId: string;
  entityType: EntityKind;
  entityId: string;
}

const ENTITY_LABELS: Record<EntityKind, string> = {
  npc: "PNJ",
  faction: "Facción",
  location: "Localización",
};

// ─── Hooks de datos ───────────────────────────────────────────────────────────
function useEntityOptions(campaignId: string, type: EntityKind | "") {
  const { data } = useSWR(
    type ? `entity-options-${campaignId}-${type}` : null,
    async () => {
      if (type === "npc") {
        const items = await api.npcs.list(campaignId);
        return items.map((n) => ({ id: n.id, name: n.name }));
      }
      if (type === "faction") {
        const items = await api.factions.list(campaignId);
        return items.map((f) => ({ id: f.id, name: f.name }));
      }
      const items = await api.locations.list(campaignId);
      return items.map((l) => ({ id: l.id, name: l.name }));
    }
  );
  return (data ?? []) as EntityOption[];
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function RelationsPanel({
  campaignId,
  entityType,
  entityId,
}: RelationsPanelProps) {
  const swrKey = `relations-${campaignId}-${entityType}-${entityId}`;

  const { data: relations = [], isLoading } = useSWR<RelationItem[]>(swrKey, () =>
    api.relations.list(campaignId, entityType, entityId)
  );

  const [showForm, setShowForm] = useState(false);
  const [targetType, setTargetType] = useState<EntityKind | "">("");
  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetOptions = useEntityOptions(campaignId, targetType);

  // Lista de tipos de relación válidos para el par actual
  const pairKey = targetType ? getRelationPairKey(entityType, targetType) : null;
  const availableTypes: readonly string[] = pairKey ? RELATION_TYPES[pairKey] : [];

  function resetForm() {
    setTargetType("");
    setTargetId("");
    setRelationType("");
    setNotes("");
    setError(null);
    setShowForm(false);
  }

  async function handleSave() {
    if (!targetType || !targetId || !relationType) {
      setError("Selecciona entidad, tipo de entidad y tipo de relación.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateEntityRelationPayload = {
        campaignId,
        fromType: entityType,
        fromId: entityId,
        toType: targetType,
        toId: targetId,
        relationType,
        notes: notes || null,
      };
      await api.relations.create(payload);
      await mutate(swrKey);
      resetForm();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar la relación");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.relations.delete(id);
      await mutate(swrKey);
    } catch {
      // silent — el elemento ya no existe
    }
  }

  return (
    <div className="mt-6 pt-4 border-t border-stone-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Relaciones
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-stone-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
          >
            <Plus size={12} /> Añadir
          </button>
        )}
      </div>

      {/* Lista de relaciones existentes */}
      {isLoading ? (
        <p className="text-xs text-stone-500">Cargando...</p>
      ) : relations.length === 0 && !showForm ? (
        <p className="text-xs text-stone-500 italic">Sin relaciones registradas.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {relations.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 text-sm group"
            >
              <span className="px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 text-xs font-medium whitespace-nowrap">
                {r.relationType}
              </span>
              <span className="text-stone-300 truncate flex-1">
                {ENTITY_LABELS[r.entity.type]} — {r.entity.name}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="text-stone-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Eliminar relación"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Formulario inline */}
      {showForm && (
        <div className="bg-stone-800/60 rounded-lg p-3 space-y-2">
          {/* Tipo de entidad destino */}
          <div>
            <label className="block text-xs text-stone-400 mb-1">Tipo de entidad</label>
            <select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as EntityKind | "");
                setTargetId("");
                setRelationType("");
              }}
              className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">Seleccionar...</option>
              {(["npc", "faction", "location"] as EntityKind[])
                .filter((t) => !(t === entityType && t === "npc" ? false : false))
                .map((t) => (
                  <option key={t} value={t}>
                    {ENTITY_LABELS[t]}
                  </option>
                ))}
            </select>
          </div>

          {/* Entidad destino */}
          {targetType && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">
                {ENTITY_LABELS[targetType]}
              </label>
              <select
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  setRelationType("");
                }}
                className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Seleccionar...</option>
                {targetOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tipo de relación */}
          {targetId && availableTypes.length > 0 && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">Tipo de relación</label>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Seleccionar...</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notas opcionales */}
          {relationType && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">
                Notas <span className="text-stone-600">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Contexto narrativo..."
                className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-500 resize-none focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !relationType}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant
pnpm typecheck 2>&1 | grep -E "error TS" | head -20
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/components/ui/RelationsPanel.tsx
git commit -m "feat(relations): RelationsPanel component (list + inline form)"
```

---

## Task 7: Integración en DetailModal

**Files:**
- Modify: `app/frontend/src/components/ui/DetailModal.tsx`

El `DetailModal` recibe `entity: ModalEntity` (type + data) y ya tiene `campaignId?: string`. Solo hay que importar `RelationsPanel` y renderizarlo al final del contenido de cada variante que tenga `campaignId`.

- [ ] **Step 1: Añadir el import de RelationsPanel**

Al final del bloque de imports de `DetailModal.tsx`:

```typescript
import { RelationsPanel } from "./RelationsPanel";
```

- [ ] **Step 2: Localizar el punto de renderizado para cada entidad**

Leer el fichero para encontrar dónde termina el contenido visible del modal para los casos `npc`, `faction` y `location`. Serán los últimos bloques de JSX antes del cierre del contenedor scrollable.

```bash
grep -n "entity.type\|case.*npc\|case.*faction\|case.*location\|</div>" app/frontend/src/components/ui/DetailModal.tsx | head -40
```

- [ ] **Step 3: Añadir `RelationsPanel` al final de los tres casos**

Para cada case (npc, faction, location), justo antes del cierre del último `</div>` del contenido scrollable, añadir:

```tsx
{campaignId && (
  <RelationsPanel
    campaignId={campaignId}
    entityType="npc"   // ← cambiar a "faction" o "location" según el caso
    entityId={entity.data.id}
  />
)}
```

Nota: La prop `campaignId` ya existe en `DetailModal` como opcional (`campaignId?: string`). La condición `{campaignId && ...}` evita el render si no se pasa (ej. modal de sesión o jugador).

- [ ] **Step 4: Verificar typecheck del frontend**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant
pnpm typecheck 2>&1 | grep -E "error TS" | head -20
```

Esperado: sin errores.

- [ ] **Step 5: Ejecutar tests del frontend**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant/app/frontend
pnpm test 2>&1 | tail -10
```

Esperado: los 46 tests existentes siguen en verde.

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/components/ui/DetailModal.tsx
git commit -m "feat(relations): integrate RelationsPanel into NPC/Faction/Location modals"
```

---

## Task 8: Verificación manual (smoke test)

- [ ] **Step 1: Arrancar el stack completo**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant
pnpm dev
```

Esperar a que backend (3001) y frontend (3000) estén listos.

- [ ] **Step 2: Probar el flujo**

1. Abrir http://localhost:3000, seleccionar una campaña.
2. Ir a NPCs, abrir la ficha de detalle de cualquier NPC.
3. Verificar que aparece la sección "Relaciones" al final del modal.
4. Añadir una relación: tipo Facción → escoger una facción → tipo "miembro" → Guardar.
5. Verificar que la relación aparece en la lista.
6. Abrir la ficha de la Facción relacionada → verificar que la relación también aparece ahí (bidireccional).
7. Eliminar la relación desde el NPC → verificar que desaparece de ambos modales.

- [ ] **Step 3: Verificar tests finales**

```bash
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant/app/backend && pnpm test 2>&1 | tail -5
cd /media/inigo/Loki/Mis\ Repos/dnd-assistant/app/frontend && pnpm test 2>&1 | tail -5
```

Esperado: todos en verde.

- [ ] **Step 4: Commit final de verificación (si hay ajustes)**

```bash
git add -p   # solo añadir si hubo cambios menores de ajuste
git commit -m "fix(relations): smoke test adjustments"
```

---

## Resumen de archivos afectados

| Fichero | Tipo de cambio |
|---------|----------------|
| `packages/shared/src/relations.ts` | **Nuevo** |
| `packages/shared/src/index.ts` | +1 línea re-export |
| `packages/domain/src/entities/index.ts` | +EntityRelationSchema |
| `app/backend/prisma/schema.prisma` | +modelo EntityRelation |
| `app/backend/src/routes/relations.ts` | **Nuevo** |
| `app/backend/src/routes/relations.test.ts` | **Nuevo** |
| `app/backend/src/server.ts` | +import + register |
| `packages/shared/src/types.ts` | +"relation" en EntityType |
| `app/frontend/src/lib/api.ts` | +sección relations |
| `app/frontend/src/components/ui/RelationsPanel.tsx` | **Nuevo** |
| `app/frontend/src/components/ui/DetailModal.tsx` | +RelationsPanel en 3 casos |
