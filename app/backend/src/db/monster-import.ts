/**
 * Monster Manual 2024 Import
 *
 * Reads monster-data.json (608 creatures) and imports them as documents
 * into the DB, grouped by CR range. This makes monsters available for
 * semantic search by the AI assistant.
 *
 * Usage: npx tsx src/db/monster-import-cli.ts [--force]
 */

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

const SOURCE_TYPE = "official";
const AUTHORITY_LEVEL = "high";
const DOC_PREFIX = "MM 2024";

interface MonsterAction {
  name: string;
  description: string;
}

interface Monster {
  name: string;
  source: string;
  size: string;
  type: string;
  alignment: string;
  cr: string;
  xp: number;
  pb: number;
  ac: number;
  hp: number;
  speed: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  savingThrows: string;
  skills: string;
  vulnerabilities: string;
  resistances: string;
  conditionImmunities: string;
  damageImmunities: string;
  senses: string;
  passivePerception: number;
  languages: string;
  traits: string;
  legendaryResistances: number;
  actions: MonsterAction[];
  spellcasting: string | null;
  bonusAction: string;
  reaction: string;
  legendaryActions: string;
  lair: boolean;
}

interface CrGroup {
  label: string;
  min: number;
  max: number;
}

const CR_GROUPS: CrGroup[] = [
  { label: "CR 0",       min: 0,    max: 0 },
  { label: "CR 1/8–1/4", min: 0.01, max: 0.25 },
  { label: "CR 1/2–1",   min: 0.26, max: 1 },
  { label: "CR 2–3",     min: 2,    max: 3 },
  { label: "CR 4–5",     min: 4,    max: 5 },
  { label: "CR 6–8",     min: 6,    max: 8 },
  { label: "CR 9–11",    min: 9,    max: 11 },
  { label: "CR 12–15",   min: 12,   max: 15 },
  { label: "CR 16–20",   min: 16,   max: 20 },
  { label: "CR 21–30",   min: 21,   max: 30 },
];

