# Dashboard de Campañas — Spec

**Fecha:** 2026-04-17
**Sprint:** 9

---

## Objetivo

Convertir la página `/campaigns` en un Dashboard que muestre todas las campañas con métricas de conteo (sesiones, PNJs, localizaciones, facciones, jugadores), permitiendo navegar a la ficha completa de cada una con un clic.

---

## Alcance

- Reemplazar el layout actual de `app/frontend/src/app/campaigns/page.tsx` con diseño de lista compacta (opción B)
- Añadir `locations`, `factions` y `players` al `_count` del endpoint `GET /api/campaigns`
- Conservar el widget `EncuentrosRecientes` existente
- Conservar el formulario de creación/edición de campaña existente
- Sin nueva ruta: el redirect desde `/` a `/campaigns` no cambia

---

## Backend

### Cambio en `app/backend/src/routes/campaigns.ts`

En el `findMany` del `GET /`, ampliar el `_count` con las relaciones que faltan:

```typescript
_count: {
  select: {
    sessions: true,
    npcs: true,
    issues: true,
    locations: true,   // nuevo
    factions: true,    // nuevo
    players: true,     // nuevo
  },
},
```

Sin cambios en otros endpoints. Sin migración.

---

## Domain / API client

### Cambio en `app/frontend/src/lib/api.ts`

Extender el tipo `Campaign` con los nuevos campos de `_count`:

```typescript
export interface Campaign {
  // ... campos existentes ...
  _count?: {
    sessions: number;
    npcs: number;
    issues: number;
    locations: number;  // nuevo
    factions: number;   // nuevo
    players: number;    // nuevo
  };
}
```

---

## Frontend

### Reescritura de `app/frontend/src/app/campaigns/page.tsx`

**Layout general:**
```
[Header: "Campañas"  ·  + Nueva campaña]

[Lista de campañas]
  [Fila campaña 1]  nombre + sistema  |  badge estado  |  12 ses. · 34 PNJs · 18 locs. · 7 fac. · 4 PJs  →
  [Fila campaña 2]  ...
  [Fila nueva campaña — dashed, centrada]

[Widget: Encuentros Recientes de la campaña activa]
```

**Fila de campaña (`CampaignRow`):**
- Fila completa clickeable → `router.push(\`/campaigns/${campaign.id}\`)`
- Al hacer clic también activa la campaña en Zustand (`setActiveCampaign`)
- Hover: `border-stone-700` (actualmente `border-stone-800`)
- Layout: flex horizontal, gap-4, padding horizontal 16px, vertical 14px
- Secciones dentro de la fila:
  1. **Info** (flex-1): nombre en `text-sm font-semibold text-stone-100`, sistema en `text-xs text-stone-500`
  2. **Badge estado**: `StatusBadge` existente
  3. **Contadores** (5 valores): cada uno es `número en text-amber-400 font-semibold` + `label en text-stone-500 text-xs`; separados por `·` o en mini-columnas
  4. **Chevron →**: `text-stone-600 group-hover:text-stone-400`

**Métricas mostradas (en orden):**
| Label | Campo |
|-------|-------|
| ses. | `_count.sessions` |
| PNJs | `_count.npcs` |
| locs. | `_count.locations` |
| fac. | `_count.factions` |
| PJs | `_count.players` |

**Botón "Nueva campaña":**
- Permanece en el header igual que ahora
- Abre el formulario modal existente (sin cambios)

**Sin cambios:**
- `EncuentrosRecientes` widget (se conserva íntegro)
- Formulario de creación/edición de campaña
- Lógica de activación de campaña en Zustand

---

## Tests

- Backend: el `GET /api/campaigns` devuelve `_count.locations`, `_count.factions`, `_count.players` con valores correctos
- Frontend: los 46 tests existentes no deben romperse

---

## Fuera de alcance

- Ordenación / filtrado de campañas
- Búsqueda de campañas
- Métricas adicionales (issues, documentos, embeddings)
- Paginación
