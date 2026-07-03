# Fase 0 — Remediación Legal: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar todo el contenido PHB 2024 (copyright WotC) del repo público `inigo-munoz/little-master` y sus releases, dejando un seed 100% SRD 5.2.1 (CC-BY-4.0) en inglés, un mecanismo privado para el contenido propio del usuario, y licencia MIT.

**Architecture:** Se genera un fichero de hechizos SRD limpio con nombre nuevo (`09_Spells.md`) para desacoplar la purga del historial (ruta vieja) del contenido nuevo. Toda la preparación se commitea en local; `git-filter-repo` reescribe el historial; un único force-push publica el resultado. Las releases antiguas se eliminan por completo (sus binarios embeben el seed contaminado) y se publica v1.2.0 limpia.

**Tech Stack:** TypeScript (tsx), Vitest, git-filter-repo, gh CLI.

**Spec:** `docs/superpowers/specs/2026-07-03-fase0-remediacion-legal-design.md`

## Global Constraints

- **PROHIBIDO hacer `git push` a `origin` hasta la Task 6 (post-purga).** Todos los commits previos son locales.
- Código, identificadores y comentarios en inglés; mensajes de commit en español con conventional commits, SIN "Co-Authored-By" ni atribución de IA.
- El formato del fichero de hechizos generado DEBE casar con las regex inglesas de `parseSpellDocument` (`app/backend/src/routes/spells.ts:43`): header `## Name`, línea de tipo `Level N, School (Classes)` o `Cantrip, School (Classes)` con tags `[C]`/`[Ritual]`/`[C/Ritual]`, línea de stats `Casting Time: X | Range: X | Components: X | Duration: X`, marcadores `*Higher Level:*` y `*Cantrip Upgrade:*`.
- Tests de backend: `cd app/backend && pnpm test` (vitest). Deben quedar verdes al final de cada task que toque código.
- Directorio del repo: `/media/inigo/Loki/Mis Repos/dnd-assistant` (ojo al espacio en la ruta: siempre entre comillas).

---

### Task 1: Backup completo (bloqueante)

**Files:**
- Create (fuera del repo): `~/dnd-backups/little-master-pre-purge.bundle`
- Create (fuera del repo): `~/dnd-private-content/phb2024/` y `~/dnd-private-content/09_Hechizos.md`

**Interfaces:**
- Produces: bundle de recuperación total; copia del contenido PHB que la Task 4 moverá a `data/private/phb2024/`.

- [ ] **Step 1: Crear el bundle con todo el historial**

```bash
mkdir -p ~/dnd-backups ~/dnd-private-content
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git bundle create ~/dnd-backups/little-master-pre-purge.bundle --all
```

- [ ] **Step 2: Verificar la integridad del bundle**

Run: `git bundle verify ~/dnd-backups/little-master-pre-purge.bundle`
Expected: `... is okay` listando refs de main y tags.

- [ ] **Step 3: Copiar el contenido PHB fuera del repo**

```bash
cp -r "/media/inigo/Loki/Mis Repos/dnd-assistant/data/phb2024" ~/dnd-private-content/phb2024
cp "/media/inigo/Loki/Mis Repos/dnd-assistant/data/srd/en/09_Hechizos.md" ~/dnd-private-content/09_Hechizos.md
```

- [ ] **Step 4: Verificar la copia**

Run: `fd . ~/dnd-private-content/phb2024 -t f | wc -l`
Expected: `11` (los 11 ficheros PHB).

---

### Task 2: Generador de hechizos SRD en inglés (TDD)

**Files:**
- Create: `app/backend/src/db/srd-spells-builder.ts`
- Create: `app/backend/src/db/srd-spells-builder.test.ts`
- Create: `app/backend/src/db/build-srd-spells-cli.ts`
- Modify: `app/backend/package.json` (script `srd:build-spells`)

**Interfaces:**
- Consumes: `data/srd/en/06_Trasfondos_y_Equipo.txt` — texto plano SRD con sección "Spell Descriptions" (línea ~4374) hasta "Rules Glossary" (línea ~12960), con basura de paginación (líneas que son solo un número, y el footer literal `System Reference Document 5.2.1`).
- Produces:
  - `extractSpellSection(raw: string): string[]` — líneas de la sección de hechizos, sin footers.
  - `parseSpells(lines: string[]): ParsedSpell[]` — hechizos estructurados.
  - `formatSpell(spell: ParsedSpell): string` — bloque markdown compatible con `parseSpellDocument`.
  - `buildSpellsMarkdown(raw: string): { markdown: string; count: number }` — documento completo.
  - CLI que escribe `data/srd/en/09_Spells.md`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `app/backend/src/db/srd-spells-builder.test.ts`. Ajustar el estilo de imports al de `app/backend/src/routes/srd.test.ts` (mismo sufijo `.js` o no en los imports relativos — copiar lo que haga ese fichero):

```ts
import { describe, it, expect } from "vitest";
import {
  extractSpellSection,
  parseSpells,
  formatSpell,
  buildSpellsMarkdown,
} from "./srd-spells-builder";

// Verbatim excerpt shape from data/srd/en/06_Trasfondos_y_Equipo.txt,
// including PDF pagination noise (page number lines and SRD footer).
const FIXTURE = `Spell Descriptions
Acid Arrow

Level 2 Evocation (Wizard)
Casting Time: Action
Range: 90 feet
Components: V, S, M (powdered rhubarb leaf)
Duration: Instantaneous

