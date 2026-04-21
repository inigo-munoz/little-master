# Sprint B — Campos calculados en ficha de personaje

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir iniciativa, velocidad, percepción pasiva y CD de conjuros en valores calculados automáticamente con desglose visible; añadir confirmación al guardar con toast de error.

**Architecture:** Las fórmulas nuevas van a `player-calcs.ts` (funciones puras, testeables con Vitest). Las constantes de datos (velocidades base por especie, bonos de iniciativa/velocidad por dote) van a `dnd-2024-data.ts`. La UI en `players/[id]/page.tsx` muestra valores calculados en lugar de inputs manuales para iniciativa y percepción pasiva; velocidad mantiene input de override. La sección de conjuros se oculta si ninguna clase tiene lanzamiento de hechizos.

**Tech Stack:** Next.js 15 App Router + TypeScript + Vitest — sin cambios en schema Prisma ni backend.

---

## Scope

Este plan cubre puntos **1, 2, 3, 4 y 8** de la spec. Los puntos 5 (modal dotes), 6 (ASI mejorado) y 7 (trasfondo con bloqueo) se cubrirán en planes separados — el 7 requiere migración Prisma.

---

## Mapa de archivos

| Fichero | Acción | Responsabilidad |
|---------|--------|-----------------|
| `app/frontend/src/lib/dnd-2024-data.ts` | Modificar | Añadir `BASE_SPEED_BY_SPECIES`, `baseSpeedForSpecies`, `INITIATIVE_BONUS_BY_FEAT`, `SPEED_BONUS_BY_FEAT` |
| `app/frontend/src/lib/player-calcs.ts` | Modificar | Añadir `initiativeBonusFromFeats`, `calcInitiative`, `speedBonusFromClasses`, `speedBonusFromFeats`, `calcSpeed` |
| `app/frontend/src/lib/player-calcs.test.ts` | Modificar | Tests TDD para las cinco funciones nuevas |
| `app/frontend/src/app/players/[id]/page.tsx` | Modificar | UI de campos calculados + confirmación guardar |

---

## Task 1: Constantes de datos en dnd-2024-data.ts

**Files:**
- Modify: `app/frontend/src/lib/dnd-2024-data.ts`

Las claves de nombre de dote son el nombre en inglés tal como lo escribe el jugador en `FeatsPanel` (texto libre). Eso es consistente con el comportamiento actual de `FeatEntry.name`.

- [ ] **Step 1: Añadir las constantes al final del fichero**

Al final de `app/frontend/src/lib/dnd-2024-data.ts`, tras `asiLevelsForClass`:

```typescript
// Velocidad base por especie (PHB 2024)
export const BASE_SPEED_BY_SPECIES: Record<string, number> = {
  "Aasimar":   30,
  "Dracónido": 30,
  "Enano":     25,
  "Elfo":      30,
  "Gnomo":     25,
  "Goliath":   35,
  "Mediano":   25,
  "Humano":    30,
  "Orco":      30,
  "Tiefling":  30,
};

export const DEFAULT_SPEED = 30;

export function baseSpeedForSpecies(species: string): number {
  return BASE_SPEED_BY_SPECIES[species] ?? DEFAULT_SPEED;
}

// Dotes que modifican la iniciativa (nombre en inglés → bonus)
export const INITIATIVE_BONUS_BY_FEAT: Record<string, number> = {
  "Alert": 5,
};

// Dotes que modifican la velocidad (nombre en inglés → bonus en ft)
export const SPEED_BONUS_BY_FEAT: Record<string, number> = {
  "Mobile": 10,
};
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "error TS" | head -5
```

Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/lib/dnd-2024-data.ts
git commit -m "feat(data): BASE_SPEED_BY_SPECIES, INITIATIVE_BONUS_BY_FEAT, SPEED_BONUS_BY_FEAT"
```

---

## Task 2: Funciones puras en player-calcs.ts (TDD)

**Files:**
- Modify: `app/frontend/src/lib/player-calcs.test.ts`
- Modify: `app/frontend/src/lib/player-calcs.ts`

- [ ] **Step 1: Actualizar el import en el fichero de tests**

Al inicio de `app/frontend/src/lib/player-calcs.test.ts`, reemplazar el bloque `import` existente por:

```typescript
import { describe, it, expect } from "vitest";
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
  initiativeBonusFromFeats,
  calcInitiative,
  speedBonusFromClasses,
  speedBonusFromFeats,
  calcSpeed,
  type PlayerClassEntry,
  type HpRollEntry,
  type FeatEntry,
} from "./player-calcs";
```

- [ ] **Step 2: Añadir los tests al final del fichero de tests**

```typescript
// ─── initiativeBonusFromFeats ────────────────────────────────────────────────

