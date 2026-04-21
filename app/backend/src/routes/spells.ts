import type { FastifyPluginAsync } from "fastify";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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

function parseSpells(content: string): Record<string, SpellFullData> {
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

    const cantripM = typeLine.match(/^Truco de ([^(]+?)(?:\s*\(|$)/);
    const levelM = typeLine.match(/^Nivel (\d+), ([^(,]+?)(?:\s*\(|$)/);

    if (cantripM?.[1] !== undefined) {
      level = 0;
      school = cantripM[1].trim();
    } else if (levelM?.[1] !== undefined && levelM?.[2] !== undefined) {
      level = parseInt(levelM[1]);
      school = levelM[2].trim();
    } else {
      continue;
    }

    const concentration = /\[C\]|\[C\/Ritual\]|\[Ritual,\s*C\]/.test(typeLine);
    const ritual = /\[Ritual\]|\[C\/Ritual\]|\[Ritual,\s*C\]/.test(typeLine);

    // Stats line: "Tiempo: X | Alcance: X | Comp: V[, S][, M (desc)] | Duración: X"
    const statsM = statsLine.match(
      /Tiempo:\s*([^|]+)\|?\s*Alcance:\s*([^|]+)\|?\s*Comp:\s*([^|]+)\|?\s*Duración:\s*(.+)/
    );
    if (!statsM) continue;

    const castingTime = (statsM[1] ?? "").trim();
    const range = (statsM[2] ?? "").trim();
    const compStr = (statsM[3] ?? "").trim();
    const duration = (statsM[4] ?? "").trim();

    const verbal = /\bV\b/.test(compStr);
    const somatic = /\bS\b/.test(compStr);
    const material = /\bM\b/.test(compStr);
    const matDescM = compStr.match(/M\s*\(([^)]+)\)/);
    const materialDesc = (matDescM?.[1] ?? "").trim();
    const consumed = /se consume/i.test(materialDesc);
    const hasCost = /\d+\+?\s*PO/.test(materialDesc);

    let higherLevels: string | null = null;
    const descParts: string[] = [];

    for (let j = 3; j < lines.length; j++) {
      const line = lines[j] ?? "";
      if (line.startsWith("*Ranura superior:*")) {
        higherLevels = line.replace(/^\*Ranura superior:\*\s*/, "").trim();
      } else if (line.startsWith("*Mejora de Truco:*")) {
        higherLevels = line.replace(/^\*Mejora de Truco:\*\s*/, "").trim();
      } else {
        descParts.push(line);
      }
    }

    result[name] = {
      name, level, school, castingTime, range, duration,
      components: { verbal, somatic, material, materialDesc, consumed, hasCost },
      concentration, ritual,
      description: descParts.join(" ").trim(),
      higherLevels,
    };
  }

  return result;
}

async function loadSpells(): Promise<Record<string, SpellFullData>> {
  if (_cache) return _cache;
  const filePath = join(resolve(env.DATA_DIR), "phb2024", "hechizos-completos.md");
  const content = await readFile(filePath, "utf-8");
  _cache = parseSpells(content);
  return _cache;
}

export const spellRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Params: { name: string } }>("/:name", async (request) => {
    const spells = await loadSpells();
    const spell = spells[decodeURIComponent(request.params.name)];
    return { success: true, data: spell ?? null };
  });
};