A shimmering green arrow streaks toward a target
within range and bursts in a spray of acid.
Using a Higher-Level Spell Slot. The damage
(both initial and later) increases by 1d4 for each
spell slot level above 2.

Alarm

Level 1 Abjuration (Ranger, Wizard)

Casting Time: 1 minute or Ritual
Range: 30 feet
Components: V, S, M (a bell and silver wire)
Duration: 8 hours

You set an alarm against intrusion. Choose a door,
a window, or an area within range that is no larger
than a 20-foot Cube. Until the spell ends, an alarm

107

System Reference Document 5.2.1

alerts you whenever a creature touches or enters
the warded area.

Fire Bolt

Evocation Cantrip (Sorcerer, Wizard)
Casting Time: Action
Range: 120 feet
Components: V, S
Duration: Instantaneous

You hurl a mote of fire at a creature or an object
within range.
Cantrip Upgrade. The damage increases by 1d10
when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).

Hold Person

Level 2 Enchantment (Bard, Cleric, Druid, Sorcerer, Warlock, Wizard)
Casting Time: Action
Range: 60 feet
Components: V, S, M (a straight piece of iron)
Duration: Concentration, up to 1 minute

Choose a Humanoid that you can see within range.
Rules Glossary
`;

describe("extractSpellSection", () => {
  it("drops page-number lines and SRD footers and stops at Rules Glossary", () => {
    const lines = extractSpellSection(FIXTURE);
    expect(lines).not.toContain("107");
    expect(lines).not.toContain("System Reference Document 5.2.1");
    expect(lines).not.toContain("Rules Glossary");
    expect(lines).toContain("Acid Arrow");
  });
});

describe("parseSpells", () => {
  const spells = parseSpells(extractSpellSection(FIXTURE));

  it("finds the four spells in the fixture", () => {
    expect(spells.map((s) => s.name)).toEqual([
      "Acid Arrow",
      "Alarm",
      "Fire Bolt",
      "Hold Person",
    ]);
  });

  it("parses a leveled spell with higher-level upgrade", () => {
    const acid = spells[0]!;
    expect(acid.level).toBe(2);
    expect(acid.school).toBe("Evocation");
    expect(acid.classes).toBe("Wizard");
    expect(acid.castingTime).toBe("Action");
    expect(acid.range).toBe("90 feet");
    expect(acid.components).toBe("V, S, M (powdered rhubarb leaf)");
    expect(acid.duration).toBe("Instantaneous");
    expect(acid.higherLevel).toContain("increases by 1d4");
    expect(acid.description).toContain("shimmering green arrow");
  });

  it("parses a cantrip with cantrip upgrade", () => {
    const bolt = spells[2]!;
    expect(bolt.level).toBe(0);
    expect(bolt.school).toBe("Evocation");
    expect(bolt.cantripUpgrade).toContain("1d10");
  });

  it("joins description lines split across page breaks", () => {
    const alarm = spells[1]!;
    expect(alarm.description).toContain(
      "an alarm alerts you whenever a creature touches"
    );
  });
});

describe("formatSpell", () => {
  const spells = parseSpells(extractSpellSection(FIXTURE));

  it("formats a leveled spell in the exact English layout the API parser expects", () => {
    const md = formatSpell(spells[0]!);
    expect(md).toContain("## Acid Arrow\n");
    expect(md).toContain("Level 2, Evocation (Wizard)\n");
    expect(md).toContain(
      "Casting Time: Action | Range: 90 feet | Components: V, S, M (powdered rhubarb leaf) | Duration: Instantaneous"
    );
    expect(md).toContain("*Higher Level:*");
  });

  it("tags ritual and concentration spells", () => {
    const alarm = formatSpell(spells[1]!);
    expect(alarm).toContain("Level 1, Abjuration (Ranger, Wizard) [Ritual]");
    const hold = formatSpell(spells[3]!);
    expect(hold).toContain("[C]");
  });

  it("formats cantrips with the Cantrip prefix and upgrade marker", () => {
    const bolt = formatSpell(spells[2]!);
    expect(bolt).toContain("Cantrip, Evocation (Sorcerer, Wizard)");
    expect(bolt).toContain("*Cantrip Upgrade:*");
  });
});

describe("buildSpellsMarkdown", () => {
  it("produces a full document with CC-BY-4.0 header and spell count", () => {
    const { markdown, count } = buildSpellsMarkdown(FIXTURE);
    expect(count).toBe(4);
    expect(markdown).toContain("CC-BY-4.0");
    expect(markdown).not.toContain("PHB");
    expect(markdown.split("\n## ").length - 1).toBe(4);
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend" && pnpm test srd-spells-builder`
Expected: FAIL — `Cannot find module './srd-spells-builder'` (o equivalente).

- [ ] **Step 3: Implementar el builder**

Crear `app/backend/src/db/srd-spells-builder.ts`:

```ts
// Builds the SRD 5.2.1 English spell descriptions markdown from the raw
// PDF-extracted plaintext (06_Trasfondos_y_Equipo.txt). The output layout
// must match the English branch of parseSpellDocument in routes/spells.ts.

export interface ParsedSpell {
  name: string;
  level: number; // 0 = cantrip
  school: string;
  classes: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  higherLevel: string | null;
  cantripUpgrade: string | null;
}

const SECTION_START = "Spell Descriptions";
const SECTION_END = "Rules Glossary";
// PDF pagination noise: bare page numbers and the repeated document footer.
const NOISE_RE = /^(\d{1,4}|System Reference Document 5\.2\.1)$/;
// "Level 2 Evocation (Wizard)" | "Evocation Cantrip (Sorcerer, Wizard)"
const TYPE_RE =
  /^(?:Level (\d+) ([A-Za-z]+)|([A-Za-z]+) Cantrip)\s*\(([^)]+)\)$/;
const FIELD_RE = /^(Casting Time|Range|Components|Duration):\s*(.*)$/;
const HIGHER_MARKER = "Using a Higher-Level Spell Slot.";
const CANTRIP_MARKER = "Cantrip Upgrade.";

export function extractSpellSection(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const start = lines.indexOf(SECTION_START);
  const end = lines.indexOf(SECTION_END);
  const section = lines.slice(
    start + 1,
    end === -1 ? undefined : end
  );
  return section.filter((l) => !NOISE_RE.test(l));
}

export function parseSpells(lines: string[]): ParsedSpell[] {
  // Locate every type line; the spell name is the nearest non-empty line
  // above it, and each spell's body runs until the next spell's name line.
  const typeIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (TYPE_RE.test(lines[i]!)) typeIdx.push(i);
  }

  const nameIdx = typeIdx.map((t) => {
    for (let i = t - 1; i >= 0; i--) {
      if (lines[i] !== "") return i;
    }
    return -1;
  });

  const spells: ParsedSpell[] = [];
  for (let k = 0; k < typeIdx.length; k++) {
    const t = typeIdx[k]!;
    if (nameIdx[k]! < 0) continue;
    const name = lines[nameIdx[k]!]!;
    const m = lines[t]!.match(TYPE_RE)!;
    const level = m[1] ? Number(m[1]) : 0;
    const school = (m[2] ?? m[3])!;
    const classes = m[4]!;

    // Consume the four stat fields; non-field lines while fields are open
    // are wrapped continuations of the previous field's value.
    const fields: Record<string, string> = {};
    let current: string | null = null;
    let bodyStart = t + 1;
    for (let i = t + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line === "") {
        if (fields["Duration"] !== undefined) {
          bodyStart = i + 1;
          break;
        }
        continue;
      }
      const f = line.match(FIELD_RE);
      if (f) {
        current = f[1]!;
        fields[current] = f[2]!;
      } else if (current && fields["Duration"] === undefined) {
        fields[current] += ` ${line}`;
      } else {
        bodyStart = i;
        break;
      }
    }
    if (fields["Duration"] === undefined) continue; // corrupted block, skip

    const bodyEnd = k + 1 < typeIdx.length ? nameIdx[k + 1]! : lines.length;
    const body = lines
      .slice(bodyStart, bodyEnd)
      .filter((l) => l !== "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    let description = body;
    let higherLevel: string | null = null;
    let cantripUpgrade: string | null = null;
    const hi = body.indexOf(HIGHER_MARKER);
    if (hi !== -1) {
      description = body.slice(0, hi).trim();
      higherLevel = body.slice(hi + HIGHER_MARKER.length).trim();
    }
    const ci = body.indexOf(CANTRIP_MARKER);
    if (ci !== -1) {
      description = body.slice(0, ci).trim();
      cantripUpgrade = body.slice(ci + CANTRIP_MARKER.length).trim();
    }

    spells.push({
      name,
      level,
      school,
      classes,
      castingTime: fields["Casting Time"] ?? "",
      range: fields["Range"] ?? "",
      components: fields["Components"] ?? "",
      duration: fields["Duration"] ?? "",
      description,
      higherLevel,
      cantripUpgrade,
    });
  }
  return spells;
}

export function formatSpell(s: ParsedSpell): string {
  const concentration = /concentration/i.test(s.duration);
  const ritual = /ritual/i.test(s.castingTime);
  let tag = "";
  if (concentration && ritual) tag = " [C/Ritual]";
  else if (concentration) tag = " [C]";
  else if (ritual) tag = " [Ritual]";

  const typeLine =
    s.level === 0
      ? `Cantrip, ${s.school} (${s.classes})${tag}`
      : `Level ${s.level}, ${s.school} (${s.classes})${tag}`;
  const statsLine = `Casting Time: ${s.castingTime} | Range: ${s.range} | Components: ${s.components} | Duration: ${s.duration}`;

  const parts = [`## ${s.name}`, typeLine, statsLine, s.description];
  if (s.higherLevel) parts.push(`*Higher Level:* ${s.higherLevel}`);
  if (s.cantripUpgrade) parts.push(`*Cantrip Upgrade:* ${s.cantripUpgrade}`);
  return parts.join("\n");
}

const HEADER = `# SRD 5.2.1 — Spell Descriptions

Source: System Reference Document 5.2.1 (CC-BY-4.0), Wizards of the Coast LLC
Type: srd | Authority: high | Version: 5.2.1

---
`;

export function buildSpellsMarkdown(raw: string): {
  markdown: string;
  count: number;
} {
  const spells = parseSpells(extractSpellSection(raw));
  const markdown = `${HEADER}\n${spells.map(formatSpell).join("\n\n\n")}\n`;
  return { markdown, count: spells.length };
}
```

- [ ] **Step 4: Verificar que los tests pasan**

Run: `cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend" && pnpm test srd-spells-builder`
Expected: PASS (8 tests).

Si algún test de parseo falla por diferencias del fixture con el fichero real, ajustar la IMPLEMENTACIÓN (no el fixture, que es literal del fichero real).

- [ ] **Step 5: Crear el CLI**

