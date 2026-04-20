# Sprint A — Rediseño de la Ficha de Jugador (Clases, HP, CA)

## Objetivo

Añadir a la ficha de jugador (`/players/[id]`) tres bloques integrados en la pestaña "Básico":
1. Panel de clases con soporte de multiclase completo
2. Registro de HP Máx por nivel (nivel 1 automático, niveles 2+ con dado o media)
3. Selector de CA con dropdown de armaduras PHB 2024 y escudo

Estos bloques sustituyen a los campos actuales `class`, `level`, `subclass`, `armorClass` y `hitPoints` como inputs libres.

---

## Contexto del proyecto

- **Frontend**: Next.js 15 App Router — `app/frontend/src/app/players/[id]/page.tsx`
- **Backend**: Fastify 5 + Prisma — `app/backend/src/routes/players.ts` + `prisma/schema.prisma`
- **Dominio**: `packages/domain/src/player.ts` (esquema Zod del modelo `Player`)
- **Datos PHB 2024**: `app/frontend/src/lib/dnd-2024-data.ts` — constantes de clases, especies, trasfondos
- **Cálculos puros**: `app/frontend/src/lib/player-calcs.ts` — ya existe con `abilityModifier`, `proficiencyBonus`, etc.

---

## 1. Cambios de schema (Prisma + Zod)

### 1.1 Campos que cambian en `Player`

| Campo actual | Nuevo campo | Tipo | Descripción |
|---|---|---|---|
| `class String` | eliminado | — | Sustituido por `classes` |
| `level Int` | eliminado | — | Sustituido por suma de `classes[].level` |
| `subclass String?` | eliminado | — | Sustituido por `classes[].subclass` |
| `armorClass Int?` | mantenido | `Int?` | Ahora calculado automáticamente |
| `hitPoints Int?` | mantenido | `Int?` | HP actuales (no confundir con HP máx) |
| — | `classes String` | JSON | `[{class: string, level: number, subclass: string}]` |
| — | `hpRolls String` | JSON | `[{level: number, value: number, rolled: boolean}]` |
| — | `equippedArmor String?` | String | Nombre de la armadura equipada (clave de `ARMOR_LIST`) |
| — | `shieldEquipped Boolean` | Boolean | Si lleva escudo (default `false`) |
| — | `hpUseAverage Boolean` | Boolean | Método HP para nv.2+: `true`=media, `false`=dado (default `true`) |

### 1.2 Migración de datos

Al añadir `classes`, `hpRolls`, `equippedArmor`, `shieldEquipped`, los valores existentes se inicializan:
- `classes`: `[{class: oldClass ?? "Guerrero", level: oldLevel ?? 1, subclass: oldSubclass ?? ""}]`
- `hpRolls`: `[{level: 1, value: HIT_DIE_BY_CLASS[oldClass] ?? 8, rolled: false}]`
- `equippedArmor`: `null`
- `shieldEquipped`: `false`
- `hpUseAverage`: `true`

La migración se realiza en un script Prisma (`prisma/migrations/`) que lee los valores viejos antes de eliminar las columnas.

### 1.3 Dominio Zod (`packages/domain/src/player.ts`)

Añadir:
```ts
const PlayerClassEntrySchema = z.object({
  class: z.string(),
  level: z.number().int().min(1).max(20),
  subclass: z.string().default(""),
});

const HpRollEntrySchema = z.object({
  level: z.number().int().min(1),
  value: z.number().int().min(0),
  rolled: z.boolean().default(false),
});
```

`PlayerSchema` usará estos sub-esquemas. Los campos JSON se almacenan como `String` en Prisma y se parsean/serializan en el service.

---

## 2. Datos PHB 2024 — constantes nuevas en `dnd-2024-data.ts`