describe("initiativeBonusFromFeats", () => {
  it("sin dotes → 0", () =>
    expect(initiativeBonusFromFeats([])).toBe(0));

  it("dote Alert → +5", () =>
    expect(initiativeBonusFromFeats([
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(5));

  it("dote sin bonus de iniciativa → 0", () =>
    expect(initiativeBonusFromFeats([
      { name: "Tough", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(0));

  it("dos dotes Alert → suma", () =>
    expect(initiativeBonusFromFeats([
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [] },
      { name: "Alert", classIndex: 0, level: 8, statBonuses: [] },
    ])).toBe(10));
});

// ─── calcInitiative ──────────────────────────────────────────────────────────

describe("calcInitiative", () => {
  it("DES 10, sin dotes → 0", () =>
    expect(calcInitiative(10, [])).toBe(0));

  it("DES 14 (+2), sin dotes → 2", () =>
    expect(calcInitiative(14, [])).toBe(2));

  it("DES 8 (-1), sin dotes → -1", () =>
    expect(calcInitiative(8, [])).toBe(-1));

  it("DES 14 (+2), Alert (+5) → 7", () =>
    expect(calcInitiative(14, [
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(7));
});

// ─── speedBonusFromClasses ───────────────────────────────────────────────────

describe("speedBonusFromClasses", () => {
  it("sin clases → 0", () =>
    expect(speedBonusFromClasses([])).toBe(0));

  it("Guerrero nivel 10 → 0 (sin bonus de velocidad)", () =>
    expect(speedBonusFromClasses([{ class: "Guerrero", level: 10, subclass: "" }])).toBe(0));

  it("Bárbaro nivel 4 → 0 (necesita nv.5)", () =>
    expect(speedBonusFromClasses([{ class: "Bárbaro", level: 4, subclass: "" }])).toBe(0));

  it("Bárbaro nivel 5 → +10", () =>
    expect(speedBonusFromClasses([{ class: "Bárbaro", level: 5, subclass: "" }])).toBe(10));

  it("Monje nivel 1 → 0 (necesita nv.2)", () =>
    expect(speedBonusFromClasses([{ class: "Monje", level: 1, subclass: "" }])).toBe(0));

  it("Monje nivel 2 → +10", () =>
    expect(speedBonusFromClasses([{ class: "Monje", level: 2, subclass: "" }])).toBe(10));

  it("Bárbaro nv.5 + Monje nv.2 → +20 (se acumulan)", () =>
    expect(speedBonusFromClasses([
      { class: "Bárbaro", level: 5, subclass: "" },
      { class: "Monje",   level: 2, subclass: "" },
    ])).toBe(20));
});

// ─── speedBonusFromFeats ─────────────────────────────────────────────────────

describe("speedBonusFromFeats", () => {
  it("sin dotes → 0", () =>
    expect(speedBonusFromFeats([])).toBe(0));

  it("dote Mobile → +10", () =>
    expect(speedBonusFromFeats([
      { name: "Mobile", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(10));

  it("dote Alert (no da velocidad) → 0", () =>
    expect(speedBonusFromFeats([
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(0));
});

// ─── calcSpeed ───────────────────────────────────────────────────────────────

describe("calcSpeed", () => {
  it("Humano sin bonificaciones → 30", () =>
    expect(calcSpeed("Humano", [], [])).toBe(30));

  it("Enano sin bonificaciones → 25", () =>
    expect(calcSpeed("Enano", [], [])).toBe(25));

  it("Goliath sin bonificaciones → 35", () =>
    expect(calcSpeed("Goliath", [], [])).toBe(35));

  it("especie desconocida → 30 (default)", () =>
    expect(calcSpeed("Otra", [], [])).toBe(30));

  it("Humano con Monje nv.2 → 40", () =>
    expect(calcSpeed("Humano", [{ class: "Monje", level: 2, subclass: "" }], [])).toBe(40));

  it("Enano con Mobile → 35", () =>
    expect(calcSpeed("Enano", [], [
      { name: "Mobile", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(35));

  it("Enano, Bárbaro nv.5, Mobile → 45", () =>
    expect(calcSpeed("Enano", [{ class: "Bárbaro", level: 5, subclass: "" }], [
      { name: "Mobile", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(45));
});
```

- [ ] **Step 3: Ejecutar los tests — verificar que fallan**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test 2>&1 | tail -10
```

Esperado: FAIL con "is not a function" para las funciones nuevas.

- [ ] **Step 4: Actualizar el import al inicio de player-calcs.ts**

Reemplazar:

```typescript
import { HIT_DIE_BY_CLASS, ARMOR_LIST, type ArmorKey } from "./dnd-2024-data";
```

Por:

```typescript
import {
  HIT_DIE_BY_CLASS,
  ARMOR_LIST,
  INITIATIVE_BONUS_BY_FEAT,
  SPEED_BONUS_BY_FEAT,
  baseSpeedForSpecies,
  type ArmorKey,
} from "./dnd-2024-data";
```

- [ ] **Step 5: Añadir las cinco funciones al final de player-calcs.ts**

```typescript
// ─── Sprint B: iniciativa y velocidad calculadas ──────────────────────────────

export function initiativeBonusFromFeats(feats: FeatEntry[]): number {
  return feats.reduce((sum, feat) => sum + (INITIATIVE_BONUS_BY_FEAT[feat.name] ?? 0), 0);
}

export function calcInitiative(dexScore: number, feats: FeatEntry[]): number {
  return abilityModifier(dexScore) + initiativeBonusFromFeats(feats);
}

export function speedBonusFromClasses(classes: PlayerClassEntry[]): number {
  return classes.reduce((sum, cls) => {
    if (cls.class === "Monje"    && cls.level >= 2) return sum + 10;
    if (cls.class === "Bárbaro" && cls.level >= 5) return sum + 10;
    return sum;
  }, 0);
}

export function speedBonusFromFeats(feats: FeatEntry[]): number {
  return feats.reduce((sum, feat) => sum + (SPEED_BONUS_BY_FEAT[feat.name] ?? 0), 0);
}

export function calcSpeed(
  species: string,
  classes: PlayerClassEntry[],
  feats: FeatEntry[]
): number {
  return baseSpeedForSpecies(species) + speedBonusFromClasses(classes) + speedBonusFromFeats(feats);
}
```

- [ ] **Step 6: Ejecutar los tests — verificar que pasan**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test 2>&1 | tail -10
```

Esperado: todos los tests pasan (108+).

- [ ] **Step 7: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/lib/player-calcs.ts app/frontend/src/lib/player-calcs.test.ts
git commit -m "feat(calcs): initiativeBonusFromFeats, calcInitiative, speedBonusFromClasses, speedBonusFromFeats, calcSpeed + tests"
```

---

## Task 3: Iniciativa calculada en page.tsx

**Files:**
- Modify: `app/frontend/src/app/players/[id]/page.tsx`

La iniciativa pasa de input editable a valor calculado. La barra de stats siempre muestra el valor calculado. `handleSave` guarda `initiative: calcedInitiative`.

- [ ] **Step 1: Actualizar los imports de player-calcs y dnd-2024-data**

Reemplazar el bloque de imports de `player-calcs` existente:

```typescript
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
```

Por:

```typescript
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
  initiativeBonusFromFeats,
  calcInitiative,
  speedBonusFromClasses,
  speedBonusFromFeats,
  calcSpeed,
  type PlayerClassEntry,
  type HpRollEntry,
  type FeatEntry,
} from "../../../lib/player-calcs";
```

Reemplazar el bloque de imports de `dnd-2024-data` existente:

```typescript
import {
  DND_CLASSES,
  DND_SPECIES,
  DND_SPECIES_VARIANTS,
  DND_BACKGROUNDS,
  DND_ALIGNMENTS,
  SPELLCASTING_ABILITY_BY_CLASS,
  HIT_DIE_BY_CLASS,
} from "../../../lib/dnd-2024-data";
```

Por:

```typescript
import {
  DND_CLASSES,
  DND_SPECIES,
  DND_SPECIES_VARIANTS,
  DND_BACKGROUNDS,
  DND_ALIGNMENTS,
  SPELLCASTING_ABILITY_BY_CLASS,
  HIT_DIE_BY_CLASS,
  baseSpeedForSpecies,
} from "../../../lib/dnd-2024-data";
```

- [ ] **Step 2: Reemplazar initiativeSug por calcedInitiative y añadir calcedSpeed**

Localizar:

```typescript
  const initiativeSug = abilityModifier(finalDex);
```

Reemplazar por:

```typescript
  const initiativeBonus  = initiativeBonusFromFeats(feats);
  const calcedInitiative = calcInitiative(finalDex, feats);
  const calcedSpeed      = calcSpeed(currentSpecies, classes, feats);
```

(Nota: `currentSpecies` ya está calculado más arriba en la misma función, usando `raceStr.match`.)

- [ ] **Step 3: Actualizar la barra de stats rápidos**

Localizar:

```typescript
            { icon: <Zap size={14} className="text-yellow-400" />, label: "Iniciativa", value: form.initiative != null ? (form.initiative >= 0 ? `+${form.initiative}` : form.initiative) : (initiativeSug >= 0 ? `+${initiativeSug}` : initiativeSug) },
```

Reemplazar por:

```typescript
            { icon: <Zap size={14} className="text-yellow-400" />, label: "Iniciativa", value: calcedInitiative >= 0 ? `+${calcedInitiative}` : `${calcedInitiative}` },
```

- [ ] **Step 4: Reemplazar el campo Iniciativa en la sección Combate**

Localizar:

```typescript
              <Field label="Iniciativa">
                <NumberInput value={form.initiative} onChange={v => set("initiative", v)} />
                <p className="text-xs text-stone-500 mt-0.5">
                  Base DES: {initiativeSug >= 0 ? `+${initiativeSug}` : initiativeSug}
                </p>
              </Field>
```

Reemplazar por:

```typescript
              <Field label="Iniciativa">
                <div
                  className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                  title={`DES ${abilityModifier(finalDex) >= 0 ? "+" : ""}${abilityModifier(finalDex)}${initiativeBonus !== 0 ? ` + dotes (${initiativeBonus >= 0 ? "+" : ""}${initiativeBonus})` : ""}`}
                >
                  <span className="text-amber-400 font-bold text-base">
                    {calcedInitiative >= 0 ? `+${calcedInitiative}` : calcedInitiative}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  DES {abilityModifier(finalDex) >= 0 ? "+" : ""}{abilityModifier(finalDex)}
                  {initiativeBonus !== 0 && ` + dotes ${initiativeBonus >= 0 ? "+" : ""}${initiativeBonus}`}
                </p>
              </Field>
```

- [ ] **Step 5: Añadir initiative al handleSave**

Dentro de `handleSave`, localizar el bloque que calcula `pb` y `hitDice`:

```typescript
      const pb    = proficiencyBonus(lvl);
      const hitDice = cls.map(c => `${c.level}d${HIT_DIE_BY_CLASS[c.class] ?? 8}`).join(" + ");
```

Añadir inmediatamente después (`fDex` y `fts` ya existen más arriba en handleSave):

```typescript
      const initiative = calcInitiative(fDex, fts);
```

Y añadir `initiative` al objeto de update:

```typescript
      await api.players.update(params.id, {
        ...form,
        ac,
        hpMax,
        initiative,
        level:            lvl,
        proficiencyBonus: pb,
        hitDice:          hitDice || undefined,
        class:            firstClass?.class   ?? undefined,
        subclass:         firstClass?.subclass ?? undefined,
      });
```

- [ ] **Step 6: Verificar typecheck**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "error TS" | head -10
```

Esperado: 0 errores.

- [ ] **Step 7: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/app/players/[id]/page.tsx
git commit -m "feat(ui): iniciativa calculada automáticamente — DES + bonus de dotes"
```

---

## Task 4: Velocidad calculada con override en page.tsx

**Files:**
- Modify: `app/frontend/src/app/players/[id]/page.tsx`

La velocidad muestra el valor calculado prominentemente. El input existente pasa a ser override opcional para condiciones especiales. En `handleSave`: si `form.speed != null`, se usa ese valor; si no, se usa el calculado.

- [ ] **Step 1: Reemplazar el campo Velocidad en la sección Combate**

Localizar:

```typescript
              <Field label="Velocidad"><NumberInput value={form.speed} onChange={v => set("speed", v)} /></Field>
```

Reemplazar por:

```typescript
              <Field label="Velocidad">
                <div
                  className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                  title={`Base especie: ${baseSpeedForSpecies(currentSpecies)} ft · Clase: +${speedBonusFromClasses(classes)} ft · Dotes: +${speedBonusFromFeats(feats)} ft`}
                >
                  <span className="text-amber-400 font-bold text-base">
                    {form.speed != null ? form.speed : calcedSpeed} ft
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">Calculado: {calcedSpeed} ft</p>
                <input
                  type="number"
                  value={form.speed ?? ""}
                  onChange={e => set("speed", e.target.value === "" ? null : parseInt(e.target.value))}
                  placeholder="Override (ft)..."
                  min={0}
                  className="w-full mt-1 bg-stone-900 border border-stone-600 rounded px-2 py-0.5 text-stone-400 text-xs text-center focus:outline-none focus:border-amber-500"
                />
              </Field>
```

- [ ] **Step 2: Añadir speed al handleSave**

Localizar la línea `const initiative = calcInitiative(fDex, fts);` añadida en Task 3. Añadir debajo:

```typescript
      const raceStr2      = (form.race as string | null) ?? "";
      const raceMatch2    = raceStr2.match(/^(.+?) \((.+)\)$/);
      const speciesSave   = raceMatch2 ? raceMatch2[1] : raceStr2;
      const calcedSpeedSave = calcSpeed(speciesSave, cls, fts);
      const speed = form.speed != null ? (form.speed as number) : calcedSpeedSave;
```

Y añadir `speed` al objeto de update (junto a `initiative`):

```typescript
      await api.players.update(params.id, {
        ...form,
        ac,
        hpMax,
        initiative,
        speed,
        level:            lvl,
        proficiencyBonus: pb,
        hitDice:          hitDice || undefined,
        class:            firstClass?.class   ?? undefined,
        subclass:         firstClass?.subclass ?? undefined,
      });
```

- [ ] **Step 3: Verificar typecheck**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "error TS" | head -10
```

Esperado: 0 errores.

- [ ] **Step 4: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/app/players/[id]/page.tsx
git commit -m "feat(ui): velocidad calculada — especie + clase + dotes — con override manual"
```

---

## Task 5: Percepción pasiva — read-only con toggle de competencia

**Files:**
- Modify: `app/frontend/src/app/players/[id]/page.tsx`

`passivePerception` pasa a display de lectura. Se añaden dos checkboxes de atajo en la sección Combate, sincronizados con el tab Habilidades (ambos actualizan `form.skillProficiencies` / `form.skillExpertise`).

- [ ] **Step 1: Añadir dos funciones helper dentro de CharacterSheetContent**

Dentro de `CharacterSheetContent`, después de `function setVariant`:

```typescript
  function togglePerceptionProf(checked: boolean) {
    const next = checked
      ? [...skillProfs, "Perception"]
      : skillProfs.filter(k => k !== "Perception");
    set("skillProficiencies", JSON.stringify(next));
    if (!checked) {
      set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== "Perception")));
    }
  }

  function togglePerceptionExp(checked: boolean) {
    if (checked) {
      set("skillExpertise", JSON.stringify([...skillExpert, "Perception"]));
      if (!hasPerceptionProf) {
        set("skillProficiencies", JSON.stringify([...skillProfs, "Perception"]));
      }
    } else {
      set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== "Perception")));
    }
  }
```

- [ ] **Step 2: Reemplazar el campo Percepción pasiva en la sección Combate**

Localizar:

```typescript
              <Field label="Percepción pasiva">
                <NumberInput value={form.passivePerception} onChange={v => set("passivePerception", v)} />
                <p className="text-xs text-stone-500 mt-0.5">
                  Calculado: {calcPassivePerc}
                  {hasPerceptionExp ? " (SAB + exp.)" : hasPerceptionProf ? " (SAB + comp.)" : " (10 + SAB)"}
                </p>
              </Field>
```

Reemplazar por:

```typescript
              <Field label="Percepción pasiva">
                <div
                  className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                  title={`10 + SAB (${abilityModifier(finalWis) >= 0 ? "+" : ""}${abilityModifier(finalWis)})${hasPerceptionExp ? ` + maestría (+${pb * 2})` : hasPerceptionProf ? ` + competencia (+${pb})` : ""}`}
                >
                  <span className="text-amber-400 font-bold text-base">{calcPassivePerc}</span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  10 + SAB{hasPerceptionExp ? " + maestría" : hasPerceptionProf ? " + comp." : ""}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPerceptionProf || hasPerceptionExp}
                      onChange={e => togglePerceptionProf(e.target.checked)}
                      className="accent-amber-500 w-3 h-3"
                    />
                    <span className="text-xs text-stone-500">Comp.</span>
                  </label>
                  {hasPerceptionProf && (
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasPerceptionExp}
                        onChange={e => togglePerceptionExp(e.target.checked)}
                        className="accent-purple-500 w-3 h-3"
                      />
                      <span className="text-xs text-stone-500">Maestría</span>
                    </label>
                  )}
                </div>
              </Field>
```

- [ ] **Step 3: Añadir passivePerception al handleSave**

Dentro de `handleSave`, localizar el bloque de cálculo (junto a `initiative` y `speed`). Añadir:

```typescript
      const skillProfsForSave: string[]  = parseJson(form.skillProficiencies ?? "[]", []);
      const skillExpertForSave: string[] = parseJson(form.skillExpertise     ?? "[]", []);
      const passivePerception = calcPassivePerception(
        fWis,
        lvl,
        skillProfsForSave.includes("Perception"),
        skillExpertForSave.includes("Perception"),
      );
```

Y añadir `passivePerception` al objeto de update.

- [ ] **Step 4: Ejecutar tests**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test 2>&1 | tail -10
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Verificar typecheck**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 6: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/app/players/[id]/page.tsx
git commit -m "feat(ui): percepción pasiva calculada — lectura con toggle de competencia/maestría"
```

---

## Task 6: Sección conjuros — condicional y auto-detección de característica

**Files:**
- Modify: `app/frontend/src/app/players/[id]/page.tsx`

La sección solo aparece si alguna clase tiene conjuración. CD y bonificador de ataque pasan a ser displays de lectura. La característica se auto-detecta de la clase primaria (mayor nivel entre las clases con magia) pero puede sobreescribirse manualmente.

- [ ] **Step 1: Reemplazar el bloque de cálculo de spell ability**

Localizar:

```typescript
  const spellAbilityKey = form.spellcastingAbility as "wisdom" | "intelligence" | "charisma" | "" | null;
  const spellAbilityScore =
    spellAbilityKey === "wisdom"       ? finalWis :
    spellAbilityKey === "intelligence" ? finalInt :
    spellAbilityKey === "charisma"     ? finalCha :
    null;
  const calcDC     = spellAbilityScore !== null ? calcSpellSaveDC(spellAbilityScore, level)     : null;
  const calcAttack = spellAbilityScore !== null ? calcSpellAttackBonus(spellAbilityScore, level) : null;
```

Reemplazar por:

```typescript
  const spellcastingClasses = classes.filter(c => SPELLCASTING_ABILITY_BY_CLASS[c.class] !== null);
  const hasSpellcasting     = spellcastingClasses.length > 0;
  const primarySpellClass   = hasSpellcasting
    ? spellcastingClasses.reduce((a, b) => a.level >= b.level ? a : b)
    : null;
  const detectedSpellAbility = primarySpellClass
    ? (SPELLCASTING_ABILITY_BY_CLASS[primarySpellClass.class] ?? null)
    : null;

  const spellAbilityKey = ((form.spellcastingAbility || detectedSpellAbility) ?? null) as "wisdom" | "intelligence" | "charisma" | null;
  const spellAbilityScore =
    spellAbilityKey === "wisdom"       ? finalWis :
    spellAbilityKey === "intelligence" ? finalInt :
    spellAbilityKey === "charisma"     ? finalCha :
    null;
  const calcDC     = spellAbilityScore !== null ? calcSpellSaveDC(spellAbilityScore, level)     : null;
  const calcAttack = spellAbilityScore !== null ? calcSpellAttackBonus(spellAbilityScore, level) : null;
```

- [ ] **Step 2: Actualizar ClassesPanel onChange para auto-detectar la característica**

Reemplazar el callback `onChange` de `ClassesPanel`:

```typescript
              onChange={updated => {
                set("classes", JSON.stringify(updated));
                if (updated.length === 1 && !form.spellcastingAbility && updated[0]) {
                  const suggested = SPELLCASTING_ABILITY_BY_CLASS[updated[0].class] ?? null;
                  if (suggested) set("spellcastingAbility", suggested);
                }
              }}
```

Por:

```typescript
              onChange={updated => {
                set("classes", JSON.stringify(updated));
                if (!form.spellcastingAbility) {
                  const spellClasses = updated.filter(c => SPELLCASTING_ABILITY_BY_CLASS[c.class] !== null);
                  if (spellClasses.length > 0) {
                    const primary  = spellClasses.reduce((a, b) => a.level >= b.level ? a : b);
                    const ability  = SPELLCASTING_ABILITY_BY_CLASS[primary.class];
                    if (ability) set("spellcastingAbility", ability);
                  } else {
                    set("spellcastingAbility", null);
                  }
                }
              }}
```

- [ ] **Step 3: Reemplazar la sección Conjuros con renderizado condicional**

Localizar el bloque completo:

```typescript
            <SectionTitle>Conjuros</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Característica de conjuro">
                <select
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-sm text-stone-100"
                  value={form.spellcastingAbility ?? ""}
                  onChange={e => set("spellcastingAbility", e.target.value)}
                >
                  <option value="">— Sin magia —</option>
                  <option value="wisdom">SAB (Sabiduría)</option>
                  <option value="intelligence">INT (Inteligencia)</option>
                  <option value="charisma">CAR (Carisma)</option>
                </select>
              </Field>
              <Field label="CD de salvación">
                <NumberInput value={form.spellSaveDC} onChange={v => set("spellSaveDC", v)} />
                {calcDC !== null && (
                  <p className="text-xs text-stone-500 mt-0.5">Calculado: {calcDC} (8 + mod + comp.)</p>
                )}
              </Field>
              <Field label="Bonif. de ataque">
                <NumberInput value={form.spellAttackBonus} onChange={v => set("spellAttackBonus", v)} />
                {calcAttack !== null && (
                  <p className="text-xs text-stone-500 mt-0.5">
                    Calculado: {calcAttack >= 0 ? `+${calcAttack}` : calcAttack} (mod + comp.)
                  </p>
                )}
              </Field>
            </div>
```

Reemplazar por:

```typescript
            {hasSpellcasting && (
              <>
                <SectionTitle>Conjuros</SectionTitle>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Característica de conjuro">
                    <select
                      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-sm text-stone-100"
                      value={form.spellcastingAbility ?? ""}
                      onChange={e => set("spellcastingAbility", e.target.value || null)}
                    >
                      <option value="">
                        — Auto ({detectedSpellAbility === "wisdom" ? "SAB" : detectedSpellAbility === "intelligence" ? "INT" : detectedSpellAbility === "charisma" ? "CAR" : "—"}) —
                      </option>
                      <option value="wisdom">SAB (Sabiduría)</option>
                      <option value="intelligence">INT (Inteligencia)</option>
                      <option value="charisma">CAR (Carisma)</option>
                    </select>
                  </Field>
                  <Field label="CD de salvación">
                    <div
                      className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                      title={`8 + comp. (+${pb}) + mod (${abilityModifier(spellAbilityScore ?? 10) >= 0 ? "+" : ""}${abilityModifier(spellAbilityScore ?? 10)})`}
                    >
                      <span className="text-amber-400 font-bold text-base">{calcDC ?? "—"}</span>
                    </div>
                    {calcDC !== null && <p className="text-xs text-stone-500 mt-0.5">8 + comp. + mod = {calcDC}</p>}
                  </Field>
                  <Field label="Bonif. de ataque">
                    <div
                      className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                      title={`comp. (+${pb}) + mod (${abilityModifier(spellAbilityScore ?? 10) >= 0 ? "+" : ""}${abilityModifier(spellAbilityScore ?? 10)})`}
                    >
                      <span className="text-amber-400 font-bold text-base">
                        {calcAttack !== null ? (calcAttack >= 0 ? `+${calcAttack}` : calcAttack) : "—"}
                      </span>
                    </div>
                    {calcAttack !== null && <p className="text-xs text-stone-500 mt-0.5">comp. + mod = {calcAttack >= 0 ? `+${calcAttack}` : calcAttack}</p>}
                  </Field>
                </div>
              </>
            )}
```

- [ ] **Step 4: Añadir spellSaveDC y spellAttackBonus al handleSave**

En `handleSave`, localizar el bloque de cálculos (junto a `initiative`, `speed`, `passivePerception`). Añadir:

```typescript
      const fInt = finalAbilityScore(form.intelligence ?? 10, "intelligence", fts);
      const fCha = finalAbilityScore(form.charisma     ?? 10, "charisma",     fts);
      const spellClsSave    = cls.filter(c => SPELLCASTING_ABILITY_BY_CLASS[c.class] !== null);
      const primarySpellSave = spellClsSave.length > 0
        ? spellClsSave.reduce((a, b) => a.level >= b.level ? a : b)
        : null;
      const detectedAbilitySave = primarySpellSave
        ? (SPELLCASTING_ABILITY_BY_CLASS[primarySpellSave.class] ?? null)
        : null;
      const resolvedAbilitySave = ((form.spellcastingAbility || detectedAbilitySave) ?? null) as "wisdom" | "intelligence" | "charisma" | null;
      const spellScoreSave =
        resolvedAbilitySave === "wisdom"       ? fWis :
        resolvedAbilitySave === "intelligence" ? fInt :
        resolvedAbilitySave === "charisma"     ? fCha : null;
      const spellSaveDC    = spellScoreSave !== null ? calcSpellSaveDC(spellScoreSave, lvl)    : undefined;
      const spellAttackBonus = spellScoreSave !== null ? calcSpellAttackBonus(spellScoreSave, lvl) : undefined;
```

Y añadir al objeto de update:

```typescript
      await api.players.update(params.id, {
        ...form,
        ac,
        hpMax,
        initiative,
        speed,
        passivePerception,
        spellSaveDC,
        spellAttackBonus,
        level:            lvl,
        proficiencyBonus: pb,
        hitDice:          hitDice || undefined,
        class:            firstClass?.class   ?? undefined,
        subclass:         firstClass?.subclass ?? undefined,
      });
```

- [ ] **Step 5: Verificar typecheck**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "error TS" | head -10
```

Esperado: 0 errores.

- [ ] **Step 6: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/app/players/[id]/page.tsx
git commit -m "feat(ui): sección conjuros condicional + auto-detección de característica de lanzamiento"
```

---

## Task 7: Confirmación al guardar + toast de error

**Files:**
- Modify: `app/frontend/src/app/players/[id]/page.tsx`

Los dos botones "Guardar" abren un modal de confirmación. Si el save falla, aparece un toast de error. El estado `saved` existente permanece como indicador en el botón tras guardar con éxito.

- [ ] **Step 1: Añadir estados para el modal y el error**

Localizar:

```typescript
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
```

Añadir debajo:

```typescript
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveError, setSaveError]             = useState<string | null>(null);
```

- [ ] **Step 2: Añadir manejo de error en handleSave**

Localizar `async function handleSave() {` y la línea `setSaving(true);`. Añadir `setSaveError(null);` junto a ella:

```typescript
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
```

Localizar el bloque `} finally {` al final de handleSave. Añadir un `catch` antes:

```typescript
    } catch {
      setSaveError("Error al guardar la ficha. Inténtalo de nuevo.");
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaving(false);
    }
```

- [ ] **Step 3: Cambiar onClick de los dos botones Guardar**

Localizar el botón de guardar del header. Cambiar `onClick={handleSave}` por `onClick={() => setShowSaveConfirm(true)}`.

Localizar el botón de guardar inferior (al final del JSX). Cambiar `onClick={handleSave}` por `onClick={() => setShowSaveConfirm(true)}`.

- [ ] **Step 4: Añadir el modal y el toast justo antes del cierre de `</AppShell>`**

```typescript
        {showSaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="font-bold text-stone-100 text-lg mb-2">Guardar ficha</h3>
              <p className="text-stone-400 text-sm mb-6">
                ¿Guardar los cambios en la ficha de{" "}
                <span className="text-stone-200 font-semibold">{form.name}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSaveConfirm(false)}
                  className="px-4 py-2 text-stone-400 hover:text-stone-200 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => { setShowSaveConfirm(false); await handleSave(); }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg text-sm transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {saveError && (
          <div className="fixed bottom-4 right-4 z-50 bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg text-sm shadow-lg">
            {saveError}
          </div>
        )}
```

- [ ] **Step 5: Verificar typecheck y tests**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "error TS" | head -10
```

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test 2>&1 | tail -10
```

Esperado: 0 errores y todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/app/players/[id]/page.tsx
git commit -m "feat(ui): confirmación al guardar + toast de error"
```

---

## Self-Review

**Spec coverage:**
- ✅ Punto 1 — iniciativa calculada (DES + Alert) con tooltip — Tasks 2 + 3
- ✅ Punto 2 — velocidad calculada (especie + clase + Mobile) con override — Tasks 1 + 2 + 4
- ✅ Punto 3 — percepción pasiva read-only con toggle de competencia/maestría — Task 5
- ✅ Punto 4 — CD y ataque de conjuros calculados; sección condicional por clase — Task 6
- ✅ Punto 8 — modal de confirmación + toast de error — Task 7
- ❌ Punto 5 (modal de dotes) — Plan B
- ❌ Punto 6 (ASI mejorado) — Plan B
- ❌ Punto 7 (trasfondo con bloqueo) — Plan C (requiere migración Prisma)

**Restricciones:**
- ✅ Sin cambios de schema Prisma
- ✅ No `any` — todo tipado
- ✅ Tests verificados en Tasks 2 y 5
- ✅ Campos calculados con tooltip de desglose — Tasks 3, 4, 5, 6
- ✅ `handleSave` guarda todos los valores calculados (initiative, speed, passivePerception, spellSaveDC, spellAttackBonus)

**Consistencia de tipos:**
- `calcedInitiative` (number) — mismo en barra stats y sección Combate ✅
- `calcedSpeed` (number) — definido en Step 2 Task 3, usado en Tasks 3 y 4 ✅
- `speedBonusFromClasses`, `speedBonusFromFeats` — mismos nombres en player-calcs.ts (Task 2) y en el tooltip de Task 4 ✅
- `fWis` existe en handleSave antes de usarlo para `passivePerception` (Task 5 Step 3) ✅
- `fInt`, `fCha` se añaden en handleSave en Task 6 Step 4 — no existen antes de ese punto ✅
- `SPELLCASTING_ABILITY_BY_CLASS` ya importado en page.tsx ✅
