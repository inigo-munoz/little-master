# Cálculos de Ficha de Personaje — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralizar todas las fórmulas de la ficha en `player-calcs.ts` (funciones puras testables), mostrar valores calculados como hints en los campos de Percepción Pasiva / Spell DC / Spell Attack / HP Max / Iniciativa, y corregir el bug del entityType en el changelog de players.

**Architecture:** Las fórmulas se extraen a `app/frontend/src/lib/player-calcs.ts` (sin dependencias React — 100 % testable con Vitest). El componente `page.tsx` importa esas funciones y muestra el valor calculado como texto de ayuda bajo cada campo afectado. Los campos permanecen editables para que el usuario pueda hacer overrides (ítems mágicos, dones como Observant, etc.). `dnd-2024-data.ts` añade dos constantes de metadatos de clase (hit die y característica de conjuración). Un commit de bug-fix en backend cierra el `entityType: "npc"` hardcodeado para jugadores.

**Tech Stack:** Next.js 15 App Router + TypeScript + Vitest (frontend), Fastify 5 + Prisma 5 (backend bug fix).

---

## Mapa de archivos

| Fichero | Acción | Responsabilidad |
|---------|--------|-----------------|
| `app/backend/src/routes/players.ts` | Modificar | Fix: `entityType: "npc"` → `"player"` (2 ocurrencias) |
| `app/frontend/src/lib/dnd-2024-data.ts` | Modificar | Añadir `HIT_DIE_BY_CLASS` y `SPELLCASTING_ABILITY_BY_CLASS` |
| `app/frontend/src/lib/player-calcs.ts` | Crear | Funciones puras: `abilityModifier`, `proficiencyBonus`, `calcPassivePerception`, `calcSpellSaveDC`, `calcSpellAttackBonus`, `calcHpMaxSuggestion` |
| `app/frontend/src/lib/player-calcs.test.ts` | Crear | Tests Vitest para todas las funciones de player-calcs.ts |
| `app/frontend/src/app/players/[id]/page.tsx` | Modificar | Importar player-calcs.ts; añadir hints calculados; cambiar spellcastingAbility a Select |

---

## Task 1: Fix — entityType "npc" → "player" en changelog de players

**Files:**
- Modify: `app/backend/src/routes/players.ts` (líneas 58 y 154)

### Contexto

En `players.ts`, tanto el `POST` (crear) como el `PATCH` (actualizar) registran el changelog con `entityType: "npc"`. Esto rompe la trazabilidad porque los registros de cambio de jugadores aparecen como NPCs.

---

- [ ] **Step 1: Corregir las dos ocurrencias**

En `app/backend/src/routes/players.ts`, localizar las dos apariciones de:

```typescript
entityType: "npc",
```

En el bloque `changeLogService.log` del POST (crear player, alrededor de línea 58) y en el PATCH (actualizar, alrededor de línea 154). Reemplazar ambas por:

```typescript
entityType: "player",
```

- [ ] **Step 2: Verificar que el entityType "player" existe en el schema**

```bash
grep -n '"player"' "/media/inigo/Loki/Mis Repos/dnd-assistant/packages/shared/src/types.ts"
```

Esperado: aparece `"player"` en `EntityTypeSchema`. Si no aparece, añadirlo a la lista:

```typescript
export const EntityTypeSchema = z.enum([
  "campaign",
  "session",
  "npc",
  "location",
  "faction",
  "document",
  "rule_source",
  "campaign_rule",
  "llm_config",
  "relation",
  "player",   // ← añadir si falta
]);
```

- [ ] **Step 3: Ejecutar suite completa del backend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend"
pnpm test 2>&1 | tail -5
```

Esperado: todos los tests pasan (123 tests).

- [ ] **Step 4: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/backend/src/routes/players.ts packages/shared/src/types.ts
git commit -m "fix(players): entityType 'npc' → 'player' en changelog de jugadores"
```

---

## Task 2: Añadir metadatos de clase a dnd-2024-data.ts

**Files:**
- Modify: `app/frontend/src/lib/dnd-2024-data.ts`

### Contexto

