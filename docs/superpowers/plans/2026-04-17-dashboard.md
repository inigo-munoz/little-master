# Dashboard de Campañas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/campaigns` en un Dashboard de lista compacta que muestre métricas de conteo (sesiones, PNJs, localizaciones, facciones, jugadores) por campaña y navega a la ficha completa al hacer clic.

**Architecture:** Un solo cambio en el servicio de backend añade los conteos que faltan. El tipo `Campaign` en el cliente API se extiende. La página `campaigns/page.tsx` reemplaza `CampaignCard` por `CampaignRow` con el nuevo layout compacto horizontal, conservando el formulario de creación y el widget de encuentros recientes.

**Tech Stack:** Fastify 5 + Prisma 5 (backend), Next.js 15 App Router + SWR + Tailwind + Zustand (frontend), Vitest + supertest (tests).

---

## Mapa de archivos

| Fichero | Acción | Responsabilidad |
|---------|--------|-----------------|
| `app/backend/src/services/campaign.service.ts` | Modificar | Añadir `locations`, `factions`, `players` a `_count` en `list()` |
| `app/backend/src/routes/campaigns.test.ts` | Crear | Test TDD: GET /api/campaigns devuelve los nuevos conteos |
| `app/frontend/src/lib/api.ts` | Modificar | Extender `Campaign._count` con los 3 nuevos campos |
| `app/frontend/src/app/campaigns/page.tsx` | Modificar | Reemplazar `CampaignCard` por `CampaignRow` compacto |

---

## Task 1: Backend — añadir conteos a campaign.service.ts

**Files:**
- Create: `app/backend/src/routes/campaigns.test.ts`
- Modify: `app/backend/src/services/campaign.service.ts`

### Contexto

El método `list()` en `campaign.service.ts` ya devuelve `_count` con `sessions`, `npcs` e `issues`. Hay que añadir `locations`, `factions` y `players`. El método `getById()` ya los tiene — solo falta en `list()`.

El test usa `buildTestApp()` de `src/test/app.ts` + supertest, el mismo patrón que `factions.test.ts`.

---

- [ ] **Step 1: Crear el test (TDD — escribir antes de implementar)**

Crear `app/backend/src/routes/campaigns.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import { buildTestApp } from "../test/app.js";
import { prisma } from "../db/prisma.js";

let request: ReturnType<typeof supertest>;
let app: Awaited<ReturnType<typeof buildTestApp>>;
let userId: string;
let campaignId: string;

beforeAll(async () => {
  app = await buildTestApp();
  request = supertest(app.server);
});

beforeEach(async () => {
  const user = await prisma.user.create({ data: { name: "Test User Campaigns" } });
  const campaign = await prisma.campaign.create({
    data: { title: "Campaña de Test Dashboard", userId: user.id },
  });
  userId = user.id;
  campaignId = campaign.id;

  // Crear entidades de prueba para verificar conteos
  await prisma.npc.create({ data: { campaignId, name: "Gandalf", status: "alive" } });
  await prisma.npc.create({ data: { campaignId, name: "Sauron", status: "alive" } });
  await prisma.location.create({ data: { campaignId, name: "La Comarca" } });
  await prisma.faction.create({ data: { campaignId, name: "Istari" } });
  await prisma.faction.create({ data: { campaignId, name: "Nazgûl" } });
  await prisma.player.create({
    data: {
      campaignId,
      name: "Frodo",
      playerName: "Jugador1",
      class: "Pícaro",
      level: 3,
      hp: 20,
      ac: 13,
    },
  });
});

afterEach(async () => {
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.player.deleteMany({ where: { campaignId } });
  await prisma.faction.deleteMany({ where: { campaignId } });
  await prisma.location.deleteMany({ where: { campaignId } });
  await prisma.npc.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("GET /api/campaigns — _count", () => {
  it("devuelve _count con sessions, npcs, issues, locations, factions, players", async () => {
    const res = await request.get("/api/campaigns");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const campaign = res.body.data.find((c: any) => c.id === campaignId);
    expect(campaign).toBeDefined();
    expect(campaign._count.npcs).toBe(2);
    expect(campaign._count.locations).toBe(1);
    expect(campaign._count.factions).toBe(2);
    expect(campaign._count.players).toBe(1);
    expect(campaign._count.sessions).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar el test — verificar que falla**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend"
pnpm test src/routes/campaigns.test.ts 2>&1 | tail -15
```