Crear `app/backend/src/db/build-srd-spells-cli.ts` (mismo estilo que `srd-import-cli.ts` — copiar su resolución de rutas):

```ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSpellsMarkdown } from "./srd-spells-builder";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env["DATA_DIR"] ?? path.resolve(__dirname, "../../../../data");
const source = path.join(dataDir, "srd", "en", "06_Trasfondos_y_Equipo.txt");
const target = path.join(dataDir, "srd", "en", "09_Spells.md");

const raw = readFileSync(source, "utf-8");
const { markdown, count } = buildSpellsMarkdown(raw);

if (count < 290) {
  console.error(`[build-srd-spells] Only ${count} spells parsed (expected ~300+). Aborting.`);
  process.exit(1);
}

writeFileSync(target, markdown, "utf-8");
console.log(`[build-srd-spells] Wrote ${count} spells to ${target}`);
```

Nota: si `srd-import-cli.ts` no usa `fileURLToPath` (por ejemplo usa `__dirname` de CJS), replicar SU patrón exacto.

- [ ] **Step 6: Añadir el script npm**

En `app/backend/package.json`, junto a `phb:import`:

```json
"srd:build-spells": "npx tsx src/db/build-srd-spells-cli.ts",
```

- [ ] **Step 7: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/backend/src/db/srd-spells-builder.ts app/backend/src/db/srd-spells-builder.test.ts app/backend/src/db/build-srd-spells-cli.ts app/backend/package.json
git commit -m "feat(srd): generador de hechizos SRD en inglés desde el texto fuente CC-BY-4.0"
```

---

### Task 3: Generar `09_Spells.md`, retirar el fichero contaminado y testear el parser

**Files:**
- Create: `data/srd/en/09_Spells.md` (generado)
- Delete: `data/srd/en/09_Hechizos.md`
- Modify: `app/backend/src/db/srd-import.ts` (entrada de `SRD_SECTIONS`, líneas ~27-36)
- Modify: `app/backend/src/routes/spells.ts` (exportar `parseSpellDocument` si no está exportado)
- Create: `app/backend/src/routes/spells.test.ts`

**Interfaces:**
- Consumes: `buildSpellsMarkdown` vía el CLI de la Task 2; `parseSpellDocument(content: string): Record<string, SpellFullData>` de `routes/spells.ts`.
- Produces: seed SRD funcional en inglés; cobertura de test del parser inglés que las Tasks 6-7 usan como red de seguridad.

- [ ] **Step 1: Generar el fichero**

Run: `cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend" && pnpm srd:build-spells`
Expected: `[build-srd-spells] Wrote N spells to .../data/srd/en/09_Spells.md` con N ≥ 290.

- [ ] **Step 2: Muestreo manual del contenido generado**

Run: `rg -A 3 "^## (Fireball|Alarm|Fire Bolt|Hold Person)$" "/media/inigo/Loki/Mis Repos/dnd-assistant/data/srd/en/09_Spells.md"`
Expected: los 4 hechizos con línea de tipo y stats en inglés; `Alarm` con `[Ritual]`, `Hold Person` con `[C]`. Comparar los valores de Fireball contra el spec (Level 3, 150 feet, 8d6, +1d6 por nivel).

- [ ] **Step 3: Actualizar `SRD_SECTIONS`**

En `app/backend/src/db/srd-import.ts`, cambiar la última entrada:

```ts
{ filename: "09_Spells.md", title: "SRD 5.2.1 — Spells", lang: "en" },
```

(antes: `filename: "09_Hechizos.md"`).

- [ ] **Step 4: Test del parser inglés (failing first si hay que exportar)**

Si `parseSpellDocument` no está exportado en `app/backend/src/routes/spells.ts`, añadir `export` a la función. Crear `app/backend/src/routes/spells.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseSpellDocument } from "./spells";

const SPELLS_FILE = path.resolve(
  __dirname,
  "../../../../data/srd/en/09_Spells.md"
);

describe("parseSpellDocument with the generated English SRD file", () => {
  const content = readFileSync(SPELLS_FILE, "utf-8");
  const spells = parseSpellDocument(content);

  it("parses at least 290 spells", () => {
    expect(Object.keys(spells).length).toBeGreaterThanOrEqual(290);
  });

  it("parses Fireball completely", () => {
    const f = spells["fireball"] ?? spells["Fireball"];
    expect(f).toBeDefined();
    expect(f!.level).toBe(3);
    expect(f!.school).toBe("Evocation");
    expect(f!.range).toBe("150 feet");
    expect(f!.components.material).toBe(true);
    expect(f!.higherLevels).toContain("1d6");
  });

  it("parses ritual and concentration flags", () => {
    const alarm = spells["alarm"] ?? spells["Alarm"];
    expect(alarm!.ritual).toBe(true);
    const hold = spells["hold person"] ?? spells["Hold Person"];
    expect(hold!.concentration).toBe(true);
  });

  it("parses cantrips as level 0", () => {
    const bolt = spells["fire bolt"] ?? spells["Fire Bolt"];
    expect(bolt!.level).toBe(0);
  });
});
```

Nota: comprobar cómo indexa `loadSpellsFromDocuments` el merge (¿clave en minúsculas?) mirando la línea ~168 de `spells.ts`, y usar SOLO esa variante de clave en los asserts. Si `parseSpellDocument` devuelve un array en vez de un record, adaptar los asserts a la firma real — la firma exacta manda, este test no debe redefinirla. Si el entorno de tests es ESM y `__dirname` no existe, usar `path.dirname(fileURLToPath(import.meta.url))` (import de `node:url`), replicando el patrón que use el resto del backend.