El fichero ya exporta `DND_CLASSES`, `DND_SPECIES`, `DND_BACKGROUNDS`, `DND_ALIGNMENTS`. Hay que añadir dos constantes nuevas:
- `HIT_DIE_BY_CLASS` — dado de golpe por clase (para sugerencia de HP Max)
- `SPELLCASTING_ABILITY_BY_CLASS` — característica de conjuración por clase (para calcular Spell DC y Spell Attack)

---

- [ ] **Step 1: Añadir las constantes al final del fichero**

Al final de `app/frontend/src/lib/dnd-2024-data.ts`, añadir:

```typescript
// Hit die por clase (PHB 2024)
export const HIT_DIE_BY_CLASS: Record<string, number> = {
  "Bárbaro": 12,
  "Guerrero": 10,
  "Paladín": 10,
  "Explorador": 10,
  "Bardo": 8,
  "Clérigo": 8,
  "Druida": 8,
  "Monje": 8,
  "Pícaro": 8,
  "Brujo": 8,
  "Hechicero": 6,
  "Mago": 6,
};

// Característica de conjuración por clase (PHB 2024)
// null = clase sin magia (Bárbaro, Guerrero base, Pícaro base)
export const SPELLCASTING_ABILITY_BY_CLASS: Record<string, "wisdom" | "intelligence" | "charisma" | null> = {
  "Bárbaro": null,
  "Bardo": "charisma",
  "Clérigo": "wisdom",
  "Druida": "wisdom",
  "Guerrero": null,
  "Monje": "wisdom",
  "Paladín": "charisma",
  "Explorador": "wisdom",
  "Pícaro": null,
  "Hechicero": "charisma",
  "Brujo": "charisma",
  "Mago": "intelligence",
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
git commit -m "feat(player-calcs): añadir HIT_DIE_BY_CLASS y SPELLCASTING_ABILITY_BY_CLASS"
```

---

## Task 3: Crear player-calcs.ts + tests (TDD)

**Files:**
- Create: `app/frontend/src/lib/player-calcs.ts`
- Create: `app/frontend/src/lib/player-calcs.test.ts`

### Contexto

Extraer las fórmulas D&D 2024 a funciones puras. Actualmente `page.tsx` tiene `mod()` y `profBonus()` inline (no testeadas). Aquí las formalizamos con nombre descriptivo, tipos estrictos y cobertura completa.

Fórmulas del PHB 2024:
- Modificador: `floor((score − 10) / 2)`
- Proficiency Bonus: niveles 1-4 → +2, 5-8 → +3, 9-12 → +4, 13-16 → +5, 17-20 → +6
- Percepción Pasiva: `10 + WIS_mod + (expertise ? pb×2 : proficiency ? pb : 0)`
- Spell Save DC: `8 + spellcasting_mod + pb`
- Spell Attack Bonus: `spellcasting_mod + pb`
- HP Max (sugerencia): nivel 1 = `max(hit_die) + CON_mod`; niveles 2+ suman `floor(hit_die/2)+1+CON_mod` por nivel

---

- [ ] **Step 1: Escribir los tests (TDD — antes de implementar)**