```ts
// Armaduras PHB 2024: clave → { label, baseAC, type, desMax }
export const ARMOR_LIST = {
  none:           { label: "Sin armadura (10 + DES)",              baseAC: 10, type: "none",   desMax: null },
  leather:        { label: "Cuero (CA 11 + DES)",                  baseAC: 11, type: "light",  desMax: null },
  studdedLeather: { label: "Cuero tachonado (CA 12 + DES)",        baseAC: 12, type: "light",  desMax: null },
  hide:           { label: "Pieles (CA 12 + DES máx.+2)",          baseAC: 12, type: "medium", desMax: 2    },
  chainShirt:     { label: "Cota de mallas ligera (CA 13 + DES máx.+2)", baseAC: 13, type: "medium", desMax: 2 },
  scaleMail:      { label: "Cota de escamas (CA 14 + DES máx.+2)", baseAC: 14, type: "medium", desMax: 2    },
  breastplate:    { label: "Coraza (CA 14 + DES máx.+2)",          baseAC: 14, type: "medium", desMax: 2    },
  halfPlate:      { label: "Medio arnés (CA 15 + DES máx.+2)",     baseAC: 15, type: "medium", desMax: 2    },
  ringMail:       { label: "Cota de anillas (CA 14)",               baseAC: 14, type: "heavy",  desMax: 0    },
  chainMail:      { label: "Cota de mallas (CA 16)",                baseAC: 16, type: "heavy",  desMax: 0    },
  splint:         { label: "Armadura de bandas (CA 17)",            baseAC: 17, type: "heavy",  desMax: 0    },
  plate:          { label: "Armadura de placas (CA 18)",            baseAC: 18, type: "heavy",  desMax: 0    },
  unarmoredBarbarian: { label: "Defensa sin armadura — Bárbaro (10+DES+CON)", baseAC: 10, type: "special", desMax: null },
  unarmoredMonk:      { label: "Defensa sin armadura — Monje (10+DES+SAB)",   baseAC: 10, type: "special", desMax: null },
} as const;

export type ArmorKey = keyof typeof ARMOR_LIST;
```

---

## 3. Cálculos puros — ampliación de `player-calcs.ts`

Nuevas funciones puras (sin efectos secundarios, 100% testables):

```ts
// Nivel total sumando todas las clases
export function totalLevel(classes: PlayerClassEntry[]): number

// Proficiency Bonus basado en nivel total
// ya existe proficiencyBonus(level) — se reutiliza con totalLevel()

// HP Máx desde hpRolls + constitución.
// nivel 1: máximo del dado de la primera clase + conMod (automático, no editable).
// niveles 2+ con useAverage=true: floor(hitDie/2)+1 + conMod (derivado, sin leer hpRolls).
// niveles 2+ con useAverage=false: hpRolls[level].value + conMod (valor guardado por el jugador).
// Asignación de dado por nivel en multiclase: los niveles se consumen en orden de
// aparición en `classes`. Ej: Fighter 5 / Rogue 3 → niveles 1-5 usan d10, niveles 6-8 usan d8.
// HP máx NUNCA se persiste como campo separado; siempre se recalcula en tiempo real.
export function calcHpMaxFromRolls(
  hpRolls: HpRollEntry[],
  classes: PlayerClassEntry[],
  conScore: number,
  useAverage: boolean
): number

// CA automática desde armadura + DEX (+ CON/WIS según tipo especial)
export function calcAC(
  armorKey: ArmorKey | null,
  dexScore: number,
  shieldEquipped: boolean,
  conScore?: number,  // para Bárbaro
  wisScore?: number,  // para Monje
): number
```

---

## 4. Componentes UI

### 4.1 `ClassesPanel.tsx` (nuevo)

Ubicación: `app/frontend/src/app/players/[id]/ClassesPanel.tsx`

**Props:**
```ts
interface ClassesPanelProps {
  classes: PlayerClassEntry[];
  onChange: (classes: PlayerClassEntry[]) => void;
}
```

**Comportamiento:**
- Renderiza una fila por clase: `[Select clase] [Input nivel] [Select subclase] [✕]`
- Subclase oculta hasta que `level >= 3` en esa clase (o nivel 1 para Pícaro — archetipo a nivel 1, para Brujo — pacto a nivel 1). Para simplificar Sprint A: subclase visible siempre pero marcada como "(nv.3+)" si nivel < 3.
- La primera clase no tiene botón ✕ (no puede eliminarse si es la única)
- Botón "+ Añadir clase" con borde punteado
- Totales calculados: nivel total, proficiency bonus, dados de vida concatenados (ej: "5d10 + 3d8")
- Las opciones del Select de clase vienen de `DND_CLASSES` (ya existe en `dnd-2024-data.ts`)
- Las opciones de subclase filtradas por clase seleccionada

