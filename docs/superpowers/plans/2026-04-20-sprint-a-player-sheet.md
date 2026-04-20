# Sprint A — Rediseño Ficha de Jugador (Clases, HP, CA, Dotes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a la ficha de jugador un panel de clases con multiclase, registro de HP por nivel, selector de CA automático, y panel de dotes/ASI que afectan a todas las estadísticas derivadas.

**Architecture:** Los nuevos campos (`classes`, `hpRolls`, `equippedArmor`, `hpUseAverage`) se añaden al modelo Prisma como JSON strings. Tres nuevos componentes React encapsulan cada panel. Todas las fórmulas derivadas pasan por funciones puras en `player-calcs.ts` usando `finalAbilityScore()` para incorporar los bonos de dotes.

**Tech Stack:** Next.js 15 App Router, Prisma 5 + SQLite, Zod, Vitest (funciones puras), Tailwind CSS.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `app/backend/prisma/schema.prisma` — añadir 4 campos al modelo Player |
| Crear | `app/backend/src/db/migrate-player-classes.ts` — backfill script |
| Modificar | `app/backend/src/routes/players.ts` — aceptar nuevos campos en POST y PATCH |
| Modificar | `app/frontend/src/lib/dnd-2024-data.ts` — añadir ARMOR_LIST, ASI_LEVELS_BY_CLASS |
| Modificar | `app/frontend/src/lib/player-calcs.ts` — tipos + 4 nuevas funciones puras |
| Modificar | `app/frontend/src/lib/player-calcs.test.ts` — tests para las nuevas funciones |
| Crear | `app/frontend/src/app/players/[id]/ClassesPanel.tsx` |
| Crear | `app/frontend/src/app/players/[id]/HpRollsPanel.tsx` |
| Crear | `app/frontend/src/app/players/[id]/FeatsPanel.tsx` |
| Modificar | `app/frontend/src/app/players/[id]/page.tsx` — integrar los tres paneles |

---

## Task 1: Schema Prisma — añadir nuevos campos al modelo Player

**Files:**
- Modify: `app/backend/prisma/schema.prisma`
- Create: `app/backend/src/db/migrate-player-classes.ts`

- [ ] **Step 1: Añadir campos al modelo Player en schema.prisma**

Busca el bloque `// Features, traits & dons` (línea ~370) y añade `classes`, `hpRolls`, `equippedArmor`, `hpUseAverage` justo antes de él:

```prisma
  // Clase y multiclase (D&D 2024)
  classes     String  @default("[]")  // JSON: [{class, level, subclass}]
  hpRolls     String  @default("[]")  // JSON: [{level, value, rolled}]
  equippedArmor String?               // clave de ARMOR_LIST, ej: "scaleMail"
  hpUseAverage  Boolean @default(true) // true=media, false=dado manual

  // Features, traits & dons
```

Los campos `class String?`, `level Int`, `subclass String?` se mantienen como legacy (SQLite no permite DROP COLUMN). No los elimines.

- [ ] **Step 2: Ejecutar la migración**

```bash
cd app/backend && npx prisma migrate dev --name sprint-a-player-fields
```

Respuesta esperada: `The following migration(s) have been applied: .../sprint_a_player_fields/migration.sql`. El cliente Prisma se regenera automáticamente.

- [ ] **Step 3: Escribir el script de backfill**

Crea `app/backend/src/db/migrate-player-classes.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HIT_DIE: Record<string, number> = {
  "Bárbaro": 12, "Guerrero": 10, "Paladín": 10, "Explorador": 10,
  "Bardo": 8, "Clérigo": 8, "Druida": 8, "Monje": 8,
  "Pícaro": 8, "Brujo": 8, "Hechicero": 6, "Mago": 6,
};

async function main() {
  const players = await prisma.player.findMany();
  let updated = 0;

  for (const p of players) {
    // Solo migrar si classes está vacío (evitar doble migración)
    const existingClasses = JSON.parse(p.classes ?? "[]");
    if (existingClasses.length > 0) continue;

    const className = p.class ?? "Guerrero";
    const level = p.level ?? 1;
    const subclass = p.subclass ?? "";
    const hitDie = HIT_DIE[className] ?? 8;

    const classes = [{ class: className, level, subclass }];
    const hpRolls = [{ level: 1, value: hitDie, rolled: false }];

    await prisma.player.update({
      where: { id: p.id },
      data: {
        classes: JSON.stringify(classes),
        hpRolls: JSON.stringify(hpRolls),
      },
    });
    updated++;
  }

  console.log(`Migrados ${updated} de ${players.length} jugadores.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Ejecutar el backfill**

```bash
cd app/backend && npx tsx src/db/migrate-player-classes.ts
```

Resultado esperado: `Migrados N de N jugadores.`

- [ ] **Step 5: Commit**

```bash
git add app/backend/prisma/schema.prisma \
        app/backend/prisma/migrations/ \
        app/backend/src/db/migrate-player-classes.ts
git commit -m "feat(schema): añadir classes/hpRolls/equippedArmor/hpUseAverage a Player"
```

---

## Task 2: Backend route — aceptar nuevos campos

**Files:**
- Modify: `app/backend/src/routes/players.ts:70-141`

- [ ] **Step 1: Añadir los nuevos campos al schema Zod del PATCH**

En el `server.patch` (línea ~70), dentro del objeto `z.object({...})`, añade estas líneas después de `feats: z.string().optional()` (línea ~122):

```typescript
      classes:      z.string().optional(),
      hpRolls:      z.string().optional(),
      equippedArmor: z.string().nullish(),
      hpUseAverage:  z.boolean().optional(),
```

- [ ] **Step 2: Verificar que el PATCH persiste los nuevos campos**

El `prisma.player.update({ where, data })` ya propaga todo lo que Zod parsea, así que no hace falta cambiar nada más en el handler. Confirma visualmente que la línea 147 siga siendo:

```typescript
    const updated = await prisma.player.update({
      where: { id: request.params.id },
      data,
    });
```

- [ ] **Step 3: Verificar types con typecheck**

```bash
cd app/backend && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/backend/src/routes/players.ts
git commit -m "feat(api): aceptar classes/hpRolls/equippedArmor/hpUseAverage en PATCH /players/:id"
```

---

## Task 3: dnd-2024-data.ts — ARMOR_LIST y ASI_LEVELS_BY_CLASS

**Files:**
- Modify: `app/frontend/src/lib/dnd-2024-data.ts`

- [ ] **Step 1: Añadir ARMOR_LIST al final del archivo**

