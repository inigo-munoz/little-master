import type { FastifyPluginAsync } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";

export interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  materialDesc: string;
  consumed: boolean;
  hasCost: boolean;
}

export interface SpellFullData {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: SpellComponents;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels: string | null;
}

let _cache: Record<string, SpellFullData> | null = null;

function parseComponents(compStr: string): SpellComponents {
  const verbal = /\bV\b/.test(compStr);
  const somatic = /\bS\b/.test(compStr);
  const material = /\bM\b/.test(compStr);
  const matDescM = compStr.match(/M\s*\(([^)]+)\)/);
  const materialDesc = (matDescM?.[1] ?? "").trim();
  const consumed = /se consume|consumed/i.test(materialDesc);
  const hasCost = /\d+\+?\s*(PO|GP|gp)/i.test(materialDesc);
  return { verbal, somatic, material, materialDesc, consumed, hasCost };
}

export function parseSpellDocument(content: string): Record<string, SpellFullData> {
  const result: Record<string, SpellFullData> = {};
  const rawBlocks = content.split(/\n## /);

  for (let i = 1; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    if (!block) continue;

    const lines = block
      .split("\n")
      .map(l => l.trim())
      .filter(l => l !== "" && l !== "---");

    if (lines.length < 3) continue;

    const name = lines[0] ?? "";
    const typeLine = lines[1] ?? "";
    const statsLine = lines[2] ?? "";

    let level = 0;
    let school = "";

    // Spanish: "Truco de Escuela" / "Nivel N, Escuela"
    const cantripEs = typeLine.match(/^Truco de ([^(]+?)(?:\s*\(|$)/);
    const levelEs = typeLine.match(/^Nivel (\d+), ([^(,]+?)(?:\s*\(|$)/);
    // English: "Cantrip, School" / "Level N, School"
    const cantripEn = typeLine.match(/^Cantrip, ([^(]+?)(?:\s*\(|$)/);
    const levelEn = typeLine.match(/^Level (\d+), ([^(,]+?)(?:\s*\(|$)/);

    if (cantripEs?.[1] !== undefined) {
      school = cantripEs[1].trim();
    } else if (levelEs?.[1] !== undefined && levelEs?.[2] !== undefined) {
      level = parseInt(levelEs[1]);
      school = levelEs[2].trim();
    } else if (cantripEn?.[1] !== undefined) {
      school = cantripEn[1].trim();
    } else if (levelEn?.[1] !== undefined && levelEn?.[2] !== undefined) {
      level = parseInt(levelEn[1]);
      school = levelEn[2].trim();
    } else {
      continue;
    }

    const concentration = /\[C\]|\[C\/Ritual\]|\[Ritual,\s*C\]/.test(typeLine);
    const ritual = /\[Ritual\]|\[C\/Ritual\]|\[Ritual,\s*C\]/.test(typeLine);

    // Spanish: "Tiempo: X | Alcance: X | Comp: X | Duración: X"
    const statsEs = statsLine.match(
      /Tiempo:\s*([^|]+)\|?\s*Alcance:\s*([^|]+)\|?\s*Comp:\s*([^|]+)\|?\s*Duraci[oó]n:\s*(.+)/
    );
    // English: "Casting Time: X | Range: X | Components: X | Duration: X"
    const statsEn = statsLine.match(
      /Casting Time:\s*([^|]+)\|?\s*Range:\s*([^|]+)\|?\s*Components?:\s*([^|]+)\|?\s*Duration:\s*(.+)/
    );

    const stats = statsEs ?? statsEn;
    if (!stats) continue;

    const castingTime = (stats[1] ?? "").trim();
    const range = (stats[2] ?? "").trim();
    const compStr = (stats[3] ?? "").trim();
    const duration = (stats[4] ?? "").trim();

    let higherLevels: string | null = null;
    const descParts: string[] = [];

    for (let j = 3; j < lines.length; j++) {
      const line = lines[j] ?? "";
      if (line.startsWith("*Ranura superior:*")) {
        higherLevels = line.replace(/^\*Ranura superior:\*\s*/, "").trim();
      } else if (line.startsWith("*Mejora de Truco:*")) {
        higherLevels = line.replace(/^\*Mejora de Truco:\*\s*/, "").trim();
      } else if (line.startsWith("*Higher Level:*")) {
        higherLevels = line.replace(/^\*Higher Level:\*\s*/, "").trim();
      } else if (line.startsWith("*Cantrip Upgrade:*")) {
        higherLevels = line.replace(/^\*Cantrip Upgrade:\*\s*/, "").trim();
      } else {
        descParts.push(line);
      }
    }

    result[name] = {
      name, level, school, castingTime, range, duration,
      components: parseComponents(compStr),
      concentration, ritual,
      description: descParts.join(" ").trim(),
      higherLevels,
    };
  }

  return result;
}

async function loadSpellsFromDocuments(): Promise<Record<string, SpellFullData>> {
  if (_cache) return _cache;

  const merged: Record<string, SpellFullData> = {};

  const spellDocs = await prisma.document.findMany({
    where: {
      OR: [
        { sourceType: "srd", title: { contains: "Spells" } },
        { sourceType: "srd", title: { contains: "Hechizos" } },
        { sourceType: "official", title: { contains: "Hechizos" } },
        { sourceType: "official", title: { contains: "Spells" } },
      ],
    },
    select: { path: true, sourceType: true },
    orderBy: { sourceType: "asc" },
  });

  for (const doc of spellDocs) {
    const filePath = join(env.DATA_DIR, "documents", doc.path);

    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch {
      console.warn(`[spells] Could not read spell document: ${filePath}`);
      continue;
    }

    const parsed = parseSpellDocument(content);

    for (const [name, spell] of Object.entries(parsed)) {
      if (!merged[name] || doc.sourceType === "official") {
        merged[name] = spell;
      }
    }
  }

  _cache = merged;
  return merged;
}

export function invalidateSpellCache(): void {
  _cache = null;
}

export const spellRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Params: { name: string } }>("/:name", async (request) => {
    const spells = await loadSpellsFromDocuments();
    const spell = spells[decodeURIComponent(request.params.name)];
    return { success: true, data: spell ?? null };
  });
};
