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

interface SrdMonster {
  name: string;
  cr: string;
  type: string;
  size: string;
  source?: "srd" | "phb" | "mm";
  ac?: number;
  hp?: number;
}

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

// ─── PHB 2024 Criaturas parser ───────────────────────────────────────────────

const PHB_SIZES_ES = ["Gargantuesca", "Enorme", "Grande", "Mediana", "Mediano", "Pequeña", "Pequeño", "Diminuta", "Diminuto"];

function parseAbilityEs(line: string, abbr: string): number | null {
  const m = line.match(new RegExp(abbr + "\\s+(\\d+)"));
  return m ? parseInt(m[1]!, 10) : null;
}

function extractPhbMonstersFromText(text: string): SrdMonster[] {
  const monsters: SrdMonster[] = [];
  const sections = text.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const heading = lines[0]!;
    if (heading.startsWith("Leyenda")) continue;

    const name = heading.trim(); // Keep bilingual: "Mono (Ape)"
    const statLine = lines[1] ?? "";
    const crLine = lines[2] ?? "";

    const typeSizePart = statLine.split("|")[0]?.trim() ?? "";
    let size = "", type = "";
    for (const s of PHB_SIZES_ES) {
      if (typeSizePart.includes(s)) {
        size = s;
        type = typeSizePart.slice(0, typeSizePart.indexOf(s)).trim();
        break;
      }
    }

    const cr = crLine.match(/CR ([\d\/]+)/)?.[1] ?? "0";
    monsters.push({ name, cr, type, size, source: "phb" });
  }

  return monsters.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function extractPhbMonsterStatBlock(text: string, targetName: string): MonsterDetail | null {
  const target = targetName.toLowerCase().trim();
  const sections = text.split(/^## /m).slice(1);

  const section = sections.find((s) => {
    const heading = (s.split("\n")[0] ?? "").trim().toLowerCase();
    const spanishName = heading.replace(/\s*\([^)]+\)$/, "").trim();
    const englishMatch = heading.match(/\(([^)]+)\)$/);
    const englishName = englishMatch?.[1] ?? "";
    return heading === target || spanishName === target ||
      englishName.toLowerCase() === target || heading.includes("(" + target + ")");
  });
  if (!section) return null;

  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  const heading = lines[0]!;
  const statLine = lines[1] ?? "";
  const crLine = lines[2] ?? "";

  const name = heading.replace(/\s*\([^)]+\)$/, "").trim();

  // Size + type + alignment
  const statParts = statLine.split("|").map((p) => p.trim());
  const typeSizePart = statParts[0] ?? "";
  let size = "", type = "", alignment = "";
  for (const s of PHB_SIZES_ES) {
    if (typeSizePart.includes(s)) {
      size = s;
      type = typeSizePart.slice(0, typeSizePart.indexOf(s)).trim();
      break;
    }
  }
  // Alignment: second segment if it's not a stat field
  const seg2 = statParts[1] ?? "";
  if (seg2 && !seg2.startsWith("CA") && !seg2.startsWith("PG") && !seg2.startsWith("Vel")) {
    alignment = seg2;
  }

  const ac = statLine.match(/CA (\d+)/)?.[1] ?? "";
  const hp = statLine.match(/PG (\d+(?:\s*\([^)]+\))?)/)?.[1]?.trim() ?? "";
  const speed = statLine.match(/Vel\s+([^|]+?)(?:\s*\||$)/)?.[1]?.trim() ?? "";

  const str  = parseAbilityEs(crLine, "FUE");
  const dex  = parseAbilityEs(crLine, "DES");
  const con  = parseAbilityEs(crLine, "CON");
  const intel = parseAbilityEs(crLine, "INT");
  const wis  = parseAbilityEs(crLine, "SAB");
  const cha  = parseAbilityEs(crLine, "CAR");
  const cr   = crLine.match(/CR ([\d\/]+)/)?.[1] ?? "";
  const xpRaw = crLine.match(/\((\d+(?:[.\s]\d+)*)\s*PX\)/)?.[1] ?? "";
  const xp   = xpRaw ? xpRaw.replace(/[.\s]/g, "") + " XP" : "";

  const rest = lines.slice(3);
  let skills = "", resistances = "", immunities = "", conditionImmunities = "";
  let vulnerabilities = "", senses = "", languages = "";
  const traits: { name: string; description: string }[] = [];
  const actions: { name: string; description: string }[] = [];
  const bonusActions: { name: string; description: string }[] = [];
  const reactions: { name: string; description: string }[] = [];

  for (const line of rest) {
    // Bonus actions
    if (/^Acciones? Adicionales?|^Acc\. Adicional/.test(line)) {
      const m = line.match(/[—:]\s*(.+?):\s*(.+)/);
      if (m) bonusActions.push({ name: m[1]!.trim(), description: m[2]!.trim() });
      else bonusActions.push({ name: "Acción Adicional", description: line.replace(/^Acc(?:iones?)?\. ?Adicionales?\s*[—:]\s*/, "").trim() });
      continue;
    }
    // Reactions
    if (/^Reacción/.test(line)) {
      const m = line.match(/—\s*(.+?):\s*(.+)/);
      if (m) reactions.push({ name: m[1]!.trim(), description: m[2]!.trim() });
      else reactions.push({ name: "Reacción", description: line.replace(/^Reacción\s*[—:]\s*/, "").trim() });
      continue;
    }
    // Skills: "Comp: Atletismo +5, Percepción +3"
    if (line.startsWith("Comp:")) { skills = line.slice(5).trim(); continue; }
    // Resistances (senses after "|")
    if (line.startsWith("Resistencias:")) {
      const parts = line.slice(13).split("|");
      resistances = parts[0]?.trim() ?? "";
      if (parts[1]) senses = (senses ? senses + " | " : "") + parts[1].trim();
      continue;
    }
    // Immunities (conditions after ";")
    if (line.startsWith("Inmunidades:")) {
      const parts = line.slice(12).split(";");
      immunities = parts[0]?.trim() ?? "";
      if (parts[1]) conditionImmunities = parts[1].trim();
      continue;
    }
    // Vulnerabilities
    if (/^Vulnerabilidad/.test(line)) { vulnerabilities = line.split(":")[1]?.trim() ?? ""; continue; }
    // Senses starting with Visión
    if (/^Visión|^Sentidos/.test(line)) { senses = (senses ? senses + " | " : "") + line; continue; }
    // Languages
    if (/^Entiende|^Idiomas:/.test(line)) { languages = line.replace(/^Idiomas:\s*/, ""); continue; }
    // Named traits
    if (/^Rasgo[s]?:/.test(line)) { traits.push({ name: "Rasgo", description: line.replace(/^Rasgos?:\s*/, "") }); continue; }
    // Equipment (treat as trait)
    if (line.startsWith("Equipo:")) { traits.push({ name: "Equipo", description: line.slice(7).trim() }); continue; }
    // Mixed skills + senses: "Percepción +5, Sigilo +4 | Visión Oscura 60 pies"
    if (line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim());
      const sensePart = parts.find((p) => /^Visión|^Sentidos|^Anfibio/.test(p));
      const skillPart = parts.find((p) => p !== sensePart && /\+\d+/.test(p));
      const otherParts = parts.filter((p) => p !== sensePart && p !== skillPart && p);
      if (skillPart && !skills) skills = skillPart;
      if (sensePart) senses = (senses ? senses + " | " : "") + sensePart;
      for (const p of otherParts) if (p) traits.push({ name: "Descripción", description: p });
      continue;
    }
    // Action detection: has damage pattern "+X, N (dice)" or "+X alcance/rango"
    const isAttack = /\+\d+[, ]\s*\d+\s*\(/.test(line) ||
      /\+\d+\s+(alcance|rango|distancia)/i.test(line) ||
      /^Multiatacar/.test(line);
    if (isAttack) {
      const colonM = line.match(/^([^:+]{1,35}):\s+(.+)/);
      const plusM = line.match(/^([^+]{1,30})\+/);
      if (colonM) actions.push({ name: colonM[1]!.trim(), description: colonM[2]!.trim() });
      else if (plusM && plusM[1]!.trim()) actions.push({ name: plusM[1]!.trim(), description: line.slice(plusM[1]!.length).trim() });
      else actions.push({ name: "Ataque", description: line });
      continue;
    }
    // Everything else: trait
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < 40) {
      traits.push({ name: line.slice(0, colonIdx).trim(), description: line.slice(colonIdx + 1).trim() });
    } else if (line.length < 80 && line.endsWith(".") && !line.includes(". ")) {
      traits.push({ name: line.replace(/\.$/, "").trim(), description: "" });
    } else {
      traits.push({ name: "Descripción", description: line });
    }
  }

  return {
    name, size, type, alignment, ac, hp, speed, initiative: "",
    str, dex, con, int: intel, wis, cha,
    savingThrows: "", skills, resistances, immunities, conditionImmunities,
    vulnerabilities, senses, languages, cr, xp, profBonus: "",
    traits, actions, bonusActions, reactions, legendaryActions: [],
    rawText: lines.join("\n"),
  };
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