```typescript
// Armaduras PHB 2024
export const ARMOR_LIST = {
  none:               { label: "Sin armadura (10 + DES)",                     baseAC: 10, type: "none",    desMax: null as number | null },
  leather:            { label: "Cuero (CA 11 + DES)",                          baseAC: 11, type: "light",   desMax: null as number | null },
  studdedLeather:     { label: "Cuero tachonado (CA 12 + DES)",                baseAC: 12, type: "light",   desMax: null as number | null },
  hide:               { label: "Pieles (CA 12 + DES máx.+2)",                  baseAC: 12, type: "medium",  desMax: 2 as number | null },
  chainShirt:         { label: "Cota de mallas ligera (CA 13 + DES máx.+2)",   baseAC: 13, type: "medium",  desMax: 2 as number | null },
  scaleMail:          { label: "Cota de escamas (CA 14 + DES máx.+2)",         baseAC: 14, type: "medium",  desMax: 2 as number | null },
  breastplate:        { label: "Coraza (CA 14 + DES máx.+2)",                  baseAC: 14, type: "medium",  desMax: 2 as number | null },
  halfPlate:          { label: "Medio arnés (CA 15 + DES máx.+2)",             baseAC: 15, type: "medium",  desMax: 2 as number | null },
  ringMail:           { label: "Cota de anillas (CA 14)",                       baseAC: 14, type: "heavy",   desMax: 0 as number | null },
  chainMail:          { label: "Cota de mallas (CA 16)",                        baseAC: 16, type: "heavy",   desMax: 0 as number | null },
  splint:             { label: "Armadura de bandas (CA 17)",                    baseAC: 17, type: "heavy",   desMax: 0 as number | null },
  plate:              { label: "Armadura de placas (CA 18)",                    baseAC: 18, type: "heavy",   desMax: 0 as number | null },
  unarmoredBarbarian: { label: "Defensa sin armadura — Bárbaro (10+DES+CON)",  baseAC: 10, type: "special", desMax: null as number | null },
  unarmoredMonk:      { label: "Defensa sin armadura — Monje (10+DES+SAB)",    baseAC: 10, type: "special", desMax: null as number | null },
} as const;

export type ArmorKey = keyof typeof ARMOR_LIST;

// Niveles con ASI/dote por clase (PHB 2024)
export const ASI_LEVELS_BY_CLASS: Record<string, number[]> = {
  "Guerrero": [4, 6, 8, 12, 14, 16, 19],
  "Pícaro":   [4, 8, 10, 12, 16, 19],
};
const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19];

export function asiLevelsForClass(className: string): number[] {
  return ASI_LEVELS_BY_CLASS[className] ?? DEFAULT_ASI_LEVELS;
}
```

- [ ] **Step 2: Verificar con typecheck**

```bash
cd app/frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores relacionados con `dnd-2024-data.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/lib/dnd-2024-data.ts
git commit -m "feat(data): añadir ARMOR_LIST y ASI_LEVELS_BY_CLASS (PHB 2024)"
```

---

## Task 4: player-calcs.ts — tipos y funciones puras + tests

**Files:**
- Modify: `app/frontend/src/lib/player-calcs.ts`
- Modify: `app/frontend/src/lib/player-calcs.test.ts`

- [ ] **Step 1: Escribir los tests que deben fallar primero**

Añade al final de `player-calcs.test.ts`:

```typescript
// ─── Tipos usados en los tests ────────────────────────────────────────────────
// (importados del mismo módulo que se está probando)

describe("totalLevel", () => {
  it("una sola clase → su nivel", () =>
    expect(totalLevel([{ class: "Guerrero", level: 5, subclass: "" }])).toBe(5));
  it("multiclase → suma", () =>
    expect(totalLevel([
      { class: "Guerrero", level: 5, subclass: "" },
      { class: "Pícaro", level: 3, subclass: "" },
    ])).toBe(8));
  it("vacío → 0", () =>
    expect(totalLevel([])).toBe(0));
});

describe("finalAbilityScore", () => {
  it("sin dotes → valor base", () =>
    expect(finalAbilityScore(15, "strength", [])).toBe(15));
  it("dote con +1 al stat correcto → base + 1", () =>
    expect(finalAbilityScore(15, "strength", [
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [{ stat: "strength", value: 1 }] },
    ])).toBe(16));
  it("dote con stat distinto → sin cambio", () =>
    expect(finalAbilityScore(15, "strength", [
      { name: "Tough", classIndex: 0, level: 4, statBonuses: [{ stat: "constitution", value: 1 }] },
    ])).toBe(15));
  it("dos dotes con mismo stat → suma", () =>
    expect(finalAbilityScore(14, "dexterity", [
      { name: "Feat A", classIndex: 0, level: 4, statBonuses: [{ stat: "dexterity", value: 1 }] },
      { name: "Feat B", classIndex: 0, level: 8, statBonuses: [{ stat: "dexterity", value: 1 }] },
    ])).toBe(16));
  it("no supera 30", () =>
    expect(finalAbilityScore(29, "strength", [
      { name: "ASI", classIndex: 0, level: 4, statBonuses: [{ stat: "strength", value: 2 }] },
    ])).toBe(30));
  it("no baja de 1", () =>
    expect(finalAbilityScore(1, "strength", [])).toBe(1));
});

describe("calcHpMaxFromRolls", () => {
  it("una clase, nivel 1, CON 10 → máximo dado", () => {
    const classes = [{ class: "Guerrero", level: 1, subclass: "" }];
    const hpRolls = [{ level: 1, value: 10, rolled: false }];
    // nivel 1: hitDie=10, conMod=0 → 10
    expect(calcHpMaxFromRolls(hpRolls, classes, 10, true)).toBe(10);
  });
  it("Guerrero nivel 2, CON 16 (+3), media → 10 + (5+1+3)=19", () => {
    // nivel 1: 10+3=13; nivel 2 media d10: floor(10/2)+1=6, +3=9 → total 22
    const classes = [{ class: "Guerrero", level: 2, subclass: "" }];
    const hpRolls = [{ level: 1, value: 10, rolled: false }];
    expect(calcHpMaxFromRolls(hpRolls, classes, 16, true)).toBe(22);
  });
  it("multiclase Fighter5/Rogue3, CON 10, media", () => {
    // Fighter: d10 → niveles 1-5; Rogue: d8 → niveles 6-8
    // nv1: 10+0=10
    // nv2-5 (d10, media 6): 4×6=24
    // nv6-8 (d8, media 5): 3×5=15
    // Total: 10+24+15=49
    const classes = [
      { class: "Guerrero", level: 5, subclass: "" },
      { class: "Pícaro", level: 3, subclass: "" },
    ];
    const hpRolls = [{ level: 1, value: 10, rolled: false }];
    expect(calcHpMaxFromRolls(hpRolls, classes, 10, true)).toBe(49);
  });
  it("useAverage=false usa rolls guardados", () => {
    const classes = [{ class: "Guerrero", level: 2, subclass: "" }];
    const hpRolls = [
      { level: 1, value: 10, rolled: false },
      { level: 2, value: 8, rolled: true },
    ];
    // nv1: 10+0=10; nv2 roll=8+0=8 → 18
    expect(calcHpMaxFromRolls(hpRolls, classes, 10, false)).toBe(18);
  });
  it("sin roll guardado y useAverage=false usa fallback de media", () => {
    const classes = [{ class: "Guerrero", level: 2, subclass: "" }];
    const hpRolls = [{ level: 1, value: 10, rolled: false }]; // sin roll para nv2
    // nv2 fallback: floor(10/2)+1=6, +0=6 → total 16
    expect(calcHpMaxFromRolls(hpRolls, classes, 10, false)).toBe(16);
  });
  it("HP mínimo 1 por nivel con CON muy negativa", () => {
    const classes = [{ class: "Mago", level: 1, subclass: "" }]; // d6
    const hpRolls = [{ level: 1, value: 6, rolled: false }];
    // CON 1 → mod -5. 6+(-5)=1, max(1,1)=1
    expect(calcHpMaxFromRolls(hpRolls, classes, 1, true)).toBe(1);
  });
  it("clases vacías → 0", () =>
    expect(calcHpMaxFromRolls([], [], 10, true)).toBe(0));
});

