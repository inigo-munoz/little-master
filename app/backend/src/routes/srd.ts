import type { FastifyPluginAsync } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";

async function buildDocumentList(docs: { id: string; title: string; version: string; isIndexed: boolean; authorityLevel?: string }[]) {
  return Promise.all(
    docs.map(async (doc) => {
      const [totalChunks, embeddedChunks] = await Promise.all([
        prisma.documentChunk.count({ where: { documentId: doc.id } }),
        prisma.documentChunk.count({
          where: { documentId: doc.id, embeddingJson: { not: null } },
        }),
      ]);
      return {
        id: doc.id,
        title: doc.title,
        version: doc.version,
        isIndexed: doc.isIndexed,
        chunkCount: totalChunks,
        embeddedChunks,
        ...(doc.authorityLevel !== undefined && { authorityLevel: doc.authorityLevel }),
      };
    })
  );
}

function summarize(documents: { chunkCount: number; embeddedChunks: number; isIndexed: boolean }[]) {
  const totalChunks = documents.reduce((s, d) => s + d.chunkCount, 0);
  const embeddedChunks = documents.reduce((s, d) => s + d.embeddedChunks, 0);
  const coverage = totalChunks > 0 ? Math.round((embeddedChunks / totalChunks) * 100) : 0;
  return { totalChunks, embeddedChunks, coverage };
}

// ─── Monster extraction ───────────────────────────────────────────────────────

const SIZE_WORDS = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const CREATURE_TYPES = [
  "Aberration", "Beast", "Celestial", "Construct", "Dragon", "Elemental",
  "Fey", "Fiend", "Giant", "Humanoid", "Monstrosity", "Ooze", "Plant", "Swarm", "Undead",
];
const GARBAGE_STARTS = [
  "MOD", "Str ", "Dex ", "Con ", "Int ", "Wis ", "Cha ",
  "Skills", "Senses", "Languages", "Immunities", "Actions", "Traits",
  "Bonus", "System Reference", "Speed", "Initiative", "AC ", "CR ", "HP ",
  "Resistances", "Reactions", "Legendary", "Damage", "Condition", "Gear",
  "At Will", "Recharge", "Passive", "Spellcasting", "Saving", "Attack", "Hit:",
];

function isTypeLine(line: string): boolean {
  const hasSize = SIZE_WORDS.some((s) => line.startsWith(s));
  const hasType = CREATURE_TYPES.some((t) => line.includes(t));
  return (hasSize || hasType) && line.includes(",");
}

function isGarbage(line: string): boolean {
  if (!line || line.length < 2) return true;
  if (/^\d/.test(line)) return true;
  if (/^[+\-−]/.test(line)) return true;
  return GARBAGE_STARTS.some((g) => line.startsWith(g));
}

function isValidName(line: string): boolean {
  if (!line || line.length < 3 || line.length > 50) return false;
  if (!/^[A-Z]/.test(line)) return false;
  if (isGarbage(line)) return false;
  if (isTypeLine(line)) return false;
  if (line.includes(". ")) return false; // sentence fragment (trait description)
  if (line.includes(":")) return false;  // ability description
  if (line.endsWith(".")) return false;
  return true;
}

interface SrdMonster { name: string; cr: string; type: string; size: string }