Esperado: el test falla porque `_count.locations`, `_count.factions` y `_count.players` son `undefined`.

- [ ] **Step 3: Añadir los conteos en `campaign.service.ts`**

En `app/backend/src/services/campaign.service.ts`, el método `list()` tiene este bloque (líneas 12-18):

```typescript
_count: {
  select: {
    sessions: true,
    npcs: true,
    issues: { where: { status: "open" } },
  },
},
```

Reemplazarlo por:

```typescript
_count: {
  select: {
    sessions: true,
    npcs: true,
    issues: { where: { status: "open" } },
    locations: true,
    factions: true,
    players: true,
  },
},
```

- [ ] **Step 4: Ejecutar el test — verificar que pasa**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend"
pnpm test src/routes/campaigns.test.ts 2>&1 | tail -10
```

Esperado: 1 test passing.

- [ ] **Step 5: Ejecutar suite completa del backend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend"
pnpm test 2>&1 | tail -6
```

Esperado: todos los tests existentes siguen pasando + el nuevo (123 tests).

- [ ] **Step 6: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/backend/src/services/campaign.service.ts app/backend/src/routes/campaigns.test.ts
git commit -m "feat(dashboard): añadir locations/factions/players a _count en campaign.service"
```

---

## Task 2: Frontend — extender tipo Campaign en api.ts

**Files:**
- Modify: `app/frontend/src/lib/api.ts`

### Contexto

El tipo `Campaign` en `api.ts` (línea ~349) tiene `_count` con solo `sessions`, `npcs` e `issues`. Hay que añadir los 3 nuevos campos para que TypeScript los reconozca en el componente.

---

- [ ] **Step 1: Actualizar el tipo `Campaign` en `app/frontend/src/lib/api.ts`**

Localizar esta definición (alrededor de la línea 349-358):

```typescript
export interface Campaign {
  id: string;
  title: string;
  description?: string | null;
  system: string;
  status: "active" | "paused" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
  _count?: { sessions: number; npcs: number; issues: number };
}
```

Reemplazar la línea de `_count` por:

```typescript
  _count?: {
    sessions: number;
    npcs: number;
    issues: number;
    locations: number;
    factions: number;
    players: number;
  };
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "error TS" | head -10
```

Esperado: 0 errores.

- [ ] **Step 3: Ejecutar tests del frontend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test 2>&1 | tail -6
```

Esperado: 46/46 passing.