describe("calcAC", () => {
  it("sin armadura: 10 + mod DES", () =>
    expect(calcAC("none", 14, false)).toBe(12)); // 10 + 2
  it("sin armadura + escudo: +2", () =>
    expect(calcAC("none", 14, true)).toBe(14)); // 12+2
  it("armadura ligera: base + DES completo", () =>
    expect(calcAC("studdedLeather", 18, false)).toBe(16)); // 12 + 4
  it("armadura media: base + DES máx +2", () =>
    expect(calcAC("scaleMail", 18, false)).toBe(16)); // 14 + 2(capped)
  it("armadura media: DES menor que 2 → DES real", () =>
    expect(calcAC("scaleMail", 12, false)).toBe(15)); // 14 + 1
  it("armadura pesada: base sin DES", () =>
    expect(calcAC("plate", 20, false)).toBe(18)); // 18 + 0
  it("armadura pesada + escudo", () =>
    expect(calcAC("plate", 20, true)).toBe(20)); // 18 + 2
  it("Defensa bárbaro: 10 + DES + CON", () =>
    expect(calcAC("unarmoredBarbarian", 14, false, 16)).toBe(15)); // 10+2+3
  it("armorKey null → 10 + DES (igual que none)", () =>
    expect(calcAC(null, 12, false)).toBe(11)); // 10+1
});
```

- [ ] **Step 2: Ejecutar los tests — deben fallar**

```bash
cd app/frontend && pnpm test 2>&1 | tail -20
```

Esperado: `FAIL` con errores de "not defined" o "not a function" para `totalLevel`, `finalAbilityScore`, `calcHpMaxFromRolls`, `calcAC`.

- [ ] **Step 3: Actualizar los imports en el test**

Al inicio del test file, actualiza el import de `player-calcs`:

```typescript
import {
  abilityModifier,
  proficiencyBonus,
  calcPassivePerception,
  calcSpellSaveDC,
  calcSpellAttackBonus,
  calcHpMaxSuggestion,
  totalLevel,
  finalAbilityScore,
  calcHpMaxFromRolls,
  calcAC,
  type PlayerClassEntry,
  type HpRollEntry,
  type FeatEntry,
} from "./player-calcs";
```

- [ ] **Step 4: Implementar los tipos y funciones en player-calcs.ts**

Reemplaza el contenido completo del archivo:

```typescript
import { HIT_DIE_BY_CLASS, ARMOR_LIST, type ArmorKey } from "./dnd-2024-data";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface PlayerClassEntry {
  class: string;
  level: number;
  subclass: string;
}

export interface HpRollEntry {
  level: number;
  value: number;
  rolled: boolean;
}

export interface FeatStatBonus {
  stat: "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
  value: number;
}

export interface FeatEntry {
  name: string;
  classIndex: number;
  level: number;
  statBonuses: FeatStatBonus[];
}

// ─── Funciones existentes (sin cambios) ───────────────────────────────────────

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export function calcPassivePerception(
  wisdomScore: number,
  level: number,
  hasProficiency: boolean,
  hasExpertise: boolean
): number {
  const wisMod = abilityModifier(wisdomScore);
  const pb = proficiencyBonus(level);
  const bonus = hasExpertise ? pb * 2 : hasProficiency ? pb : 0;
  return 10 + wisMod + bonus;
}

export function calcSpellSaveDC(abilityScore: number, level: number): number {
  return 8 + abilityModifier(abilityScore) + proficiencyBonus(level);
}

export function calcSpellAttackBonus(abilityScore: number, level: number): number {
  return abilityModifier(abilityScore) + proficiencyBonus(level);
}

export function calcHpMaxSuggestion(
  className: string,
  constitutionScore: number,
  level: number
): number | null {
  const hitDie = HIT_DIE_BY_CLASS[className];
  if (!hitDie) return null;
  const conMod = abilityModifier(constitutionScore);
  const level1Hp = Math.max(1, hitDie + conMod);
  const avgPerLevel = Math.floor(hitDie / 2) + 1;
  const additionalHp = (level - 1) * Math.max(1, avgPerLevel + conMod);
  return level1Hp + additionalHp;
}

// ─── Funciones nuevas Sprint A ────────────────────────────────────────────────

export function totalLevel(classes: PlayerClassEntry[]): number {
  return classes.reduce((sum, c) => sum + c.level, 0);
}

export function finalAbilityScore(
  baseStat: number,
  stat: string,
  feats: FeatEntry[],
): number {
  const bonus = feats.reduce((sum, feat) =>
    sum + feat.statBonuses
      .filter(b => b.stat === stat)
      .reduce((s, b) => s + b.value, 0),
    0
  );
  return Math.min(30, Math.max(1, baseStat + bonus));
}

export function calcHpMaxFromRolls(
  hpRolls: HpRollEntry[],
  classes: PlayerClassEntry[],
  conScore: number,
  useAverage: boolean
): number {
  if (classes.length === 0) return 0;

  const conMod = abilityModifier(conScore);

  // Lista ordenada de hit dice por nivel (primera clase consume niveles 1..N1, etc.)
  const hitDicePerLevel: number[] = [];
  for (const cls of classes) {
    const hitDie = HIT_DIE_BY_CLASS[cls.class] ?? 8;
    for (let i = 0; i < cls.level; i++) hitDicePerLevel.push(hitDie);
  }

  let total = 0;

  for (let lvl = 1; lvl <= hitDicePerLevel.length; lvl++) {
    const hitDie = hitDicePerLevel[lvl - 1] ?? 8;

    if (lvl === 1) {
      // Nivel 1: siempre máximo del dado
      total += Math.max(1, hitDie + conMod);
    } else if (useAverage) {
      // Media fija: floor(hitDie/2)+1
      const avg = Math.floor(hitDie / 2) + 1;
      total += Math.max(1, avg + conMod);
    } else {
      // Dado manual: valor guardado en hpRolls, o media como fallback
      const roll = hpRolls.find(r => r.level === lvl);
      const rolledValue = roll?.value ?? (Math.floor(hitDie / 2) + 1);
      total += Math.max(1, rolledValue + conMod);
    }
  }

  return total;
}

export function calcAC(
  armorKey: string | null,
  dexScore: number,
  shieldEquipped: boolean,
  conScore?: number,
  wisScore?: number,
): number {
  const dexMod = abilityModifier(dexScore);
  const armor = armorKey ? ARMOR_LIST[armorKey as ArmorKey] : null;

  let base: number;

  if (!armor || armorKey === "none") {
    base = 10 + dexMod;
  } else if (armor.type === "light") {
    base = armor.baseAC + dexMod;
  } else if (armor.type === "medium") {
    const cap = armor.desMax ?? 2;
    base = armor.baseAC + Math.min(dexMod, cap);
  } else if (armor.type === "heavy") {
    base = armor.baseAC;
  } else if (armorKey === "unarmoredBarbarian" && conScore !== undefined) {
    base = 10 + dexMod + abilityModifier(conScore);
  } else if (armorKey === "unarmoredMonk" && wisScore !== undefined) {
    base = 10 + dexMod + abilityModifier(wisScore);
  } else {
    base = 10 + dexMod;
  }

  return base + (shieldEquipped ? 2 : 0);
}
```

- [ ] **Step 5: Ejecutar los tests — deben pasar**

```bash
cd app/frontend && pnpm test 2>&1 | tail -10
```

Esperado: todos los tests PASS (los 21 existentes + los nuevos).

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/lib/player-calcs.ts \
        app/frontend/src/lib/player-calcs.test.ts
git commit -m "feat(calcs): totalLevel, finalAbilityScore, calcHpMaxFromRolls, calcAC + tests"
```