// ─── Private monster overlay (data/private/mm2024/monster-data.json) ────────
//
// Optional, gitignored, user-supplied content — never present in the repo.
// Read lazily on every request and tolerant of a missing/unparseable file:
// the overlay must NEVER turn a request into an error, it just stays empty.

interface MonsterEntry {
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
  actions: { name: string; description: string }[];
  spellcasting: string | null;
  bonusAction: string;
  reaction: string;
  legendaryActions: string;
  lair: boolean;
}

async function loadPrivateMonsters(): Promise<MonsterEntry[]> {
  try {
    const filePath = join(env.DATA_DIR, "private", "mm2024", "monster-data.json");
    const raw = await readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MonsterEntry[]) : [];
  } catch {
    // Missing file, unreadable, or malformed JSON: overlay stays empty.
    return [];
  }
}

function privateMonsterToSummary(m: MonsterEntry): SrdMonster {
  return { name: m.name, cr: m.cr, type: m.type, size: m.size, source: "mm", ac: m.ac, hp: m.hp };
}

function privateMonsterToDetail(m: MonsterEntry): MonsterDetail {
  const traits: { name: string; description: string }[] = (m.traits ? m.traits.split(",") : [])
    .map((t) => t.trim())
    .filter(Boolean)
    .map((name) => ({ name, description: "" }));

  if (m.spellcasting) {
    traits.push({ name: "Spellcasting", description: m.spellcasting });
  }

  const bonusActions = m.bonusAction ? [{ name: "Acción Adicional", description: m.bonusAction }] : [];
  const reactions = m.reaction ? [{ name: "Reacción", description: m.reaction }] : [];
  const legendaryActions = m.legendaryActions ? [{ name: "Acción Legendaria", description: m.legendaryActions }] : [];

  return {
    name: m.name,
    size: m.size,
    type: m.type,
    alignment: m.alignment,
    ac: String(m.ac),
    hp: String(m.hp),
    speed: m.speed,
    initiative: "",
    str: m.str,
    dex: m.dex,
    con: m.con,
    int: m.int,
    wis: m.wis,
    cha: m.cha,
    savingThrows: m.savingThrows,
    skills: m.skills,
    resistances: m.resistances,
    immunities: m.damageImmunities,
    conditionImmunities: m.conditionImmunities,
    vulnerabilities: m.vulnerabilities,
    senses: m.senses ? `${m.senses}, percepción pasiva ${m.passivePerception}` : `percepción pasiva ${m.passivePerception}`,
    languages: m.languages,
    cr: m.cr,
    xp: `${m.xp} XP`,
    profBonus: m.pb >= 0 ? `+${m.pb}` : `${m.pb}`,
    traits,
    actions: m.actions,
    bonusActions,
    reactions,
    legendaryActions,
    rawText: "",
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

    // Load SRD monsters
    const srdDoc = await prisma.document.findFirst({
      where: { sourceType: "srd", title: { contains: "Monster" } },
      select: { path: true },
    });
    let srdMonsters: SrdMonster[] = [];
    if (srdDoc) {
      try {
        const text = await readFile(join(env.DOCUMENTS_DIR, srdDoc.path), "utf-8");
        srdMonsters = extractMonstersFromText(text).map((m) => ({ ...m, source: "srd" as const }));
      } catch { /* doc not found on disk */ }
    }

    // Load PHB criaturas monsters
    const phbDoc = await prisma.document.findFirst({
      where: { sourceType: "official", title: { contains: "Criaturas" } },
      select: { path: true },
    });
    let phbMonsters: SrdMonster[] = [];
    if (phbDoc) {
      try {
        const text = await readFile(join(env.DOCUMENTS_DIR, phbDoc.path), "utf-8");
        phbMonsters = extractPhbMonstersFromText(text);
      } catch { /* doc not found on disk */ }
    }

    // Merge, deduplicate by name (SRD wins)
    const srdNames = new Set(srdMonsters.map((m) => m.name.toLowerCase()));
    const merged = [
      ...srdMonsters,
      ...phbMonsters.filter((m) => !srdNames.has(m.name.toLowerCase())),
    ].sort((a, b) => a.name.localeCompare(b.name));

    // Private overlay (data/private/mm2024/monster-data.json), if present, wins on duplicates
    const privateMonsters = await loadPrivateMonsters();
    const privateSummaries = privateMonsters.map(privateMonsterToSummary);
    const privateNames = new Set(privateSummaries.map((m) => m.name.toLowerCase()));
    const withOverlay = [
      ...merged.filter((m) => !privateNames.has(m.name.toLowerCase())),
      ...privateSummaries,
    ].sort((a, b) => a.name.localeCompare(b.name));

    const result = q
      ? withOverlay.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
      : withOverlay;

    return reply.send({ success: true, data: result });
  });

  fastify.get<{ Params: { name: string } }>("/monsters/:name", async (req, reply) => {
    const { name } = req.params;

    // 0. Private overlay wins on duplicates
    const privateMonsters = await loadPrivateMonsters();
    const privateMatch = privateMonsters.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (privateMatch) {
      return reply.send({ success: true, data: privateMonsterToDetail(privateMatch) });
    }

    // 1. Try SRD first
    const srdDoc = await prisma.document.findFirst({
      where: { sourceType: "srd", title: { contains: "Monster" } },
      select: { path: true },
    });
    if (srdDoc) {
      try {
        const text = await readFile(join(env.DOCUMENTS_DIR, srdDoc.path), "utf-8");
        const detail = extractMonsterStatBlock(text, name);
        if (detail) return reply.send({ success: true, data: detail });
      } catch { /* fall through to PHB */ }
    }

    // 2. Fallback: PHB criaturas
    const phbDoc = await prisma.document.findFirst({
      where: { sourceType: "official", title: { contains: "Criaturas" } },
      select: { path: true },
    });
    if (!phbDoc) return reply.send({ success: true, data: null });

    try {
      const text = await readFile(join(env.DOCUMENTS_DIR, phbDoc.path), "utf-8");
      const detail = extractPhbMonsterStatBlock(text, name);
      return reply.send({ success: true, data: detail });
    } catch {
      return reply.send({ success: true, data: null });
    }
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
      docs.map((d: typeof docs[number]) => ({ ...d, authorityLevel: d.authorityLevel }))
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