function crToNumeric(cr: string): number {
  if (cr === "1/8") return 0.125;
  if (cr === "1/4") return 0.25;
  if (cr === "1/2") return 0.5;
  return parseFloat(cr) || 0;
}

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function monsterToMarkdown(m: Monster): string {
  const lines: string[] = [];

  lines.push(`## ${m.name}`);
  lines.push(`*${m.size} ${m.type}, ${m.alignment}*`);
  lines.push("");
  lines.push(`- **CA** ${m.ac} | **PG** ${m.hp} | **Velocidad** ${m.speed}`);
  lines.push(`- **CR** ${m.cr} (${m.xp.toLocaleString("es-ES")} XP) | **Bonificador de competencia** +${m.pb}`);
  lines.push("");

  lines.push(`| FUE | DES | CON | INT | SAB | CAR |`);
  lines.push(`|-----|-----|-----|-----|-----|-----|`);
  lines.push(`| ${m.str} (${mod(m.str)}) | ${m.dex} (${mod(m.dex)}) | ${m.con} (${mod(m.con)}) | ${m.int} (${mod(m.int)}) | ${m.wis} (${mod(m.wis)}) | ${m.cha} (${mod(m.cha)}) |`);
  lines.push("");

  if (m.savingThrows) lines.push(`- **Tiradas de salvación** ${m.savingThrows}`);
  if (m.skills) lines.push(`- **Habilidades** ${m.skills}`);
  if (m.vulnerabilities) lines.push(`- **Vulnerabilidades** ${m.vulnerabilities}`);
  if (m.resistances) lines.push(`- **Resistencias** ${m.resistances}`);
  if (m.damageImmunities) lines.push(`- **Inmunidades al daño** ${m.damageImmunities}`);
  if (m.conditionImmunities) lines.push(`- **Inmunidades a condiciones** ${m.conditionImmunities}`);

  const senseParts: string[] = [];
  if (m.senses) senseParts.push(m.senses);
  senseParts.push(`percepción pasiva ${m.passivePerception}`);
  lines.push(`- **Sentidos** ${senseParts.join(", ")}`);

  if (m.languages && m.languages !== "None") lines.push(`- **Idiomas** ${m.languages}`);

  if (m.traits) {
    lines.push("");
    lines.push(`**Rasgos.** ${m.traits}`);
  }

  if (m.legendaryResistances > 0) {
    lines.push(`**Resistencia legendaria (${m.legendaryResistances}/día).**`);
  }

  if (m.actions.length > 0) {
    lines.push("");
    lines.push("### Acciones");
    for (const a of m.actions) {
      lines.push(`- **${a.name}.** ${a.description}`);
    }
  }

  if (m.spellcasting) {
    lines.push("");
    lines.push(`### Lanzamiento de conjuros`);
    lines.push(m.spellcasting);
  }

  if (m.bonusAction) {
    lines.push("");
    lines.push(`### Acciones adicionales`);
    lines.push(m.bonusAction);
  }

  if (m.reaction) {
    lines.push("");
    lines.push(`### Reacciones`);
    lines.push(m.reaction);
  }

  if (m.legendaryActions) {
    lines.push("");
    lines.push(`### Acciones legendarias`);
    lines.push(m.legendaryActions);
  }

  if (m.lair) {
    lines.push("");
    lines.push(`*Esta criatura tiene acciones de guarida.*`);
  }

  lines.push("");
  return lines.join("\n");
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const sections = text.split(/\n(?=## )/);

  let current = "";
  for (const section of sections) {
    if ((current + section).length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(" ");
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 6));
      current = overlapWords.join(" ") + "\n" + section;
    } else {
      current = current ? current + "\n" + section : section;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 0);
}

export async function importMonsters(
  prisma: PrismaClient,
  dataDir: string,
  monsterJsonPath: string,
  opts: { forceReimport?: boolean; verbose?: boolean } = {}
): Promise<{ imported: number; skipped: number; totalMonsters: number; errors: string[] }> {
  const { forceReimport = false, verbose = true } = opts;
  const documentsDir = path.join(dataDir, "documents", "global");

  const log = verbose ? console.log : () => {};
  const results = { imported: 0, skipped: 0, totalMonsters: 0, errors: [] as string[] };

  if (!existsSync(monsterJsonPath)) {
    results.errors.push(`monster-data.json no encontrado: ${monsterJsonPath}`);
    return results;
  }

  const raw = await fs.readFile(monsterJsonPath, "utf-8");
  const monsters: Monster[] = JSON.parse(raw);
  results.totalMonsters = monsters.length;

  log(`  Cargados ${monsters.length} monstruos de monster-data.json`);

  await fs.mkdir(documentsDir, { recursive: true });

  for (const group of CR_GROUPS) {
    const groupMonsters = monsters.filter((m) => {
      const cr = crToNumeric(m.cr);
      return cr >= group.min && cr <= group.max;
    });

    if (groupMonsters.length === 0) continue;

    const docTitle = `${DOC_PREFIX} — Monstruos ${group.label}`;

    if (!forceReimport) {
      const existing = await prisma.document.findFirst({
        where: { title: docTitle, sourceType: SOURCE_TYPE },
      });
      if (existing) {
        log(`  ↷ Ya existe: ${docTitle} (${groupMonsters.length} criaturas)`);
        results.skipped++;
        continue;
      }
    }

    const header = `# Monster Manual 2024 — ${group.label}\n\n${groupMonsters.length} criaturas en este rango de desafío.\n\n`;
    const body = groupMonsters.map(monsterToMarkdown).join("\n---\n\n");
    const content = header + body;

    try {
      const docId = crypto.randomUUID();
      const relativePath = path.join("global", `mm_${docId}.md`);
      const absolutePath = path.join(dataDir, "documents", relativePath);
      await fs.writeFile(absolutePath, content, "utf-8");

      const document = await prisma.document.create({
        data: {
          id: docId,
          title: docTitle,
          path: relativePath,
          contentType: "markdown",
          sourceType: SOURCE_TYPE,
          authorityLevel: AUTHORITY_LEVEL,
          version: "2024",
          campaignId: null,
          isIndexed: false,
          chunkCount: 0,
        },
      });

      const chunks = chunkText(content);
      await prisma.documentChunk.createMany({
        data: chunks.map((chunkContent, i) => ({
          documentId: document.id,
          campaignId: null,
          content: chunkContent,
          chunkIndex: i,
          sourceType: SOURCE_TYPE,
          authorityLevel: AUTHORITY_LEVEL,
          embeddingJson: null,
        })),
      });

      await prisma.document.update({
        where: { id: document.id },
        data: { isIndexed: true, chunkCount: chunks.length },
      });

      log(`  ✓ Importado: ${docTitle} — ${groupMonsters.length} criaturas, ${chunks.length} chunks`);
      results.imported++;
    } catch (err) {
      const msg = `Error importando ${docTitle}: ${err}`;
      results.errors.push(msg);
      log(`  ✗ ${msg}`);
    }
  }

  return results;
}