---

## Task 5: ClassesPanel.tsx — panel de clases con multiclase

**Files:**
- Create: `app/frontend/src/app/players/[id]/ClassesPanel.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client";
import React from "react";
import { PlayerClassEntry, totalLevel, proficiencyBonus } from "../../../lib/player-calcs";
import { DND_CLASSES, HIT_DIE_BY_CLASS } from "../../../lib/dnd-2024-data";

interface ClassesPanelProps {
  classes: PlayerClassEntry[];
  onChange: (classes: PlayerClassEntry[]) => void;
}

export function ClassesPanel({ classes, onChange }: ClassesPanelProps) {
  const classNames = Object.keys(DND_CLASSES).sort();
  const level = totalLevel(classes);
  const pb = proficiencyBonus(level || 1);
  const hitDiceStr = classes
    .map(c => `${c.level}d${HIT_DIE_BY_CLASS[c.class] ?? 8}`)
    .join(" + ") || "—";

  function updateClass(index: number, field: keyof PlayerClassEntry, value: string | number) {
    const updated = classes.map((c, i) => {
      if (i !== index) return c;
      const entry = { ...c, [field]: value };
      // Limpiar subclase si el nivel baja de 3
      if (field === "level" && typeof value === "number" && value < 3) {
        entry.subclass = "";
      }
      return entry;
    });
    onChange(updated);
  }

  function addClass() {
    onChange([...classes, { class: "Guerrero", level: 1, subclass: "" }]);
  }

  function removeClass(index: number) {
    onChange(classes.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {classes.map((cls, i) => {
        const subclasses = DND_CLASSES[cls.class] ?? [];
        const showSubclass = cls.level >= 3;

        return (
          <div
            key={i}
            className="grid gap-2 items-center"
            style={{ gridTemplateColumns: "1fr 64px 160px 24px" }}
          >
            {/* Clase */}
            <select
              value={cls.class}
              onChange={e => updateClass(i, "class", e.target.value)}
              className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            >
              {classNames.map(cn => <option key={cn} value={cn}>{cn}</option>)}
            </select>

            {/* Nivel */}
            <input
              type="number"
              min={1}
              max={20}
              value={cls.level}
              onChange={e => updateClass(i, "level", Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-100 text-sm text-center focus:outline-none focus:border-amber-500"
            />

            {/* Subclase */}
            {showSubclass ? (
              <select
                value={cls.subclass}
                onChange={e => updateClass(i, "subclass", e.target.value)}
                className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">— Subclase —</option>
                {[...subclasses, "Homebrew / Otra"].map(sc => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-stone-500 italic px-1">(subclase a nv.3)</p>
            )}

            {/* Botón eliminar — solo si hay más de una clase */}
            {classes.length > 1 ? (
              <button
                onClick={() => removeClass(i)}
                className="text-stone-500 hover:text-red-400 transition-colors text-sm leading-none"
                title="Eliminar clase"
              >
                ✕
              </button>
            ) : (
              <div />
            )}
          </div>
        );
      })}

      {/* Añadir clase */}
      <button
        onClick={addClass}
        className="w-full border border-dashed border-stone-700 rounded py-2 text-xs text-stone-500 hover:text-stone-300 hover:border-stone-500 transition-colors"
      >
        + Añadir clase
      </button>

      {/* Totales */}
      <div className="flex gap-4 border-t border-stone-800 pt-2">
        <span className="text-xs text-stone-400">
          Nivel total: <span className="text-amber-400 font-bold">{level || "—"}</span>
        </span>
        <span className="text-xs text-stone-400">
          Bon. Comp.: <span className="text-amber-400 font-bold">+{pb}</span>
        </span>
        <span className="text-xs text-stone-400">
          Dados de vida: <span className="text-amber-400">{hitDiceStr}</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
cd app/frontend && npx tsc --noEmit 2>&1 | grep ClassesPanel
```

Esperado: sin salida (sin errores).

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/app/players/[id]/ClassesPanel.tsx
git commit -m "feat(ui): ClassesPanel — panel de clases con multiclase expandible"
```

---

## Task 6: HpRollsPanel.tsx — registro de HP por nivel

**Files:**
- Create: `app/frontend/src/app/players/[id]/HpRollsPanel.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client";
import React from "react";
import {
  HpRollEntry,
  PlayerClassEntry,
  calcHpMaxFromRolls,
  abilityModifier,
} from "../../../lib/player-calcs";
import { HIT_DIE_BY_CLASS } from "../../../lib/dnd-2024-data";

interface HpRollsPanelProps {
  hpRolls: HpRollEntry[];
  classes: PlayerClassEntry[];
  conScore: number;
  useAverage: boolean;
  onRollsChange: (rolls: HpRollEntry[]) => void;
  onMethodChange: (useAverage: boolean) => void;
}