- [ ] **Step 4: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/lib/api.ts
git commit -m "feat(dashboard): extender Campaign._count con locations/factions/players"
```

---

## Task 3: Frontend — reemplazar CampaignCard por CampaignRow

**Files:**
- Modify: `app/frontend/src/app/campaigns/page.tsx`

### Contexto

La página actual tiene un componente `CampaignCard` (líneas 176-257) que muestra un card con descripción, conteos básicos y links. Hay que reemplazarlo por `CampaignRow` — fila horizontal compacta que:
- Hace clic en toda la fila → navega a `/campaigns/[id]` + activa la campaña en Zustand
- Muestra: nombre + sistema | badge estado | 5 contadores | chevron →

El resto de la página (header, CreateCampaignModal, EncuentrosRecientes) se conserva íntegro.

---

- [ ] **Step 1: Añadir imports necesarios al inicio de la página**

La página ya importa `useState`, `useSWR`, `mutate`, `Link`, `clsx`, `api`, `Campaign`, `AppShell`, `StatusBadge`, `useAppStore`. Hay que añadir `useRouter` de `next/navigation` y `ChevronRight` de `lucide-react`.

Al inicio del fichero `app/frontend/src/app/campaigns/page.tsx`, en la línea de import de `next/navigation` (donde está `useRouter` si existe, o añadir):

```typescript
import { useRouter } from "next/navigation";
```

En la línea de imports de `lucide-react`, añadir `ChevronRight` a la lista existente.

- [ ] **Step 2: Reemplazar el componente `CampaignCard` por `CampaignRow`**

Localizar el bloque completo de `CampaignCard` (líneas 176-257, desde `function CampaignCard` hasta el cierre `}` de la función). Reemplazarlo por:

```typescript
function CampaignRow({ campaign }: { campaign: Campaign }) {
  const { setActiveCampaign, activeCampaignId } = useAppStore();
  const router = useRouter();
  const isActive = campaign.id === activeCampaignId;

  function handleClick() {
    setActiveCampaign(campaign);
    router.push(`/campaigns/${campaign.id}`);
  }

  const counts = [
    { value: campaign._count?.sessions ?? 0, label: "ses." },
    { value: campaign._count?.npcs ?? 0, label: "PNJs" },
    { value: campaign._count?.locations ?? 0, label: "locs." },
    { value: campaign._count?.factions ?? 0, label: "fac." },
    { value: campaign._count?.players ?? 0, label: "PJs" },
  ];

  return (
    <div
      onClick={handleClick}
      className={clsx(
        "flex items-center gap-4 border rounded-xl px-4 py-3.5 cursor-pointer transition-colors group",
        isActive
          ? "border-amber-600 bg-amber-950/20"
          : "border-stone-800 bg-stone-900 hover:border-stone-700"
      )}
    >
      {/* Nombre + sistema */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-100 truncate group-hover:text-white">
          {campaign.title}
        </p>
        <p className="text-xs text-stone-500 mt-0.5">{campaign.system}</p>
      </div>

      {/* Badge estado */}
      <StatusBadge status={campaign.status} />

      {/* Contadores */}
      <div className="hidden sm:flex items-center gap-5">
        {counts.map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="text-sm font-semibold text-amber-400 leading-none">{value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Chevron */}
      <ChevronRight size={16} className="text-stone-600 group-hover:text-stone-400 shrink-0" />
    </div>
  );
}
```

- [ ] **Step 3: Actualizar la referencia en `CampaignsPage`**

En el cuerpo de `CampaignsPage` (alrededor de la línea 306), reemplazar:

```typescript
{campaigns?.map((c) => <CampaignCard key={c.id} campaign={c} />)}
```

por:

```typescript
{campaigns?.map((c) => <CampaignRow key={c.id} campaign={c} />)}
```

- [ ] **Step 4: Actualizar el skeleton de carga**

El skeleton actual (líneas 284-289) tiene `h-32` pensado para cards. Ajustarlo para filas compactas. Localizar:

```typescript
{isLoading && (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-32 bg-stone-900 rounded-xl animate-pulse border border-stone-800" />
    ))}
  </div>
)}
```

Reemplazar por:

```typescript
{isLoading && (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-14 bg-stone-900 rounded-xl animate-pulse border border-stone-800" />
    ))}
  </div>
)}
```

- [ ] **Step 5: Limpiar imports no usados**

Con el nuevo componente, `BookOpen`, `Users`, `AlertTriangle` y `Swords` de `lucide-react` ya no se usan (eran del `CampaignCard` anterior). También `Link` de `next/link` puede haber quedado sin usar si solo se usaba en `CampaignCard`.

Verificar qué imports están sin usar:

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "is declared but" | head -10
```

Eliminar del import de `lucide-react` los iconos que ya no se usen (`BookOpen`, `Users`, `AlertTriangle`, `Swords`). Mantener `Plus` (se usa en el botón header) y `ChevronRight` (nuevo).

Si `Link` de `next/link` ya no se usa (verificar que no queda ninguna referencia), eliminarlo del import.

- [ ] **Step 6: Verificar typecheck completo**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "error TS" | head -10
```

Esperado: 0 errores.

- [ ] **Step 7: Ejecutar tests del frontend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test 2>&1 | tail -6
```

Esperado: 46/46 passing.

- [ ] **Step 8: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/app/campaigns/page.tsx
git commit -m "feat(dashboard): CampaignRow compacto con 5 métricas + navegación directa"
```

---

## Self-Review

**Spec coverage:**
- ✅ Backend añade `locations`, `factions`, `players` a `_count` del `list()` — Task 1
- ✅ Test verifica los nuevos conteos — Task 1
- ✅ Tipo `Campaign._count` extendido en api.ts — Task 2
- ✅ Layout B (fila compacta) con 5 contadores — Task 3
- ✅ Clic → navega a `/campaigns/[id]` + activa campaña — Task 3
- ✅ Badge de estado conservado — Task 3
- ✅ Botón "Nueva campaña" + `CreateCampaignModal` conservados — Task 3 no los toca
- ✅ Widget `EncuentrosRecientes` conservado — Task 3 no lo toca
- ✅ Skeleton ajustado a filas — Task 3 step 4

**No hay placeholders.** Todos los pasos tienen código completo.

**Consistencia de tipos:** `_count.locations`, `_count.factions`, `_count.players` — mismo nombre en el servicio, el tipo frontend y el componente.