function extractMonstersFromText(text: string): SrdMonster[] {
  const lines = text.split("\n").map((l) => l.trim());
  const monstersMap = new Map<string, SrdMonster>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!/^AC \d+/.test(line)) continue;

    // Find CR after AC line (within next 50 lines)
    let cr = "";
    for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
      const m = (lines[j] ?? "").match(/^CR ([\d\/]+)\s*\(/);
      if (m?.[1]) { cr = m[1]; break; }
    }
    if (!cr) continue;

    // Find type line before AC line (within previous 8 lines)
    let typeIdx = -1;
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      if (isTypeLine(lines[j] ?? "")) { typeIdx = j; break; }
    }
    if (typeIdx === -1) continue;

    const typeLine = lines[typeIdx] ?? "";
    const sizeM = typeLine.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)/);
    const size = sizeM?.[1] ?? "";
    const type = typeLine.replace(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s*/, "").split(",")[0]?.trim() ?? "";

    // Find name before type line (within previous 4 lines)
    let name = "";
    for (let j = typeIdx - 1; j >= Math.max(0, typeIdx - 4); j--) {
      if (isValidName(lines[j] ?? "")) { name = lines[j] ?? ""; break; }
    }

    if (name && !monstersMap.has(name)) {
      monstersMap.set(name, { name, cr, type, size });
    }
  }

  return Array.from(monstersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Monster stat block extraction ───────────────────────────────────────────

export interface MonsterDetail {
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: string;
  hp: string;
  speed: string;
  initiative: string;
  str: number | null;
  dex: number | null;
  con: number | null;
  int: number | null;
  wis: number | null;
  cha: number | null;
  savingThrows: string;
  skills: string;
  resistances: string;
  immunities: string;
  conditionImmunities: string;
  vulnerabilities: string;
  senses: string;
  languages: string;
  cr: string;
  xp: string;
  profBonus: string;
  traits: { name: string; description: string }[];
  actions: { name: string; description: string }[];
  bonusActions: { name: string; description: string }[];
  reactions: { name: string; description: string }[];
  legendaryActions: { name: string; description: string }[];
  rawText: string;
}

/** Extracts a named section of ability-like entries (Traits, Actions, etc.) */
function parseSectionEntries(
  lines: string[],
  startIdx: number,
  endIdx: number
): { name: string; description: string }[] {
  const entries: { name: string; description: string }[] = [];
  let i = startIdx;
  while (i < endIdx) {
    const line = lines[i] ?? "";
    if (!line) { i++; continue; }

    // Inline format: "Name. Description text..."
    const inlineDot = line.match(/^([A-Z][^.]{1,60})\.\s+(.+)/);
    if (inlineDot) {
      const name = inlineDot[1]?.trim() ?? "";
      let desc = inlineDot[2]?.trim() ?? "";
      // Continuation lines
      let j = i + 1;
      while (j < endIdx) {
        const next = lines[j] ?? "";
        if (!next || /^[A-Z]/.test(next)) break;
        desc += " " + next;
        j++;
      }
      entries.push({ name, description: desc });
      i = j;
      continue;
    }

    // Block format: name on its own line, description follows
    if (/^[A-Z]/.test(line) && line.length < 60 && !line.endsWith(".")) {
      const name = line;
      let desc = "";
      let j = i + 1;
      while (j < endIdx) {
        const next = lines[j] ?? "";
        if (!next) { j++; continue; }
        // Stop when a new entry starts (short capitalized line)
        if (/^[A-Z]/.test(next) && next.length < 60 && !next.endsWith(".") && !desc) { break; }
        if (/^[A-Z]/.test(next) && next.length < 60 && !next.match(/^[A-Z][a-z].*\./)) { break; }
        desc += (desc ? " " : "") + next;
        j++;
        // If this line ends a paragraph, stop collecting
        if (next.endsWith(".") || next.endsWith("!") || next.endsWith("?")) {
          // Check next line — if it starts a new entry, break
          const afterDesc = lines[j] ?? "";
          if (!afterDesc || (/^[A-Z]/.test(afterDesc) && afterDesc.length < 60)) break;
        }
      }
      if (desc) entries.push({ name, description: desc });
      i = j;
      continue;
    }

    i++;
  }
  return entries;
}

function parseAbilityScores(lines: string[]): {
  str: number | null; dex: number | null; con: number | null;
  int: number | null; wis: number | null; cha: number | null;
} {
  const nulls = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    // Inline: "STR 8 (-1) DEX 14 (+2) CON 10 (+0) INT 10 (+0) WIS 8 (-1) CHA 8 (-1)"
    const inline = line.match(
      /STR\s+(\d+)\s*\([^)]+\)\s+DEX\s+(\d+)\s*\([^)]+\)\s+CON\s+(\d+)\s*\([^)]+\)\s+INT\s+(\d+)\s*\([^)]+\)\s+WIS\s+(\d+)\s*\([^)]+\)\s+CHA\s+(\d+)/i
    );
    if (inline) {
      return {
        str: parseInt(inline[1] ?? "10"),
        dex: parseInt(inline[2] ?? "10"),
        con: parseInt(inline[3] ?? "10"),
        int: parseInt(inline[4] ?? "10"),
        wis: parseInt(inline[5] ?? "10"),
        cha: parseInt(inline[6] ?? "10"),
      };
    }

    // Tabular: "STR DEX CON INT WIS CHA" header, numbers on next lines
    if (/^STR\s+DEX\s+CON\s+INT\s+WIS\s+CHA/i.test(line)) {
      // Try to collect 6 numbers from subsequent lines
      const nums: number[] = [];
      for (let j = i + 1; j < Math.min(i + 6, lines.length) && nums.length < 6; j++) {
        const m = (lines[j] ?? "").match(/^(\d+)/);
        if (m) nums.push(parseInt(m[1] ?? "10"));
      }
      if (nums.length === 6) {
        return { str: nums[0]!, dex: nums[1]!, con: nums[2]!, int: nums[3]!, wis: nums[4]!, cha: nums[5]! };
      }
      // Numbers all on one next line
      const numLine = lines[i + 1] ?? "";
      const allNums = numLine.match(/\d+/g);
      if (allNums && allNums.length >= 6) {
        return {
          str: parseInt(allNums[0] ?? "10"),
          dex: parseInt(allNums[1] ?? "10"),
          con: parseInt(allNums[2] ?? "10"),
          int: parseInt(allNums[3] ?? "10"),
          wis: parseInt(allNums[4] ?? "10"),
          cha: parseInt(allNums[5] ?? "10"),
        };
      }
    }
  }
  return nulls;
}