export function HpRollsPanel({
  hpRolls,
  classes,
  conScore,
  useAverage,
  onRollsChange,
  onMethodChange,
}: HpRollsPanelProps) {
  // Lista ordenada de hit dice por nivel
  const hitDicePerLevel: number[] = [];
  for (const cls of classes) {
    const hitDie = HIT_DIE_BY_CLASS[cls.class] ?? 8;
    for (let i = 0; i < cls.level; i++) hitDicePerLevel.push(hitDie);
  }

  const conMod = abilityModifier(conScore);
  const hpMax = calcHpMaxFromRolls(hpRolls, classes, conScore, useAverage);

  function getRoll(level: number): HpRollEntry | undefined {
    return hpRolls.find(r => r.level === level);
  }

  function updateRoll(level: number, rawValue: string) {
    const value = parseInt(rawValue) || 1;
    const existing = hpRolls.find(r => r.level === level);
    if (existing) {
      onRollsChange(hpRolls.map(r => r.level === level ? { ...r, value, rolled: true } : r));
    } else {
      onRollsChange([...hpRolls, { level, value, rolled: true }]);
    }
  }

  if (hitDicePerLevel.length === 0) {
    return (
      <p className="text-xs text-stone-500 italic">
        Añade al menos una clase para ver el registro de HP.
      </p>
    );
  }

  // Calcular filas con totales acumulados para mostrar
  let running = 0;
  type Row = { level: number; hitDie: number; method: string; dieDisplay: string; total: number };
  const rows: Row[] = [];

  for (let lvl = 1; lvl <= hitDicePerLevel.length; lvl++) {
    const hitDie = hitDicePerLevel[lvl - 1] ?? 8;
    let dieValue: number;
    let method: string;
    let dieDisplay: string;

    if (lvl === 1) {
      dieValue = hitDie;
      method = "Máximo (auto)";
      dieDisplay = `${hitDie}`;
    } else if (useAverage) {
      dieValue = Math.floor(hitDie / 2) + 1;
      method = `Media d${hitDie}`;
      dieDisplay = `${dieValue}`;
    } else {
      const roll = getRoll(lvl);
      dieValue = roll?.value ?? 0;
      method = `Dado d${hitDie}`;
      dieDisplay = roll ? `${roll.value}` : "—";
    }

    const contribution = Math.max(1, dieValue + conMod);
    running += contribution;
    rows.push({ level: lvl, hitDie, method, dieDisplay, total: running });
  }

  return (
    <div className="space-y-3">
      {/* Toggle método */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-400 mr-1">Método nv.2+:</span>
        {[
          { label: "Media", value: true },
          { label: "Tirar dado", value: false },
        ].map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onMethodChange(opt.value)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              useAverage === opt.value
                ? "bg-stone-700 border border-amber-500 text-amber-400"
                : "bg-stone-800 border border-stone-700 text-stone-500 hover:text-stone-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tabla de niveles */}
      <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-4 px-3 py-1.5 bg-stone-800 text-xs text-stone-500 uppercase tracking-wider">
          <span>Nivel</span>
          <span>Método</span>
          <span>Dado</span>
          <span>Total</span>
        </div>
        {rows.map(row => (
          <div
            key={row.level}
            className="grid grid-cols-4 px-3 py-2 border-t border-stone-800 items-center"
          >
            <span className={row.level === 1 ? "text-amber-400 font-bold text-sm" : "text-stone-400 text-sm"}>
              {row.level}
            </span>
            <span className="text-stone-400 text-xs">{row.method}</span>
            <span>
              {row.level > 1 && !useAverage ? (
                <input
                  type="number"
                  min={1}
                  max={row.hitDie}
                  value={getRoll(row.level)?.value ?? ""}
                  placeholder="—"
                  onChange={e => updateRoll(row.level, e.target.value)}
                  className="w-14 bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-stone-100 text-xs text-center focus:outline-none focus:border-amber-500"
                />
              ) : (
                <span className="text-stone-300 text-sm">{row.dieDisplay}</span>
              )}
            </span>
            <span className="text-stone-100 font-bold text-sm">{row.total}</span>
          </div>
        ))}
      </div>

      {/* HP Máx total */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-stone-400">HP Máx calculado:</span>
        <span className="text-amber-400 font-bold text-xl">{hpMax}</span>
        <span className="text-xs text-stone-500">
          (CON {conMod >= 0 ? "+" : ""}{conMod} por nivel)
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd app/frontend && npx tsc --noEmit 2>&1 | grep HpRollsPanel
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/app/players/[id]/HpRollsPanel.tsx
git commit -m "feat(ui): HpRollsPanel — registro de HP por nivel con toggle media/dado"
```

---

## Task 7: FeatsPanel.tsx — panel de dotes y ASI

**Files:**
- Create: `app/frontend/src/app/players/[id]/FeatsPanel.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client";
import React from "react";
import { FeatEntry, FeatStatBonus, PlayerClassEntry } from "../../../lib/player-calcs";
import { asiLevelsForClass } from "../../../lib/dnd-2024-data";

interface FeatsPanelProps {
  feats: FeatEntry[];
  classes: PlayerClassEntry[];
  onChange: (feats: FeatEntry[]) => void;
}

const STAT_OPTIONS: { value: FeatStatBonus["stat"]; label: string }[] = [
  { value: "strength",     label: "FUE — Fuerza" },
  { value: "dexterity",    label: "DES — Destreza" },
  { value: "constitution", label: "CON — Constitución" },
  { value: "intelligence", label: "INT — Inteligencia" },
  { value: "wisdom",       label: "SAB — Sabiduría" },
  { value: "charisma",     label: "CAR — Carisma" },
];

interface AsiSlot { classIndex: number; className: string; classLevel: number }

function buildAsiSlots(classes: PlayerClassEntry[]): AsiSlot[] {
  const slots: AsiSlot[] = [];
  for (let ci = 0; ci < classes.length; ci++) {
    const cls = classes[ci];
    const asiLevels = asiLevelsForClass(cls.class);
    for (const asiLvl of asiLevels) {
      if (asiLvl <= cls.level) {
        slots.push({ classIndex: ci, className: cls.class, classLevel: asiLvl });
      }
    }
  }
  // Ordenar: primero por classIndex, luego por classLevel
  return slots.sort((a, b) =>
    a.classIndex !== b.classIndex ? a.classIndex - b.classIndex : a.classLevel - b.classLevel
  );
}

export function FeatsPanel({ feats, classes, onChange }: FeatsPanelProps) {
  const slots = buildAsiSlots(classes);

  function getFeat(classIndex: number, classLevel: number): FeatEntry | undefined {
    return feats.find(f => f.classIndex === classIndex && f.level === classLevel);
  }

  function ensureFeat(classIndex: number, classLevel: number): FeatEntry {
    const existing = getFeat(classIndex, classLevel);
    if (existing) return existing;
    return { name: "", classIndex, level: classLevel, statBonuses: [] };
  }

  function upsertFeat(updated: FeatEntry) {
    const exists = feats.some(f => f.classIndex === updated.classIndex && f.level === updated.level);
    if (exists) {
      onChange(feats.map(f =>
        f.classIndex === updated.classIndex && f.level === updated.level ? updated : f
      ));
    } else {
      onChange([...feats, updated]);
    }
  }

  function setFeatName(classIndex: number, classLevel: number, name: string) {
    upsertFeat({ ...ensureFeat(classIndex, classLevel), name });
  }

  function addStatBonus(classIndex: number, classLevel: number) {
    const feat = ensureFeat(classIndex, classLevel);
    upsertFeat({
      ...feat,
      statBonuses: [...feat.statBonuses, { stat: "strength", value: 1 }],
    });
  }

  function updateStatBonus(
    classIndex: number,
    classLevel: number,
    bi: number,
    patch: Partial<FeatStatBonus>
  ) {
    const feat = ensureFeat(classIndex, classLevel);
    upsertFeat({
      ...feat,
      statBonuses: feat.statBonuses.map((b, idx) => idx === bi ? { ...b, ...patch } : b),
    });
  }

  function removeStatBonus(classIndex: number, classLevel: number, bi: number) {
    const feat = ensureFeat(classIndex, classLevel);
    upsertFeat({
      ...feat,
      statBonuses: feat.statBonuses.filter((_, idx) => idx !== bi),
    });
  }

  if (slots.length === 0) {
    return (
      <p className="text-xs text-stone-500 italic">
        Los slots de dote aparecen al alcanzar nivel 4 en cualquier clase.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {slots.map(slot => {
        const feat = getFeat(slot.classIndex, slot.classLevel);
        const key = `${slot.classIndex}-${slot.classLevel}`;

        return (
          <div key={key} className="bg-stone-900 border border-stone-800 rounded-lg p-3 space-y-2">
            {/* Cabecera del slot */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-500 shrink-0">
                {slot.className} nv.{slot.classLevel}
              </span>
              <input
                type="text"
                placeholder="Nombre de la dote o Mejora de Característica..."
                value={feat?.name ?? ""}
                onChange={e => setFeatName(slot.classIndex, slot.classLevel, e.target.value)}
                className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Bonos de stat */}
            {feat?.statBonuses.map((bonus, bi) => (
              <div key={bi} className="flex items-center gap-2 pl-4">
                <select
                  value={bonus.value}
                  onChange={e => updateStatBonus(slot.classIndex, slot.classLevel, bi, { value: parseInt(e.target.value) as 1 | 2 })}
                  className="w-14 bg-stone-800 border border-stone-700 rounded px-1 py-1 text-stone-100 text-xs"
                >
                  <option value={1}>+1</option>
                  <option value={2}>+2</option>
                </select>
                <select
                  value={bonus.stat}
                  onChange={e => updateStatBonus(slot.classIndex, slot.classLevel, bi, { stat: e.target.value as FeatStatBonus["stat"] })}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs"
                >
                  {STAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button
                  onClick={() => removeStatBonus(slot.classIndex, slot.classLevel, bi)}
                  className="text-stone-500 hover:text-red-400 text-xs transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Añadir bono */}
            <button
              onClick={() => addStatBonus(slot.classIndex, slot.classLevel)}
              className="pl-4 text-xs text-stone-500 hover:text-stone-300 transition-colors"
            >
              + Bono de característica
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd app/frontend && npx tsc --noEmit 2>&1 | grep FeatsPanel
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/app/players/[id]/FeatsPanel.tsx
git commit -m "feat(ui): FeatsPanel — dotes y ASI con bonos de característica"
```

---

## Task 8: page.tsx — integrar los tres paneles

**Files:**
- Modify: `app/frontend/src/app/players/[id]/page.tsx`

- [ ] **Step 1: Actualizar los imports al inicio del archivo**

Reemplaza el bloque de imports (líneas 1-25) con:

```typescript
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Shield, Heart, Star, Zap, ChevronLeft, Save, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { AppShell } from "../../../components/layout/AppShell";
import { api } from "../../../lib/api";
import {
  DND_CLASSES,
  DND_SPECIES,
  DND_SPECIES_VARIANTS,
  DND_BACKGROUNDS,
  DND_ALIGNMENTS,
  SPELLCASTING_ABILITY_BY_CLASS,
  HIT_DIE_BY_CLASS,
} from "../../../lib/dnd-2024-data";
import {
  abilityModifier,
  proficiencyBonus,
  calcPassivePerception,
  calcSpellSaveDC,
  calcSpellAttackBonus,
  totalLevel,
  finalAbilityScore,
  calcHpMaxFromRolls,
  calcAC,
  type PlayerClassEntry,
  type HpRollEntry,
  type FeatEntry,
} from "../../../lib/player-calcs";
import { ClassesPanel } from "./ClassesPanel";
import { HpRollsPanel } from "./HpRollsPanel";
import { FeatsPanel } from "./FeatsPanel";
```

- [ ] **Step 2: Actualizar la función AbilityBox para mostrar bonos de dotes**

Reemplaza la función `AbilityBox` (líneas 141-159):

```typescript
function AbilityBox({ ability, value, featBonus = 0, onChange }: {
  ability: typeof ABILITIES[number];
  value: number | null | undefined;
  featBonus?: number;
  onChange: (v: number | null) => void;
}) {
  const baseScore = value ?? 10;
  const finalScore = Math.min(30, Math.max(1, baseScore + featBonus));
  const m = abilityModifier(finalScore);
  const modStr = m >= 0 ? `+${m}` : `${m}`;
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 text-center">
      <p className="text-xs text-amber-500 font-bold uppercase mb-1">{ability.label}</p>
      <p className="text-2xl font-bold text-stone-100 mb-1">{modStr}</p>
      <input
        type="number"
        value={value ?? ""}
        min={1} max={30}
        onChange={e => onChange(e.target.value === "" ? null : parseInt(e.target.value))}
        className="w-full bg-stone-900 border border-stone-600 rounded px-1 py-0.5 text-stone-300 text-sm text-center focus:outline-none focus:border-amber-500"
        placeholder="—"
      />
      {featBonus !== 0 && (
        <p className="text-xs text-stone-500 mt-0.5">{baseScore} + {featBonus} = {finalScore}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Actualizar los valores derivados en CharacterSheetContent**

Reemplaza el bloque de valores derivados (líneas 205-228) con:

```typescript
  // ── Parsear campos JSON ──────────────────────────────────────────────────────
  const classes: PlayerClassEntry[] = parseJson(form.classes ?? "[]", []);
  const hpRolls: HpRollEntry[]      = parseJson(form.hpRolls ?? "[]", []);
  const feats: FeatEntry[]          = parseJson(form.feats ?? "[]", []);

  // Nivel total y proficiency bonus desde clases
  const level = totalLevel(classes) || 1;
  const pb = proficiencyBonus(level);

  // Puntuaciones finales de característica (base + bonos de dotes)
  const finalStr = finalAbilityScore(form.strength    ?? 10, "strength",     feats);
  const finalDex = finalAbilityScore(form.dexterity   ?? 10, "dexterity",    feats);
  const finalCon = finalAbilityScore(form.constitution ?? 10, "constitution", feats);
  const finalInt = finalAbilityScore(form.intelligence ?? 10, "intelligence", feats);
  const finalWis = finalAbilityScore(form.wisdom       ?? 10, "wisdom",       feats);
  const finalCha = finalAbilityScore(form.charisma     ?? 10, "charisma",     feats);

  // Feat bonuses por stat (para pasarlos a AbilityBox)
  const featBonuses: Record<string, number> = {
    strength:     finalStr - (form.strength     ?? 10),
    dexterity:    finalDex - (form.dexterity    ?? 10),
    constitution: finalCon - (form.constitution ?? 10),
    intelligence: finalInt - (form.intelligence ?? 10),
    wisdom:       finalWis - (form.wisdom        ?? 10),
    charisma:     finalCha - (form.charisma      ?? 10),
  };

  // CA automática
  const calcedAC = calcAC(
    form.equippedArmor ?? null,
    finalDex,
    form.shield ?? false,
    finalCon,
    finalWis,
  );

  // HP Máx automático
  const calcedHpMax = calcHpMaxFromRolls(hpRolls, classes, finalCon, form.hpUseAverage ?? true);

  const skillProfs: string[] = parseJson(form.skillProficiencies ?? "[]", []);
  const skillExpert: string[] = parseJson(form.skillExpertise ?? "[]", []);
  const saveProfs: string[] = parseJson(form.savingThrows ?? "[]", []);

  const hasPerceptionProf = skillProfs.includes("Perception");
  const hasPerceptionExp  = skillExpert.includes("Perception");
  const calcPassivePerc = calcPassivePerception(finalWis, level, hasPerceptionProf, hasPerceptionExp);

  const spellAbilityKey = form.spellcastingAbility as "wisdom" | "intelligence" | "charisma" | "" | null;
  const spellAbilityScore =
    spellAbilityKey === "wisdom"       ? finalWis :
    spellAbilityKey === "intelligence" ? finalInt :
    spellAbilityKey === "charisma"     ? finalCha :
    null;
  const calcDC     = spellAbilityScore !== null ? calcSpellSaveDC(spellAbilityScore, level)     : null;
  const calcAttack = spellAbilityScore !== null ? calcSpellAttackBonus(spellAbilityScore, level) : null;

  const initiativeSug = abilityModifier(finalDex);

  // Especie + linaje
  const raceStr: string = form.race ?? "";
  const raceMatch = raceStr.match(/^(.+?) \((.+)\)$/);
  const currentSpecies = raceMatch ? raceMatch[1] : raceStr;
  const currentVariant = raceMatch ? raceMatch[2] : "";
  const speciesVariants = currentSpecies && Object.prototype.hasOwnProperty.call(DND_SPECIES_VARIANTS, currentSpecies)
    ? DND_SPECIES_VARIANTS[currentSpecies] ?? []
    : [];

  function setSpecies(species: string) { set("race", species); }
  function setVariant(variant: string) {
    set("race", variant ? `${currentSpecies} (${variant})` : currentSpecies);
  }
```

Elimina también las líneas antiguas de `hpMaxSug` e `initiativeSug` (si quedaron del bloque anterior) ya que `calcedHpMax` las reemplaza.

- [ ] **Step 4: Actualizar handleSave para calcular y persistir valores derivados**

Reemplaza la función `handleSave` (líneas 193-203):

```typescript
  async function handleSave() {
    setSaving(true);
    try {
      // Recalcular valores derivados antes de guardar
      const cls: PlayerClassEntry[] = parseJson(form.classes ?? "[]", []);
      const rolls: HpRollEntry[]    = parseJson(form.hpRolls ?? "[]", []);
      const fts: FeatEntry[]        = parseJson(form.feats ?? "[]", []);

      const fDex = finalAbilityScore(form.dexterity    ?? 10, "dexterity",    fts);
      const fCon = finalAbilityScore(form.constitution ?? 10, "constitution", fts);
      const fWis = finalAbilityScore(form.wisdom        ?? 10, "wisdom",       fts);

      const ac    = calcAC(form.equippedArmor ?? null, fDex, form.shield ?? false, fCon, fWis);
      const hpMax = calcHpMaxFromRolls(rolls, cls, fCon, form.hpUseAverage ?? true);
      const lvl   = totalLevel(cls) || 1;
      const pb    = proficiencyBonus(lvl);
      const hitDice = cls.map(c => `${c.level}d${HIT_DIE_BY_CLASS[c.class] ?? 8}`).join(" + ");

      // Mantener class/level/subclass legacy sincronizados con la primera clase
      const firstClass = cls[0];

      await api.players.update(params.id, {
        ...form,
        ac,
        hpMax,
        level:            lvl,
        proficiencyBonus: pb,
        hitDice:          hitDice || null,
        class:            firstClass?.class   ?? null,
        subclass:         firstClass?.subclass ?? null,
      });
      await mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }
```

- [ ] **Step 5: Actualizar el header subtitle y la barra de stats rápidos**

Localiza el header (línea ~307) y reemplaza el subtítulo:

```typescript
              <p className="text-xs text-stone-500">
                {classes.length > 0
                  ? classes.map(c => `${c.class} ${c.level}`).join(" / ")
                  : (form.class ?? "Sin clase")} · Nivel {level} · {form.race}
              </p>
```

En la barra de stats rápidos (línea ~329), actualiza los valores calculados:

```typescript
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: <Heart size={14} className="text-red-400" />, label: "HP", value: `${form.hp ?? "—"}/${calcedHpMax}`, sub: form.hpTemp ? `+${form.hpTemp} temp` : null },
            { icon: <Shield size={14} className="text-blue-400" />, label: "CA", value: calcedAC },
            { icon: <Zap size={14} className="text-yellow-400" />, label: "Iniciativa", value: form.initiative != null ? (form.initiative >= 0 ? `+${form.initiative}` : form.initiative) : (initiativeSug >= 0 ? `+${initiativeSug}` : initiativeSug) },
            { icon: <Star size={14} className="text-amber-400" />, label: "Prof. Bonus", value: `+${pb}` },
          ].map(s => (
```

- [ ] **Step 6: Reemplazar la sección "Información básica" del tab core**

Localiza la sección `Información básica` (línea ~363) que contiene los campos Clase/Nivel/Subclase. Reemplázala con:

```tsx
            <SectionTitle>Clases</SectionTitle>
            <ClassesPanel
              classes={classes.length > 0 ? classes : [{ class: form.class ?? "Guerrero", level: form.level ?? 1, subclass: form.subclass ?? "" }]}
              onChange={updated => {
                set("classes", JSON.stringify(updated));
                // Auto-sugerir característica de conjuro si es vacía y hay una sola clase
                if (updated.length === 1 && !form.spellcastingAbility) {
                  const suggested = SPELLCASTING_ABILITY_BY_CLASS[updated[0].class] ?? null;
                  if (suggested) set("spellcastingAbility", suggested);
                }
              }}
            />

            <SectionTitle>Información básica</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre"><Input value={form.name} onChange={v => set("name", v)} /></Field>
              <Field label="Jugador"><Input value={form.playerName} onChange={v => set("playerName", v)} /></Field>
              <Field label="Especie">
                <Select value={currentSpecies} onChange={setSpecies} options={[...DND_SPECIES, "Otra (homebrew)"]} placeholder="Selecciona especie..." />
              </Field>
              {speciesVariants.length > 0 ? (
                <Field label={SPECIES_VARIANT_LABEL[currentSpecies] ?? "Linaje"}>
                  <Select value={currentVariant} onChange={setVariant} options={speciesVariants} placeholder={`Selecciona...`} />
                </Field>
              ) : (
                <Field label="Trasfondo">
                  <Select value={form.background} onChange={v => set("background", v)} options={[...DND_BACKGROUNDS, "Otro (homebrew)"]} placeholder="Selecciona trasfondo..." />
                </Field>
              )}
              {speciesVariants.length > 0 && (
                <Field label="Trasfondo">
                  <Select value={form.background} onChange={v => set("background", v)} options={[...DND_BACKGROUNDS, "Otro (homebrew)"]} placeholder="Selecciona trasfondo..." />
                </Field>
              )}
              <Field label="Alineamiento">
                <Select value={form.alignment} onChange={v => set("alignment", v)} options={DND_ALIGNMENTS} placeholder="Selecciona alineamiento..." />
              </Field>
              <Field label="Puntos de experiencia">
                <NumberInput value={form.experiencePoints} onChange={v => set("experiencePoints", v)} min={0} />
              </Field>
            </div>
```

Nota: `SPECIES_VARIANT_LABEL` sigue definido dentro de `CharacterSheetContent` (línea ~267 del original). No lo muevas; la referencia en este JSX funciona igual.

- [ ] **Step 7: Reemplazar la sección "Combate" para usar los nuevos paneles**

Localiza la sección `Combate` (línea ~465). Reemplaza HP máx y CA con los nuevos paneles:

```tsx
            <SectionTitle>HP por nivel</SectionTitle>
            <HpRollsPanel
              hpRolls={hpRolls}
              classes={classes}
              conScore={form.constitution ?? 10}
              useAverage={form.hpUseAverage ?? true}
              onRollsChange={rolls => set("hpRolls", JSON.stringify(rolls))}
              onMethodChange={useAvg => set("hpUseAverage", useAvg)}
            />

            <SectionTitle>Clase de armadura</SectionTitle>
            <div className="space-y-3">
              <select
                value={form.equippedArmor ?? "none"}
                onChange={e => set("equippedArmor", e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              >
                <optgroup label="SIN ARMADURA">
                  <option value="none">Sin armadura (10 + DES)</option>
                  <option value="unarmoredBarbarian">Defensa sin armadura — Bárbaro (10+DES+CON)</option>
                  <option value="unarmoredMonk">Defensa sin armadura — Monje (10+DES+SAB)</option>
                </optgroup>
                <optgroup label="LIGERA">
                  <option value="leather">Cuero (CA 11 + DES)</option>
                  <option value="studdedLeather">Cuero tachonado (CA 12 + DES)</option>
                </optgroup>
                <optgroup label="MEDIA">
                  <option value="hide">Pieles (CA 12 + DES máx.+2)</option>
                  <option value="chainShirt">Cota de mallas ligera (CA 13 + DES máx.+2)</option>
                  <option value="scaleMail">Cota de escamas (CA 14 + DES máx.+2)</option>
                  <option value="breastplate">Coraza (CA 14 + DES máx.+2)</option>
                  <option value="halfPlate">Medio arnés (CA 15 + DES máx.+2)</option>
                </optgroup>
                <optgroup label="PESADA">
                  <option value="ringMail">Cota de anillas (CA 14)</option>
                  <option value="chainMail">Cota de mallas (CA 16)</option>
                  <option value="splint">Armadura de bandas (CA 17)</option>
                  <option value="plate">Armadura de placas (CA 18)</option>
                </optgroup>
              </select>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.shield ?? false}
                    onChange={e => set("shield", e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  Escudo equipado <span className="text-emerald-400 text-xs">(+2 CA)</span>
                </label>
                <div className="text-center bg-stone-900 border border-stone-800 rounded-lg px-5 py-2">
                  <p className="text-xs text-stone-500 mb-0.5">CA</p>
                  <p className="text-2xl font-bold text-amber-400">{calcedAC}</p>
                </div>
              </div>
            </div>

            <SectionTitle>Combate</SectionTitle>
            <div className="grid grid-cols-4 gap-4">
              <Field label="HP máx (calculado)">
                <div className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-amber-400 font-bold text-center">
                  {calcedHpMax}
                </div>
              </Field>
              <Field label="HP actual"><NumberInput value={form.hp} onChange={v => set("hp", v)} /></Field>
              <Field label="HP temporal"><NumberInput value={form.hpTemp} onChange={v => set("hpTemp", v)} /></Field>
              <Field label="Velocidad"><NumberInput value={form.speed} onChange={v => set("speed", v)} /></Field>
              <Field label="Iniciativa">
                <NumberInput value={form.initiative} onChange={v => set("initiative", v)} />
                <p className="text-xs text-stone-500 mt-0.5">
                  Base DES: {initiativeSug >= 0 ? `+${initiativeSug}` : initiativeSug}
                </p>
              </Field>
              <Field label="Percepción pasiva">
                <NumberInput value={form.passivePerception} onChange={v => set("passivePerception", v)} />
                <p className="text-xs text-stone-500 mt-0.5">
                  Calculado: {calcPassivePerc}
                  {hasPerceptionExp ? " (SAB + exp.)" : hasPerceptionProf ? " (SAB + comp.)" : " (10 + SAB)"}
                </p>
              </Field>
              <Field label="Dados de vida (auto)">
                <div className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-400 text-sm text-center">
                  {classes.map(c => `${c.level}d${HIT_DIE_BY_CLASS[c.class] ?? 8}`).join(" + ") || "—"}
                </div>
              </Field>
            </div>
```

- [ ] **Step 8: Añadir la sección "Dotes" al tab core (después de Combate)**

Añade la sección de dotes justo antes de la sección "Conjuros":

```tsx
            <SectionTitle>Dotes y mejoras de característica</SectionTitle>
            <FeatsPanel
              feats={feats}
              classes={classes}
              onChange={updated => set("feats", JSON.stringify(updated))}
            />
```

- [ ] **Step 9: Actualizar el tab "abilities" para pasar featBonus a cada AbilityBox**

Localiza el grid de AbilityBox en el tab "abilities". Añade `featBonus` a cada instancia:

```tsx
            <div className="grid grid-cols-3 gap-3">
              {ABILITIES.map(ability => (
                <AbilityBox
                  key={ability.key}
                  ability={ability}
                  value={form[ability.key]}
                  featBonus={featBonuses[ability.key] ?? 0}
                  onChange={v => set(ability.key, v)}
                />
              ))}
            </div>
```

- [ ] **Step 10: Verificar TypeScript y eliminar imports no usados**

```bash
cd app/frontend && npx tsc --noEmit 2>&1 | head -30
```

Corrige cualquier error de tipos. Si `calcHpMaxSuggestion` ya no se usa, elimínalo del import.

- [ ] **Step 11: Ejecutar los tests**

```bash
cd app/frontend && pnpm test
```

Esperado: todos los tests pasan (funciones puras no se han roto).

- [ ] **Step 12: Commit**

```bash
git add app/frontend/src/app/players/[id]/page.tsx
git commit -m "feat(ui): integrar ClassesPanel, HpRollsPanel, FeatsPanel y CA selector en ficha de jugador"
```

---

## Task 9: Verificación final en el navegador

- [ ] **Step 1: Arrancar el servidor de desarrollo**

```bash
pnpm dev
```

- [ ] **Step 2: Verificar en el navegador (`http://localhost:3000`)**

1. Navega a cualquier campaña → pestaña Jugadores → abre un personaje
2. **Tab Básico**:
   - El panel "Clases" muestra la clase/nivel/subclase del personaje
   - Añade una segunda clase → los totales (nivel, bon. comp., dados de vida) se actualizan
   - El badge "CA" en la barra superior se actualiza al cambiar la armadura
   - El panel "HP por nivel" muestra la tabla de niveles
   - El toggle Media/Tirar dado funciona
   - El panel "Dotes" aparece vacío (los slots aparecen solo desde nivel 4)
3. **Tab Estadísticas**: los AbilityBox muestran el modificador correcto
4. Haz clic en "Guardar" → sin errores en consola
5. Recarga la página → los datos persisten

- [ ] **Step 3: Probar multiclase**

1. En el panel Clases, añade una segunda clase (ej: Pícaro nv.3)
2. Verifica: nivel total = suma, bon. comp. correcto, dados de vida = "5d10 + 3d8" (ejemplo)
3. El panel HP muestra 8 filas (una por nivel)
4. Los niveles 6-8 usan el dado d8 del Pícaro

- [ ] **Step 4: Probar dotes**

1. Sube la primera clase a nivel 4+
2. El panel Dotes muestra el slot ASI de nivel 4
3. Escribe "Alert" como nombre de dote
4. Añade un bono: +1 a DES
5. En el tab Estadísticas, DES muestra "15 + 1 = 16" bajo el input
6. La CA se actualiza automáticamente con el nuevo mod DES
7. Guarda y recarga → el bono persiste

- [ ] **Step 5: Commit final**

```bash
git add .
git commit -m "test(manual): Sprint A verificado en navegador — clases, HP, CA, dotes"
```