Crear `app/frontend/src/lib/player-calcs.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  abilityModifier,
  proficiencyBonus,
  calcPassivePerception,
  calcSpellSaveDC,
  calcSpellAttackBonus,
  calcHpMaxSuggestion,
} from "./player-calcs";

describe("abilityModifier", () => {
  it("score 10 → 0", () => expect(abilityModifier(10)).toBe(0));
  it("score 11 → 0", () => expect(abilityModifier(11)).toBe(0));
  it("score 8  → -1", () => expect(abilityModifier(8)).toBe(-1));
  it("score 9  → -1", () => expect(abilityModifier(9)).toBe(-1));
  it("score 14 → +2", () => expect(abilityModifier(14)).toBe(2));
  it("score 15 → +2", () => expect(abilityModifier(15)).toBe(2));
  it("score 20 → +5", () => expect(abilityModifier(20)).toBe(5));
  it("score 1  → -5", () => expect(abilityModifier(1)).toBe(-5));
  it("score 30 → +10", () => expect(abilityModifier(30)).toBe(10));
});

describe("proficiencyBonus", () => {
  it.each([
    [1, 2], [4, 2],
    [5, 3], [8, 3],
    [9, 4], [12, 4],
    [13, 5], [16, 5],
    [17, 6], [20, 6],
  ])("nivel %i → +%i", (level, expected) =>
    expect(proficiencyBonus(level)).toBe(expected)
  );
});

describe("calcPassivePerception", () => {
  it("WIS 10, nivel 1, sin prof → 10", () =>
    expect(calcPassivePerception(10, 1, false, false)).toBe(10));

  it("WIS 14 (+2), nivel 1, sin prof → 12", () =>
    expect(calcPassivePerception(14, 1, false, false)).toBe(12));

  it("WIS 10, nivel 1, con prof (+2) → 12", () =>
    expect(calcPassivePerception(10, 1, true, false)).toBe(12));

  it("WIS 10, nivel 5, con expertise (pb=3, ×2=6) → 16", () =>
    expect(calcPassivePerception(10, 5, true, true)).toBe(16));

  it("WIS 8 (-1), nivel 1, sin prof → 9", () =>
    expect(calcPassivePerception(8, 1, false, false)).toBe(9));

  it("expertise prevalece sobre proficiency simple", () =>
    // expertise pasa true en ambos flags
    expect(calcPassivePerception(10, 1, true, true)).toBe(14)); // 10 + 2×2
});

describe("calcSpellSaveDC", () => {
  it("INT 16 (+3), nivel 5 (pb=3) → DC 14", () =>
    expect(calcSpellSaveDC(16, 5)).toBe(14)); // 8+3+3

  it("SAB 10 (+0), nivel 1 (pb=2) → DC 10", () =>
    expect(calcSpellSaveDC(10, 1)).toBe(10)); // 8+0+2

  it("CAR 20 (+5), nivel 17 (pb=6) → DC 19", () =>
    expect(calcSpellSaveDC(20, 17)).toBe(19)); // 8+5+6
});

describe("calcSpellAttackBonus", () => {
  it("INT 16 (+3), nivel 5 (pb=3) → +6", () =>
    expect(calcSpellAttackBonus(16, 5)).toBe(6)); // 3+3

  it("SAB 10 (+0), nivel 1 (pb=2) → +2", () =>
    expect(calcSpellAttackBonus(10, 1)).toBe(2));

  it("CAR 20 (+5), nivel 17 (pb=6) → +11", () =>
    expect(calcSpellAttackBonus(20, 17)).toBe(11));
});

describe("calcHpMaxSuggestion", () => {
  it("clase desconocida → null", () =>
    expect(calcHpMaxSuggestion("Desconocido", 10, 1)).toBeNull());

  it("Mago nivel 1, CON 10 (+0) → 6", () =>
    expect(calcHpMaxSuggestion("Mago", 10, 1)).toBe(6));

  it("Bárbaro nivel 1, CON 16 (+3) → 15", () =>
    expect(calcHpMaxSuggestion("Bárbaro", 16, 1)).toBe(15)); // 12+3

  it("Bárbaro nivel 2, CON 16 (+3) → 22", () =>
    // nivel 1: 12+3=15; nivel 2: floor(12/2)+1+3=9+3=... wait
    // floor(12/2)=6, +1=7, +3=10. Total: 15+10=25
    // Ojo: floor(12/2)+1 = 7 (media del d12 redondeada)
    expect(calcHpMaxSuggestion("Bárbaro", 16, 2)).toBe(25));

  it("Mago nivel 3, CON 10 (+0) → 14", () =>
    // nivel 1: 6+0=6; niveles 2-3: 2×(floor(6/2)+1+0) = 2×4=8. Total: 14
    expect(calcHpMaxSuggestion("Mago", 10, 3)).toBe(14));

  it("HP mínimo 1 por nivel aunque CON mod sea muy negativo", () => {
    // CON 1 → mod=-5. Mago nivel 1: max(6-5, 1) = 1
    expect(calcHpMaxSuggestion("Mago", 1, 1)).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar los tests — verificar que fallan**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test src/lib/player-calcs.test.ts 2>&1 | tail -10
```