const SECTION_NAMES = ["Traits", "Actions", "Bonus Actions", "Reactions", "Legendary Actions", "Villain Actions"];

function extractMonsterStatBlock(text: string, targetName: string): MonsterDetail | null {
  const lines = text.split("\n").map((l) => l.trim());

  // Build monster index: (name, nameLineIdx, acLineIdx)
  const index: Array<{ name: string; nameLine: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!/^AC \d+/.test(line)) continue;

    let cr = "";
    for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
      if ((lines[j] ?? "").match(/^CR ([\d\/]+)\s*\(/)) { cr = "found"; break; }
    }
    if (!cr) continue;

    let typeIdx = -1;
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      if (isTypeLine(lines[j] ?? "")) { typeIdx = j; break; }
    }
    if (typeIdx === -1) continue;

    for (let j = typeIdx - 1; j >= Math.max(0, typeIdx - 4); j--) {
      if (isValidName(lines[j] ?? "")) {
        index.push({ name: lines[j] ?? "", nameLine: j });
        break;
      }
    }
  }

  const targetIdx = index.findIndex(
    (m) => m.name.toLowerCase() === targetName.toLowerCase()
  );
  if (targetIdx === -1) return null;

  const startLine = index[targetIdx]!.nameLine;
  const endLine = index[targetIdx + 1]
    ? index[targetIdx + 1]!.nameLine - 1
    : Math.min(startLine + 250, lines.length - 1);

  const block = lines.slice(startLine, endLine + 1).filter((l) => l.length > 0);
  const rawText = block.join("\n");

  // ── Parse fields ────────────────────────────────────────────────────────────
  const get = (pattern: RegExp): string => {
    for (const l of block) {
      const m = l.match(pattern);
      if (m) return m[1]?.trim() ?? "";
    }
    return "";
  };

  const name = block[0] ?? targetName;

  // Type line: "Small Humanoid, Neutral Evil"
  let size = "", type = "", alignment = "";
  for (const l of block) {
    if (isTypeLine(l)) {
      const sizeM = l.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)/);
      size = sizeM?.[1] ?? "";
      const rest = l.replace(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s*/, "");
      const parts = rest.split(",");
      type = parts[0]?.trim() ?? "";
      alignment = parts[1]?.trim() ?? "";
      break;
    }
  }

  const ac = get(/^AC (.+)/);
  const hp = get(/^HP (.+)/);
  const speed = get(/^Speed (.+)/);
  const initiative = get(/^Initiative (.+)/);
  const savingThrows = get(/^Saving Throws (.+)/);
  const skills = get(/^Skills (.+)/);
  const resistances = get(/^Resistances (.+)/);
  const immunities = get(/^Immunities (.+)/);
  const conditionImmunities = get(/^Condition Immunities (.+)/);
  const vulnerabilities = get(/^Vulnerabilities (.+)/);
  const senses = get(/^Senses (.+)/);
  const languages = get(/^Languages (.+)/);

  let cr = "", xp = "", profBonus = "";
  for (const l of block) {
    const m = l.match(/^CR ([\d\/]+)\s*\(([^)]+)\)/);
    if (m) {
      cr = m[1] ?? "";
      const detail = m[2] ?? "";
      const xpM = detail.match(/([\d,]+)\s*XP/);
      const pbM = detail.match(/PB\s*([+\-]\d+)/);
      xp = xpM ? (xpM[1] ?? "") + " XP" : "";
      profBonus = pbM ? (pbM[1] ?? "") : "";
      break;
    }
  }

  const abilityScores = parseAbilityScores(block);

  // ── Section parsing ─────────────────────────────────────────────────────────
  // Find indices of each section header within the block
  const sectionMap: Record<string, number> = {};
  for (let i = 0; i < block.length; i++) {
    const l = block[i] ?? "";
    for (const sec of SECTION_NAMES) {
      if (l === sec || l === sec.toUpperCase()) {
        sectionMap[sec] = i;
        break;
      }
    }
  }

  // Everything before the first section header (or before CR line) is preamble + traits
  const crLineIdx = block.findIndex((l) => /^CR [\d\/]+/.test(l));
  const firstSectionIdx = Object.values(sectionMap).length > 0
    ? Math.min(...Object.values(sectionMap))
    : block.length;

  const traitsStart = crLineIdx >= 0 ? crLineIdx + 1 : firstSectionIdx;
  const traitsEnd = sectionMap["Traits"] !== undefined
    ? (Object.values(sectionMap).filter((v) => v > sectionMap["Traits"]!)[0] ?? block.length)
    : firstSectionIdx;

  // If there's an explicit "Traits" section header, use what's after it;
  // otherwise treat the gap between CR line and first section as traits
  const traitsLines = sectionMap["Traits"] !== undefined
    ? block.slice((sectionMap["Traits"] ?? 0) + 1, traitsEnd)
    : block.slice(traitsStart, firstSectionIdx);

  const getSection = (name: string): { name: string; description: string }[] => {
    const start = sectionMap[name];
    if (start === undefined) return [];
    const nextSectionStarts = Object.values(sectionMap)
      .filter((v) => v > start)
      .sort((a, b) => a - b);
    const end = nextSectionStarts[0] ?? block.length;
    return parseSectionEntries(block, start + 1, end);
  };

  const traits = parseSectionEntries(block, 0, block.length).length > 0
    ? parseSectionEntries(traitsLines, 0, traitsLines.length)
    : getSection("Traits");

  return {
    name,
    size,
    type,
    alignment,
    ac,
    hp,
    speed,
    initiative,
    ...abilityScores,
    savingThrows,
    skills,
    resistances,
    immunities,
    conditionImmunities,
    vulnerabilities,
    senses,
    languages,
    cr,
    xp,
    profBonus,
    traits: sectionMap["Traits"] !== undefined ? getSection("Traits") : parseSectionEntries(traitsLines, 0, traitsLines.length),
    actions: getSection("Actions"),
    bonusActions: getSection("Bonus Actions"),
    reactions: getSection("Reactions"),
    legendaryActions: getSection("Legendary Actions"),
    rawText,
  };
}

