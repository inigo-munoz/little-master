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