Esperado: falla con "Cannot find module './player-calcs'".

- [ ] **Step 3: Implementar player-calcs.ts**

Crear `app/frontend/src/lib/player-calcs.ts`:

```typescript
import { HIT_DIE_BY_CLASS } from "./dnd-2024-data";

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
  // Nivel 1: máximo del dado + mod CON (mínimo 1)
  const level1Hp = Math.max(1, hitDie + conMod);
  // Niveles 2+: media redondeada del dado + mod CON por nivel (mínimo 1 por nivel)
  const avgPerLevel = Math.floor(hitDie / 2) + 1;
  const additionalHp = (level - 1) * Math.max(1, avgPerLevel + conMod);
  return level1Hp + additionalHp;
}
```

- [ ] **Step 4: Ejecutar los tests — verificar que pasan**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test src/lib/player-calcs.test.ts 2>&1 | tail -10
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Ejecutar la suite completa del frontend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test 2>&1 | tail -5
```

Esperado: todos los tests previos siguen pasando + los nuevos (46+ tests).

- [ ] **Step 6: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/lib/player-calcs.ts app/frontend/src/lib/player-calcs.test.ts
git commit -m "feat(player-calcs): funciones puras de cálculo D&D 2024 con tests"
```

---

## Task 4: Integrar cálculos en page.tsx

**Files:**
- Modify: `app/frontend/src/app/players/[id]/page.tsx`

### Contexto

La página tiene dos funciones inline (`mod()` y `profBonus()`) que serán reemplazadas por las importadas de `player-calcs.ts`. Se añaden hints calculados bajo los campos de Percepción Pasiva, Spell Save DC, Spell Attack Bonus, HP Max e Iniciativa. La `spellcastingAbility` pasa de Input de texto libre a Select tipado (`"wisdom" | "intelligence" | "charisma" | ""`).

Todas las fórmulas se muestran como texto gris bajo el campo — el campo sigue siendo editable para que el usuario pueda hacer overrides (ej: don Observant +5 a Percepción Pasiva, ítems mágicos que aumentan Spell DC).

---

- [ ] **Step 1: Añadir los nuevos imports al inicio de page.tsx**

Localizar el bloque de imports existente en `app/frontend/src/app/players/[id]/page.tsx`. Añadir:

```typescript
import {
  abilityModifier,
  proficiencyBonus,
  calcPassivePerception,
  calcSpellSaveDC,
  calcSpellAttackBonus,
  calcHpMaxSuggestion,
} from "@/lib/player-calcs";
import { HIT_DIE_BY_CLASS, SPELLCASTING_ABILITY_BY_CLASS } from "@/lib/dnd-2024-data";
```

- [ ] **Step 2: Reemplazar las funciones inline `mod()` y `profBonus()`**

En `page.tsx`, localizar y eliminar las funciones inline (líneas ~49-57):

```typescript
function mod(score: number | null | undefined): string {
  if (!score) return "+0";
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}
```

Reemplazarlas por estas dos funciones de compatibilidad que usan las importadas:

```typescript
function mod(score: number | null | undefined): string {
  const m = abilityModifier(score ?? 10);
  return m >= 0 ? `+${m}` : `${m}`;
}

function profBonus(level: number): number {
  return proficiencyBonus(level);
}
```

Esto mantiene compatibilidad con todos los usos existentes en el JSX (`mod(form.dexterity)`, etc.) sin tener que cambiarlos uno a uno.

- [ ] **Step 3: Calcular los valores derivados junto a `pb`**

Localizar la línea (alrededor de la 197):

```typescript
const pb = profBonus(form.level ?? 1);
```

Añadir las variables calculadas justo debajo:

```typescript
const pb = profBonus(form.level ?? 1);

// Percepción pasiva calculada
const skillProfsForCalc: string[] = parseJson(form.skillProficiencies ?? "[]", []);
const skillExpertForCalc: string[] = parseJson(form.skillExpertise ?? "[]", []);
const hasPerceptionProf = skillProfsForCalc.includes("Perception");
const hasPerceptionExp = skillExpertForCalc.includes("Perception");
const calcPassivePerc = calcPassivePerception(
  form.wisdom ?? 10,
  form.level ?? 1,
  hasPerceptionProf,
  hasPerceptionExp
);

// Spell DC y Spell Attack (si hay característica de conjuración seleccionada)
const spellAbilityKey = form.spellcastingAbility as "wisdom" | "intelligence" | "charisma" | "" | null;
const spellAbilityScore =
  spellAbilityKey === "wisdom" ? (form.wisdom ?? 10) :
  spellAbilityKey === "intelligence" ? (form.intelligence ?? 10) :
  spellAbilityKey === "charisma" ? (form.charisma ?? 10) :
  null;
const calcDC = spellAbilityScore !== null
  ? calcSpellSaveDC(spellAbilityScore, form.level ?? 1)
  : null;
const calcAttack = spellAbilityScore !== null
  ? calcSpellAttackBonus(spellAbilityScore, form.level ?? 1)
  : null;

// HP Max sugerida
const hpMaxSug = form.class
  ? calcHpMaxSuggestion(form.class, form.constitution ?? 10, form.level ?? 1)
  : null;

// Iniciativa sugerida (mod DES)
const initiativeSug = abilityModifier(form.dexterity ?? 10);
```

- [ ] **Step 4: Cambiar spellcastingAbility de Input a Select**

Localizar en el bloque `{activeTab === "core"}` la sección de Conjuros (alrededor de línea 442):

```typescript
<Field label="Característica de conjuro"><Input value={form.spellcastingAbility} onChange={v => set("spellcastingAbility", v)} placeholder="SAB / INT / CAR" /></Field>
```

Reemplazar por:

```typescript
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
```

- [ ] **Step 5: Añadir hints calculados a los campos afectados**

Localizar en el bloque Conjuros (alrededor de línea 443-444):

```typescript
<Field label="CD de salvación"><NumberInput value={form.spellSaveDC} onChange={v => set("spellSaveDC", v)} /></Field>
<Field label="Bonif. de ataque"><NumberInput value={form.spellAttackBonus} onChange={v => set("spellAttackBonus", v)} /></Field>
```

Reemplazar por:

```typescript
<Field label="CD de salvación">
  <NumberInput value={form.spellSaveDC} onChange={v => set("spellSaveDC", v)} />
  {calcDC !== null && (
    <p className="text-xs text-stone-500 mt-0.5">Calculado: {calcDC} (8 + mod + competencia)</p>
  )}
</Field>
<Field label="Bonif. de ataque">
  <NumberInput value={form.spellAttackBonus} onChange={v => set("spellAttackBonus", v)} />
  {calcAttack !== null && (
    <p className="text-xs text-stone-500 mt-0.5">Calculado: {calcAttack >= 0 ? `+${calcAttack}` : calcAttack} (mod + competencia)</p>
  )}
</Field>
```

Localizar el campo de HP Max (alrededor de línea 430):

```typescript
<Field label="HP máx"><NumberInput value={form.hpMax} onChange={v => set("hpMax", v)} /></Field>
```

Reemplazar por:

```typescript
<Field label="HP máx">
  <NumberInput value={form.hpMax} onChange={v => set("hpMax", v)} />
  {hpMaxSug !== null && (
    <p className="text-xs text-stone-500 mt-0.5">
      Sugerido: {hpMaxSug} ({form.class}, nivel {form.level ?? 1})
    </p>
  )}
</Field>
```

Localizar el campo de Iniciativa (alrededor de línea 435):

```typescript
<Field label="Iniciativa"><NumberInput value={form.initiative} onChange={v => set("initiative", v)} /></Field>
```

Reemplazar por:

```typescript
<Field label="Iniciativa">
  <NumberInput value={form.initiative} onChange={v => set("initiative", v)} />
  <p className="text-xs text-stone-500 mt-0.5">
    Base DES: {initiativeSug >= 0 ? `+${initiativeSug}` : initiativeSug}
  </p>
</Field>
```

