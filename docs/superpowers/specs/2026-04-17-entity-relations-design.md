# Sistema de Relaciones entre Entidades — Spec

**Fecha:** 2026-04-17
**Sprint:** 9

---

## Objetivo

Permitir vincular explícitamente NPCs, Facciones y Localizaciones entre sí con un tipo de relación predefinido y notas narrativas opcionales. Las relaciones se gestionan desde la ficha de cada entidad y se muestran en ambos extremos del vínculo.

---

## Alcance

- Todos los pares: NPC↔NPC, NPC↔Facción, NPC↔Localización, Facción↔Facción, Facción↔Localización, Localización↔Localización
- Gestión desde la ficha de cada entidad (modal/detalle)
- Selector de tipo de relación curado por par
- Notas narrativas opcionales por relación
- Sin grafo visual por ahora (Sprint futuro)

---

## Base de datos

### Nueva tabla: `EntityRelation`

```prisma
model EntityRelation {
  id           String   @id @default(cuid())
  campaignId   String
  fromType     String   // "npc" | "faction" | "location"
  fromId       String
  toType       String   // "npc" | "faction" | "location"
  toId         String
  relationType String   // tipo curado según el par
  notes        String?  // contexto narrativo opcional
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId])
  @@index([fromType, fromId])
  @@index([toType, toId])
}
```

### Relación con Campaign

`Campaign` en schema.prisma añade: `entityRelations EntityRelation[]`

---

## Tipos de relación curados

Definidos como constante en `packages/shared/src/relations.ts` y exportados como `RELATION_TYPES`.

```typescript
export const RELATION_TYPES = {
  "npc-npc": [
    "aliado", "enemigo", "rival", "mentor", "aprendiz",
    "familiar", "subordinado", "superior", "patrón", "asociado"
  ],
  "npc-faction": [
    "miembro", "líder", "agente", "simpatizante",
    "enemigo", "renegado", "protegido", "patrocinado"
  ],
  "npc-location": [
    "residente", "propietario", "guardián",
    "visitante frecuente", "nacido en", "controla", "exiliado de"
  ],
  "faction-faction": [
    "aliada", "enemiga", "rival", "subordinada a",
    "controla", "alianza temporal", "infiltrada por"
  ],
  "faction-location": [
    "controla", "base de operaciones", "territorio reclamado",
    "protege", "presencia oculta", "busca acceso"
  ],
  "location-location": [
    "frontera con", "acceso a través de", "controla", "rival de"
  ],
} as const;
```

La clave del par se construye ordenando alfabéticamente los dos tipos: `[typeA, typeB].sort().join("-")`. Esto garantiza que `npc-faction` y `faction-npc` usen la misma lista.

---

## API

### Nuevos endpoints: `/api/relations`

#### `GET /api/relations?campaignId=X&entityType=npc&entityId=Y`
Devuelve todas las relaciones donde la entidad aparece como `fromId` o `toId`. Incluye datos resueltos de las entidades relacionadas (nombre, tipo).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "relationType": "miembro",
      "notes": null,
      "direction": "from",
      "entity": { "type": "faction", "id": "...", "name": "Gremio de los Cazadores" }
    }
  ]
}
```

#### `POST /api/relations`
Crea una relación nueva. Valida que ambas entidades pertenezcan a la misma campaña. Valida que `relationType` esté en la lista del par correspondiente. Registra en ChangeLog.

**Body:**
```json
{
  "campaignId": "...",
  "fromType": "npc",
  "fromId": "...",
  "toType": "faction",
  "toId": "...",
  "relationType": "miembro",
  "notes": "Unido tras los eventos de la sesión 3"
}
```

#### `DELETE /api/relations/:id`
Elimina la relación. Registra en ChangeLog.

---

## Domain schema

Nuevo schema en `packages/domain/src/entities/index.ts`:

```typescript
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
  campaignId: true, fromType: true, fromId: true,
  toType: true, toId: true, relationType: true, notes: true,
});
export type CreateEntityRelation = z.infer<typeof CreateEntityRelationSchema>;
```

---

## Frontend

### Componente: `RelationsPanel`

Ubicación: `app/frontend/src/components/ui/RelationsPanel.tsx`

Props:
```typescript
interface RelationsPanelProps {
  campaignId: string;
  entityType: "npc" | "faction" | "location";
  entityId: string;
}
```

**Vista de lista:** muestra relaciones existentes como filas:
```
[tipo]  Nombre de entidad relacionada   [×]
```

**Formulario de nueva relación (inline, toggle con botón +):**
1. Select: tipo de entidad destino (NPC / Facción / Localización)
2. Select con búsqueda: nombre de entidad (filtrado por tipo y campaña)
3. Select: tipo de relación (lista filtrada según el par)
4. Input opcional: notas
5. Botón guardar / cancelar

### Integración

`RelationsPanel` se añade al final de los modales/fichas de:
- `app/frontend/src/app/npcs/page.tsx` (modal de detalle NPC)
- `app/frontend/src/app/factions/page.tsx` (modal de detalle Facción)
- `app/frontend/src/app/locations/page.tsx` (modal de detalle Localización)

### API client

Nuevos métodos en `app/frontend/src/lib/api.ts`:
```typescript
relations: {
  list: (campaignId: string, entityType: string, entityId: string) =>
    get<RelationItem[]>(`/api/relations?campaignId=${campaignId}&entityType=${entityType}&entityId=${entityId}`),
  create: (data: CreateEntityRelation) =>
    post<EntityRelation>("/api/relations", data),
  delete: (id: string) =>
    del(`/api/relations/${id}`),
}
```

---

## ChangeLog

Todas las operaciones sobre relaciones se registran en ChangeLog con `entityType: "relation"`.

---

## Tests

- Backend: validación de par (tipos correctos), validación de relationType según par, pertenencia de entidades a la misma campaña
- Backend: GET devuelve relaciones en ambas direcciones
- Frontend: 46 tests existentes no deben romperse

---

## Fuera de alcance (Sprint futuro)

- Grafo visual de relaciones
- Filtrado/búsqueda por relaciones en páginas de listado
- Relaciones con Players o Sessions
- Fuerza/intensidad de relación
- Fecha de inicio/fin de relación