### 4.2 `HpRollsPanel.tsx` (nuevo)

Ubicación: `app/frontend/src/app/players/[id]/HpRollsPanel.tsx`

**Props:**
```ts
interface HpRollsPanelProps {
  hpRolls: HpRollEntry[];      // solo entradas con valor guardado (nivel 1 + niveles con dado)
  classes: PlayerClassEntry[];
  conScore: number;
  useAverage: boolean;         // persiste en Player.hpUseAverage
  onRollsChange: (rolls: HpRollEntry[]) => void;
  onMethodChange: (useAverage: boolean) => void;
}
```

**Comportamiento:**
- Toggle "Media / Tirar dado" aplicado a niveles 2+
- Tabla con columnas: NIVEL · MÉTODO · DADO · TOTAL acumulado
- Nivel 1: siempre máximo automático del dado de la primera clase, no editable
- Niveles 2+: si `useAverage` → calculado automáticamente (sin input); si dado → input editable con el valor rolled
- Al cambiar número de niveles (por cambio en `classes`), `hpRolls` se sincroniza: añade entradas para nuevos niveles, elimina entradas sobrantes
- Dado por nivel: corresponde al dado de la clase a la que pertenece ese nivel (orden de adquisición)
- HP Máx total mostrado al pie

### 4.3 Bloque CA en `page.tsx` (inline, no componente separado)

El bloque CA se integra directamente en la página existente. No justifica un componente propio por su simplicidad.

**Comportamiento:**
- Select de armadura con grupos: `<optgroup label="LIGERA">`, `<optgroup label="MEDIA">`, etc.
- Checkbox escudo
- CA calculada en tiempo real mediante `calcAC()` y mostrada en el badge amarillo
- Se guarda `equippedArmor` y `shieldEquipped` en el estado local; `armorClass` se recalcula antes de `PATCH /api/players/:id`

---

## 5. Flujo de guardado

El `PATCH /api/players/:id` existente recibe el objeto `Player` completo. El frontend:
1. Serializa `classes` y `hpRolls` como JSON strings
2. Calcula `armorClass` final con `calcAC()` y lo incluye en el payload
3. El backend persiste los strings JSON directamente (sin parsear en el service — Prisma los trata como `String`)
4. El dominio Zod parsea/valida en los endpoints

---

## 6. Tests

### `player-calcs.test.ts` — funciones nuevas
- `totalLevel`: nivel total sumando clases
- `calcHpMaxFromRolls`: nivel 1 + CON, niveles 2+ con dado/media + CON por nivel
- `calcAC`: sin armadura (10+DES), ligera (base+DES), media (base+DES máx+2), pesada (base), escudo +2, Bárbaro (10+DES+CON)

### `ClassesPanel.test.tsx`
- Renderiza una fila por clase
- Añadir clase incrementa la lista
- Eliminar clase (no la primera)
- Totales calculados correctamente

### `HpRollsPanel.test.tsx`
- Nivel 1 no editable, valor = máximo del dado
- Con `useAverage=true`: todos los inputs deshabilitados
- Sincroniación al cambiar nivel total (añade/elimina filas)
- Total HP Máx correcto

---

## 7. Fuera de alcance (Sprint B)

- Auto-rellenar competencias/idiomas desde clase/especie/trasfondo
- Panel estructurado de competencias e idiomas (opciones A/B ya diseñadas)
- Integración con inventario (armas, objetos mágicos)
- Slots de conjuro por multiclase (tabla de multiclase PHB 2024)

---

## Decisiones de diseño

| Decisión | Opción elegida | Motivo |
|---|---|---|
| HP tracking | A — por nivel | Histórico completo, permite correcciones |
| CA | A — selector completo | Automatización máxima, sin entrada manual |
| Multiclase | B — panel expandible | Soporta cualquier número de clases |
| Proficiencias | B — lista por filas | Más legible con listas largas (Sprint B) |
| JSON en Prisma | String (no JsonValue) | SQLite no tiene tipo JSON nativo; consistente con campos existentes |