- [ ] **Step 5: Correr los tests del backend completos**

Run: `cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend" && pnpm test`
Expected: PASS todo (~130 tests previos + los nuevos).

- [ ] **Step 6: Retirar el fichero contaminado del árbol y commitear**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git rm data/srd/en/09_Hechizos.md
git add data/srd/en/09_Spells.md app/backend/src/db/srd-import.ts app/backend/src/routes/spells.ts app/backend/src/routes/spells.test.ts
git commit -m "feat(srd): hechizos del seed regenerados desde el texto SRD en inglés"
```

(El fichero viejo sigue en el historial — se purga en la Task 6.)

---

### Task 4: Mecanismo de contenido privado `data/private/`

**Files:**
- Modify: `app/backend/src/db/phb-import.ts` (constante `phbDir`, línea ~72)
- Modify: `.gitignore` (raíz)
- Delete: `data/phb2024/` (del árbol de trabajo y del index)

**Interfaces:**
- Consumes: copia privada de `~/dnd-private-content/phb2024/` (Task 1).
- Produces: `phb:import` leyendo de `data/private/phb2024/`; ruta `data/private/` ignorada por git para siempre.

- [ ] **Step 1: Redirigir el import PHB**

En `app/backend/src/db/phb-import.ts`, cambiar:

```ts
const phbDir = path.join(dataDir, "phb2024");
```

por:

```ts
// User-provided content (never committed): data/private/<source>/
const phbDir = path.join(dataDir, "private", "phb2024");
```

Y donde se compruebe la existencia del directorio, asegurar un error claro (si no existe ya un check, añadirlo justo después de la constante):

```ts
if (!existsSync(phbDir)) {
  console.error(
    `[phb-import] Private content directory not found: ${phbDir}\n` +
      `Place your own PHB 2024 markdown files there. This content is personal and must never be committed.`
  );
  process.exit(1);
}
```

(Importar `existsSync` de `node:fs` si no está. Si el check vive en `phb-import-cli.ts` en lugar del servicio, aplicar el cambio ahí — respetar la estructura existente.)

- [ ] **Step 2: Ignorar `data/private/` en git**

En `.gitignore`, dentro del bloque `# Data dirs (contain user data, never commit)`, añadir:

```
/data/private/
```

- [ ] **Step 3: Retirar `data/phb2024/` del index y mover el contenido a privado**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git rm -r data/phb2024
mkdir -p data/private
cp -r ~/dnd-private-content/phb2024 data/private/phb2024
```

- [ ] **Step 4: Verificar que git ignora el contenido privado**

Run: `cd "/media/inigo/Loki/Mis Repos/dnd-assistant" && git status --porcelain | rg "private"`
Expected: sin resultados (el directorio está ignorado).

- [ ] **Step 5: Verificar el import privado end-to-end**

Run: `cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend" && pnpm phb:import:force`
Expected: importa los 11 documentos PHB desde `data/private/phb2024/` sin errores.