export const srdRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/status", async (_req, reply) => {
    const docs = await prisma.document.findMany({
      where: { sourceType: "srd" },
      orderBy: { title: "asc" },
    });

    const documents = await buildDocumentList(docs);
    const { totalChunks, embeddedChunks, coverage } = summarize(documents);
    const fullyImported = documents.length >= 8 && documents.every((d) => d.isIndexed);

    return reply.send({
      success: true,
      data: {
        documents,
        totalDocuments: documents.length,
        totalChunks,
        embeddedChunks,
        coverage,
        fullyImported,
        version: "5.2.1",
      },
    });
  });

  fastify.get<{ Querystring: { q?: string } }>("/monsters", async (req, reply) => {
    const { q } = req.query;

    // Leer el fichero del documento SRD de monstruos directamente
    // (los chunks tienen solapamiento que confunde la extracción por regex)
    const doc = await prisma.document.findFirst({
      where: { sourceType: "srd", title: { contains: "Monster" } },
      select: { path: true },
    });

    if (!doc) {
      return reply.send({ success: true, data: [] });
    }

    let text: string;
    try {
      text = await readFile(join(env.DOCUMENTS_DIR, doc.path), "utf-8");
    } catch {
      return reply.send({ success: true, data: [] });
    }

    let monsters = extractMonstersFromText(text);

    if (q) {
      const lower = q.toLowerCase();
      monsters = monsters.filter((m) => m.name.toLowerCase().includes(lower));
    }

    return reply.send({ success: true, data: monsters });
  });

  fastify.get<{ Params: { name: string } }>("/monsters/:name", async (req, reply) => {
    const { name } = req.params;

    const doc = await prisma.document.findFirst({
      where: { sourceType: "srd", title: { contains: "Monster" } },
      select: { path: true },
    });
    if (!doc) return reply.send({ success: true, data: null });

    let text: string;
    try {
      text = await readFile(join(env.DOCUMENTS_DIR, doc.path), "utf-8");
    } catch {
      return reply.send({ success: true, data: null });
    }

    const detail = extractMonsterStatBlock(text, name);
    return reply.send({ success: true, data: detail });
  });

  fastify.get("/custom-rules", async (_req, reply) => {
    const docs = await prisma.document.findMany({
      where: {
        campaignId: null,
        sourceType: { not: "srd" },
      },
      orderBy: { title: "asc" },
    });

    const documents = await buildDocumentList(
      docs.map((d) => ({ ...d, authorityLevel: d.authorityLevel }))
    );
    const { totalChunks, embeddedChunks, coverage } = summarize(documents);

    return reply.send({
      success: true,
      data: {
        documents,
        totalDocuments: documents.length,
        totalChunks,
        embeddedChunks,
        coverage,
      },
    });
  });
};