Localizar el campo de Percepción pasiva (alrededor de línea 437):

```typescript
<Field label="Percepción pasiva"><NumberInput value={form.passivePerception} onChange={v => set("passivePerception", v)} /></Field>
```

Reemplazar por:

```typescript
<Field label="Percepción pasiva">
  <NumberInput value={form.passivePerception} onChange={v => set("passivePerception", v)} />
  <p className="text-xs text-stone-500 mt-0.5">
    Calculado: {calcPassivePerc} (10 + SAB{hasPerceptionExp ? " + exp." : hasPerceptionProf ? " + comp." : ""})
  </p>
</Field>
```

- [ ] **Step 6: Auto-sugerir la característica de conjuración al cambiar de clase**

Localizar la sección donde se actualiza la clase (alrededor de la línea 224-226):

```typescript
const currentClass: string = form.class ?? "";
const availableSubclasses = DND_CLASSES[currentClass] ?? [];
const showSubclass = !!currentClass && (form.level ?? 1) >= 3;
```

Añadir debajo:

```typescript
// Sugerir característica de conjuración cuando cambia la clase
function handleClassChange(newClass: string) {
  set("class", newClass);
  const suggestedAbility = SPELLCASTING_ABILITY_BY_CLASS[newClass] ?? null;
  // Solo auto-rellena si el campo está vacío o era null
  if (!form.spellcastingAbility && suggestedAbility) {
    set("spellcastingAbility", suggestedAbility);
  }
}
```

Localizar el Select de clase en el JSX (alrededor de línea 395-406). Donde actualmente dice:

```typescript
onChange={v => set("class", v)}
```

Cambiar por:

```typescript
onChange={v => handleClassChange(v)}
```

- [ ] **Step 7: Verificar typecheck**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm typecheck 2>&1 | grep "error TS" | head -10
```

Esperado: 0 errores.

- [ ] **Step 8: Ejecutar tests del frontend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test 2>&1 | tail -5
```

Esperado: todos los tests pasan (los nuevos de player-calcs + los 46 existentes).

- [ ] **Step 9: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/src/app/players/[id]/page.tsx
git commit -m "feat(player-calcs): hints calculados en ficha — percepción pasiva, spell DC/attack, HP Max, iniciativa"
```

---

## Self-Review

**Spec coverage:**
- ✅ Percepción Pasiva: calculada con `10 + WIS_mod + (expertise/prof ? pb : 0)` — Task 4 Step 5
- ✅ Spell Save DC: `8 + ability_mod + pb` — Task 4 Step 5
- ✅ Spell Attack Bonus: `ability_mod + pb` — Task 4 Step 5
- ✅ HP Max sugerida desde clase (hit die) + CON + nivel — Task 4 Step 5
- ✅ Iniciativa base DES — Task 4 Step 5
- ✅ spellcastingAbility como Select tipado en lugar de texto libre — Task 4 Step 4
- ✅ Auto-sugerir característica al cambiar clase — Task 4 Step 6
- ✅ `player-calcs.ts` testeable en aislamiento — Task 3
- ✅ Proficiency Bonus tabla correcta PHB 2024 — Task 3 (tests en Step 1)
- ✅ Bug entityType "npc" → "player" — Task 1
- ✅ Metadatos de clase (HIT_DIE, SPELLCASTING_ABILITY) — Task 2
- ✅ Todos los campos siguen siendo editables (override posible para dones/ítems) — Task 4 Steps 4-5
- ✅ `mod()` y `profBonus()` inline sustituidas por funciones importadas — Task 4 Step 2

**No hay placeholders.** Todos los pasos tienen código completo.

**Consistencia de tipos:** `spellcastingAbility` se guarda como `"wisdom" | "intelligence" | "charisma" | ""`. En `player-calcs.ts`, `calcSpellSaveDC` y `calcSpellAttackBonus` reciben el `score` numérico (ya resuelto en el componente). No hay inconsistencia de nombres entre tasks.

**Nota para ejecutores:** Si en el Step 2 de Task 1 `"player"` ya aparece en `EntityTypeSchema`, no modificar el fichero — confirmarlo y continuar.