- [ ] **Step 6: Correr tests y commitear**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend" && pnpm test
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add .gitignore app/backend/src/db/phb-import.ts app/backend/src/db/phb-import-cli.ts
git commit -m "feat(contenido): import PHB desde data/private/ (contenido propio del usuario, nunca commiteado)"
```

---

### Task 5: LICENSE, NOTICE y revisión de marca

**Files:**
- Create: `LICENSE`
- Create: `NOTICE`
- Modify: `README.md` (si existe; revisar menciones de marcas WotC)
- Verify: `data/core-rules/*.md` (auditar que no contenga texto con copyright)

**Interfaces:**
- Produces: repo con licencia MIT y atribución CC-BY-4.0, sin usos de marca problemáticos.

- [ ] **Step 1: LICENSE MIT**

Crear `LICENSE` con el texto MIT estándar:

```
MIT License

Copyright (c) 2026 Íñigo Muñoz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: NOTICE con la atribución CC-BY-4.0**

Crear `NOTICE`:

```
Little Master
Copyright (c) 2026 Íñigo Muñoz. Licensed under the MIT License (see LICENSE).

This project includes game content from the System Reference Document 5.2.1
("SRD 5.2.1") by Wizards of the Coast LLC, available at
https://www.dndbeyond.com/srd and licensed under the Creative Commons
Attribution 4.0 International License (CC-BY-4.0):
https://creativecommons.org/licenses/by/4.0/legalcode

Little Master is an independent product. It is not affiliated with, endorsed,
sponsored, or specifically approved by Wizards of the Coast LLC.
```

- [ ] **Step 3: Revisar README y marca**

Leer `README.md` (si existe). Sustituir usos de "D&D", "Dungeons & Dragons" o "Player's Handbook" como identidad del producto por la fórmula ya usada en `packages/shared/src/app-info.ts` ("Compatible con las reglas 5E (2024)"). Las menciones referenciales ("compatible con 5e", "SRD 5.2.1") son correctas y se mantienen. Añadir al README: sección breve de licencia (MIT + SRD CC-BY-4.0) y sección "Contenido propio" explicando `data/private/` (importar manuales propios localmente, nunca commitearlos).

- [ ] **Step 4: Auditar `data/core-rules/`**

Run: `bat "/media/inigo/Loki/Mis Repos/dnd-assistant/data/core-rules/"*.md`
Revisar que sea homebrew propio del usuario (reglas de mesa) y no texto copiado de manuales. Si contiene texto de manuales con copyright → PARAR y consultar al usuario antes de continuar.

- [ ] **Step 5: Commit**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add LICENSE NOTICE README.md
git commit -m "docs(legal): licencia MIT, NOTICE con atribución SRD CC-BY-4.0 y revisión de marca"
```

---

### Task 9: Monster data — picker vía API SRD, overlay privado y retirada del JSON (SE EJECUTA ENTRE LA 5 Y LA 6)

**Contexto:** `app/frontend/src/lib/monster-data.json` (802 KB, 607 criaturas) es contenido íntegramente con copyright (MM 2024 + productos tie-in), se empaqueta en el bundle del frontend y lo consume `MonsterPicker.tsx` por import estático. El backend ya sirve monstruos SRD legales: `GET /api/srd/monsters` (resumen `{name, cr, type, size, source?}`, ~196 monstruos) y `GET /api/srd/monsters/:name` (stat block completo `MonsterDetail`). `monster-import-cli.ts` lee el JSON desde la ruta del frontend; `scripts/parse-monsters-csv.ts` lo genera desde un CSV local nunca commiteado.

**Files:**
- Modify: `app/backend/src/routes/srd.ts` (overlay privado en `GET /monsters` y `GET /monsters/:name`)
- Test: `app/backend/src/routes/srd.test.ts` (nuevos tests del overlay, TDD)
- Modify: `app/backend/src/db/monster-import-cli.ts` (leer de `data/private/mm2024/monster-data.json`; check fatal ANTES del deleteMany de `--force`, mismo patrón que `phb-import-cli.ts`)
- Modify: `app/backend/src/db/monster-import.ts` (mensajes/comentarios de ruta)
- Modify: `scripts/parse-monsters-csv.ts` (`OUT_PATH` → `data/private/mm2024/monster-data.json`)
- Modify: `app/frontend/src/components/ui/MonsterPicker.tsx` (fetch a la API en vez de import estático)
- Modify: `app/frontend/src/app/npcs/page.tsx` (`applyMonster` consume el detalle de la API)
- Modify: `app/frontend/src/lib/api.ts` (métodos `srd.monsters(q?)` y `srd.monster(name)` si no existen)
- Modify: `README.md` (líneas ~9 y ~72: el MM ya no está "incluido en el repo"; documentar mecanismo privado como el del PHB)
- Delete: `app/frontend/src/lib/monster-data.json` (tras copiarlo a `data/private/mm2024/`)

**Interfaces:**
- Consumes: mecanismo `data/private/` (Task 4); endpoints SRD existentes en `srd.ts`.
- Produces: endpoints `/api/srd/monsters` y `/api/srd/monsters/:name` con overlay de `data/private/mm2024/monster-data.json` cuando existe (entradas privadas etiquetadas `source: "mm"`, ganan al SRD en duplicados por nombre; sin fichero privado el comportamiento es EXACTAMENTE el actual). Resumen ampliado con `ac?: number; hp?: number` opcionales (solo presentes en entradas privadas).

- [ ] **Step 1 (TDD): tests del overlay en `srd.test.ts`** — replicar el patrón de entorno del propio fichero (env vars + ficheros temporales). Casos: (a) sin fichero privado, `GET /monsters` devuelve solo SRD (comportamiento actual intacto); (b) con un fichero privado temporal de 2 entradas (una con nombre nuevo, otra duplicando un monstruo SRD del fixture), la lista incluye la nueva etiquetada `source: "mm"` y el duplicado lo sirve la versión privada; (c) `GET /monsters/:name` de una entrada privada devuelve el stat block completo mapeado (ver Step 2). RED antes de implementar.
- [ ] **Step 2: implementar el overlay en `srd.ts`** — leer `join(env.DATA_DIR, "private", "mm2024", "monster-data.json")` de forma perezosa y tolerante (si no existe o no parsea → overlay vacío, sin error). Mapear la forma del JSON privado (`MonsterEntry`: campos planos, `traits` como string separado por comas, `actions[]`, `bonusAction`/`reaction`/`legendaryActions` como strings, `spellcasting` string|null) a las formas de respuesta existentes (`SrdMonster` para lista con `ac`/`hp` opcionales; `MonsterDetail` para detalle: `traits` → array `{name, description:""}`, `bonusAction`/`reaction` → arrays de un elemento si no vacíos, `spellcasting` no nulo → trait adicional `{name: "Spellcasting", description}`). GREEN + suite backend completa.
- [ ] **Step 3: mover el JSON al mecanismo privado** — `mkdir -p data/private/mm2024 && cp app/frontend/src/lib/monster-data.json data/private/mm2024/ && git rm app/frontend/src/lib/monster-data.json`. Actualizar `monster-import-cli.ts` (ruta nueva + check fatal antes del deleteMany), `monster-import.ts` (mensajes), `parse-monsters-csv.ts` (OUT_PATH). Verificar `pnpm mm:import:force` end-to-end desde la ruta privada (10 documentos "MM 2024 — Monstruos …").
- [ ] **Step 4: frontend** — `MonsterPicker.tsx`: eliminar el import estático; cargar la lista vía `api.srd.monsters()` (SWR, como el resto de componentes), mantener búsqueda y filtro de CR en cliente; columnas AC/PV solo si la entrada las trae (privadas sí, SRD no). Al seleccionar: fetch del detalle `api.srd.monster(name)` y `applyMonster` adaptado a `MonsterDetail` (mapear `traits[]`/`actions[]`/`bonusActions[]`/`reactions[]` ya estructurados; conservar `formatCR`). `monster-types.ts`: conservar solo lo aún usado (`crToNumber`, `formatCR`, y `MonsterEntry` si el backend/CLI lo referencia — NO borrar tipos que el import privado siga necesitando).
- [ ] **Step 5: README** — líneas ~9 y ~72: retirar "incluido en el repo"/"integrado"; documentar que el picker usa el SRD (196 criaturas) y que quien tenga datos propios puede colocarlos en `data/private/mm2024/monster-data.json` para verlos integrados (mismo espíritu que la sección de contenido propio).
- [ ] **Step 6: verificación completa** — `pnpm typecheck` raíz; tests frontend (`cd app/frontend && pnpm test`) y backend verdes; `pnpm lint` frontend; levantar el backend y verificar con curl: `GET /api/srd/monsters` (con y sin fichero privado presente — renombrarlo temporalmente para el caso "sin") y `GET /api/srd/monsters/Zombie` (SRD) + un monstruo solo-privado.
- [ ] **Step 7: commit** — `feat(monstruos): picker vía API SRD con overlay privado y retirada del JSON con copyright` (un solo commit; sin push).

---

### Task 6: Purga del historial y force-push

**Files:**
- Todo el historial de git (reescritura completa).

**Interfaces:**
- Consumes: commits locales de las Tasks 2-5 (no tocan las rutas purgadas, sobreviven a la reescritura).
- Produces: historial público sin `data/phb2024/` ni `data/srd/en/09_Hechizos.md`.

**PRECONDICIONES (verificar TODAS antes de empezar):**
- Task 1 completada (bundle verificado).
- `git status` limpio (los ficheros de informes sueltos — `AUDIT-FULL.md`, `SEED-REPORT.md`, `VERIFY-REPORT.md`, `obsidian-vault/` — decidir con el usuario si se commitean, se mueven fuera o se ignoran ANTES de la purga; `git filter-repo` exige árbol limpio).
- Tests verdes.

- [ ] **Step 1: Instalar git-filter-repo si falta**

Run: `command -v git-filter-repo || pipx install git-filter-repo || pip install --user git-filter-repo`
Expected: `git-filter-repo --version` responde.

- [ ] **Step 2: Ejecutar la purga**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git filter-repo --force --invert-paths \
  --path data/phb2024 \
  --path data/srd/en/09_Hechizos.md \
  --path app/frontend/src/lib/monster-data.json
```

(`monster-data.json` nació en un único commit `65f3b15` sin renames previos — verificado con `git log --follow`.)

Nota: `git filter-repo` ELIMINA el remote `origin` como medida de seguridad — se re-añade en el Step 4.

- [ ] **Step 3: Verificar la purga**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git log --all --oneline -- data/phb2024 data/srd/en/09_Hechizos.md app/frontend/src/lib/monster-data.json
```
Expected: salida VACÍA.

```bash
git rev-list --all | head -50 | while read c; do git ls-tree -r --name-only "$c" | rg -q "phb2024|09_Hechizos|monster-data" && echo "CONTAMINADO: $c"; done; echo "scan done"
```
Expected: solo `scan done`, ningún `CONTAMINADO`.

Verificar también que el trabajo nuevo sobrevivió: `git log --oneline -6` debe mostrar los commits de las Tasks 2-5 (con SHAs nuevos) y `data/srd/en/09_Spells.md` debe existir.

- [ ] **Step 4: Re-añadir el remote y force-push (PUNTO DE NO RETORNO)**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git remote add origin git@github.com:inigo-munoz/little-master.git
git push --force origin main
```

NO pushear tags (`--tags`): los tags antiguos mueren con sus releases en la Task 7.

- [ ] **Step 5: Verificar en remoto**

Run: `gh api "repos/inigo-munoz/little-master/contents/data?ref=main" --jq '.[].name'`
Expected: lista SIN `phb2024`. Y `gh api "repos/inigo-munoz/little-master/contents/data/srd/en?ref=main" --jq '.[].name'` debe incluir `09_Spells.md` y NO `09_Hechizos.md`.

---

### Task 7: Releases — borrar las contaminadas y publicar v1.2.0

**Files:**
- Modify: `app/desktop/src-tauri/tauri.conf.json`, `app/desktop/src-tauri/Cargo.toml`, `app/desktop/package.json`, `packages/shared/src/app-info.ts` (bump a 1.2.0)
- GitHub: releases y tags remotos.

**Interfaces:**
- Consumes: historial limpio publicado (Task 6); workflow `release.yml` (dispara con push de tag `v*`, sincroniza versión desde el tag, corre tests, construye y publica).
- Produces: única release pública v1.2.0 sin contenido PHB.

- [ ] **Step 1: Inventariar y borrar TODAS las releases antiguas con sus tags**

```bash
gh release list --limit 100 --json tagName --jq '.[].tagName' | while read t; do
  gh release delete "$t" --yes --cleanup-tag
  echo "deleted: $t"
done
```

Expected: todas las releases v1.1.x (y anteriores si las hay) eliminadas. Verificar: `gh release list` vacío y `git ls-remote --tags origin` vacío. Si queda algún tag remoto suelto sin release: `git push origin --delete <tag>`.

- [ ] **Step 2: Borrar los tags locales antiguos**

Run: `cd "/media/inigo/Loki/Mis Repos/dnd-assistant" && git tag -l | rg "^v1\.[01]\." | xargs -r git tag -d`
Expected: tags v1.0.x/v1.1.x locales eliminados.

- [ ] **Step 3: Bump de versión a 1.2.0 (consistencia del repo)**

Editar los 4 ficheros (el CI ya sincroniza desde el tag en build, pero el repo mantiene los valores al día, como en releases anteriores):
- `app/desktop/src-tauri/tauri.conf.json`: `"version": "1.2.0"`
- `app/desktop/src-tauri/Cargo.toml`: `version = "1.2.0"`
- `app/desktop/package.json`: `"version": "1.2.0"`
- `packages/shared/src/app-info.ts`: `export const PRODUCT_VERSION = "1.2.0";`

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/desktop/src-tauri/tauri.conf.json app/desktop/src-tauri/Cargo.toml app/desktop/package.json packages/shared/src/app-info.ts
git commit -m "chore(release): bump versión a 1.2.0"
git push origin main
```

- [ ] **Step 4: Tag y release**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git tag v1.2.0
git push origin v1.2.0
```

Expected: el workflow `release.yml` arranca (job `test` → `build` matrix → `release`).

- [ ] **Step 5: Vigilar el workflow**

Run: `gh run watch --exit-status` (o `gh run list --workflow=release.yml --limit 1`)
Expected: verde. Si falla el job `test`, arreglar antes de reintentar (borrar tag, re-crear tras el fix).

- [ ] **Step 6: Verificar que el artefacto NO contiene PHB**

```bash
cd /tmp && mkdir -p release-check && cd release-check
gh release download v1.2.0 --repo inigo-munoz/little-master --pattern "*.deb"
dpkg -x *.deb extracted/
rg -l "Traducciones al español|PHB 2024" extracted/ || echo "CLEAN"
fd "09_Spells.md" extracted/ | head -1
```

Expected: `CLEAN` y la ruta de `09_Spells.md` dentro de los resources del paquete.

---

### Task 8: Verificación final y cierre

**Interfaces:**
- Consumes: repo publicado y release v1.2.0.
- Produces: evidencia de limpieza total; memoria persistida.

- [ ] **Step 1: Clon fresco desde GitHub y escaneo completo del historial**

```bash
cd /tmp && rm -rf lm-verify && git clone git@github.com:inigo-munoz/little-master.git lm-verify && cd lm-verify
git rev-list --all | wc -l
git log --all --oneline -- data/phb2024 data/srd/en/09_Hechizos.md
```
Expected: la segunda orden con salida VACÍA.

```bash
cd /tmp/lm-verify
git grep -l "[probe-redacted]" $(git rev-list --all) 2>/dev/null | head -5 || echo "CLEAN"
git grep -l "Mind Flayer" $(git rev-list --all) -- app/frontend 2>/dev/null | head -5 || echo "CLEAN-MM"
```
("[probe-redacted]" es una cadena única de la traducción PHB de Acid Arrow; "Mind Flayer" es Product Identity del monster-data.json purgado.)
Expected: `CLEAN` y `CLEAN-MM`.

- [ ] **Step 2: Smoke funcional local**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend"
npx tsx src/db/srd-import-cli.ts --force
pnpm test
```
Expected: 9 documentos SRD reimportados (con `09_Spells.md`), tests verdes. Arrancar el backend y comprobar `curl -s http://localhost:3001/api/spells/Fireball | head -c 400` → JSON con datos en inglés. Después, `pnpm phb:import:force` para restaurar el contenido privado del usuario en su BD local (los hechizos vuelven a verse en español localmente: el merge da prioridad a `official`).

- [ ] **Step 3: Persistir el cierre en memoria (engram)**

`mem_save` (project `little-master`, type `architecture`, topic_key `legal/contenido-wotc`) documentando: purga ejecutada, fecha, qué se eliminó, mecanismo `data/private/`, y la regla permanente "contenido de manuales con copyright JAMÁS se commitea — va en data/private/".

- [ ] **Step 4: Issue pública por los hechizos ausentes**

El generador recupera ~300 de los 339 hechizos del SRD (los restantes se pierden por corrupción de columnas del PDF fuente). Crear la issue en GitHub:

```bash
gh issue create --repo inigo-munoz/little-master \
  --title "Complete missing SRD spells lost to PDF column corruption" \
  --body "The SRD spell seed (data/srd/en/09_Spells.md, generated by pnpm srd:build-spells) contains ~300 of the 339 spells in the SRD 5.2.1 source text. The remainder are lost because the PDF-to-text extraction interleaved two-column content in 06_Trasfondos_y_Equipo.txt, so the builder cannot recognize those spell blocks. Fix: recover the affected blocks from the official SRD 5.2.1 document (CC-BY-4.0) and either repair the source text or add them manually to the generated file's source. Acceptance: spells.test.ts count assertion raised to 339."
```

- [ ] **Step 5: Actualizar CLAUDE.md del proyecto**

Añadir a `CLAUDE.md` (sección Architecture o nueva sección "Contenido"): `data/private/` es contenido personal del usuario, nunca se commitea; el seed público es SRD 5.2.1 CC-BY-4.0 exclusivamente; el fichero de hechizos del seed es `09_Spells.md` generado con `pnpm srd:build-spells`. Actualizar las referencias a `data/phb2024/` (sección "Contenido PHB 2024") para reflejar la nueva ruta privada. Commit: `docs: actualizar CLAUDE.md tras la remediación legal`.
