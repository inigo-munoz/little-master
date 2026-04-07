/**
 * Obsidian Integration Service - Universal TTRPG Vault Support
 *
 * Detection strategy: frontmatter-first, path-second, content-third.
 * Never hardcode vault folder names — infer entity type from data.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";

// ─── Frontmatter parser ───────────────────────────────────────────────────────
export function parseFrontmatter(content: string): { fm: Record<string, any>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { fm: {}, body: content };

  const body = match[2] ?? "";
  const fm: Record<string, any> = {};
  const lines = (match[1] ?? "").split(/\r?\n/);
  let currentKey = "";

  for (const line of lines) {
    if (line.match(/^  - /)) {
      const val = line.replace(/^  - /, "").replace(/^["']|["']$/g, "").trim();
      if (currentKey) {
        if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
        (fm[currentKey] as string[]).push(val);
      }
      continue;
    }
    const kv = line.match(/^([\w][\w _-]*)\s*:\s*(.*)/);
    if (kv) {
      currentKey = kv[1] ?? "";
      const val = (kv[2] ?? "").trim().replace(/^["']|["']$/g, "");
      if (val === "") { fm[currentKey] = []; }
      else { fm[currentKey] = val; }
    }
  }
  return { fm, body };
}

export function serializeFrontmatter(fm: Record<string, any>): string {
  const lines = ["---"];
  for (const [key, val] of Object.entries(fm)) {
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) lines.push(`  - ${item}`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractWikiName(link: string): string {
  const match = link.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (!match) return link;
  return (match[2] ?? match[1] ?? link).trim();
}

export function cleanObsidianSyntax(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`INPUT\[[\s\S]*?\]`/g, "")
    .replace(/`BUTTON\[.*?\]`/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/> \[!.*?\][^\n]*/g, "")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_: string, p: string, alias: string) => alias ?? p)
    .replace(/!\[\[.*?\]\]/g, "")
    .replace(/^[>#\s*-]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "").trim();
}

function mapCharStatus(s?: string): "alive" | "dead" | "unknown" | "missing" {
  if (!s) return "unknown";
  const l = s.toLowerCase();
  if (l.includes("alive") || l.includes("vivo") || l.includes("living")) return "alive";
  if (l.includes("dead") || l.includes("deceased") || l.includes("muerto") || l.includes("fallen")) return "dead";
  if (l.includes("missing") || l.includes("desaparecido")) return "missing";
  return "unknown";
}

function mapStatusToObsidian(s: string): string {
  return { alive: "Alive", dead: "Dead", unknown: "Unknown", missing: "Missing" }[s] ?? "Unknown";
}

function isRaceTag(t: string): boolean {
  return ["human","elf","dwarf","halfling","gnome","orc","tiefling","dragonborn",
    "half-elf","half-orc","humano","elfo","enano","tabaxi","goliath","genasi",
    "aasimar","firbolg","kenku","lizardfolk","drow","yuan-ti"].some(r => t.toLowerCase().includes(r));
}

function isGenderTag(t: string): boolean {
  return ["male","female","other","masculino","femenino","nonbinary"].includes(t.toLowerCase());
}

function isAgeTag(t: string): boolean {
  return ["infant","child","teenager","young adult","adult","elder",
    "nino","adulto","anciano","joven"].includes(t.toLowerCase());
}

// ─── Find markdown files ──────────────────────────────────────────────────────
async function findMarkdownFiles(dir: string, maxDepth = 6): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip system and asset folders
      const skip = [".obsidian", ".git", "node_modules", "excalidraw",
        "z_assets", "assets", "attachments", "images", "zoommap"].some(
        s => entry.name.toLowerCase().includes(s)
      );
      if (skip) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && maxDepth > 0) {
        const sub = await findMarkdownFiles(fullPath, maxDepth - 1);
        results.push(...sub);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

// ─── DETECTION SIGNATURES ─────────────────────────────────────────────────────
// Each entity type has weighted signals. Score >= threshold = detected.

// Player character detection (higher priority than NPC)
const PLAYER_FIELDS = ["level","hp","ac","modifier","pasperc","player","char_class","faction_standing"];
const PLAYER_TAGS = ["player","category/player","pc","jugador","player-character"];
const PLAYER_PATHS = ["1-party","party","players","pcs","jugadores","player-characters","personajes-jugadores"];
const PLAYER_NOTEICONS = ["player"];

const NPC_FIELDS = ["char_status","char_race","char_class","char_gender","char_age",
  "race","class","alignment","hp","ac","cr","monster","npc_type","role","occupation"];
const NPC_TAGS = ["category/people","category/person","npc","character","person",
  "people","monster","creature","personaje","persona"];
const NPC_PATHS = ["people","npcs","characters","persons","monsters","creatures",
  "personajes","party","players","1-party","2-world/people"];

const SESSION_FIELDS = ["sessiondate","session_date","playedon","played_at","oneliner",
  "one_liner","sessionstatus","session_number","players","date"];
const SESSION_TAGS = ["journal","session","category/journal","session-journal",
  "sesion","sesión","log"];
const SESSION_PATHS = ["session","journal","sessions","journals","campaign/sessions",
  "1-session","sesion","sesiones"];

const FACTION_FIELDS = ["leader","officers","members","initiates","faction","allegiance",
  "headquarters","goals","ideology"];
const FACTION_TAGS = ["category/group","faction","organization","guild","order",
  "group","faccion","facción"];
const FACTION_PATHS = ["groups","factions","organizations","guilds","orders",
  "organizations","2-world/groups","facciones"];

const LOCATION_FIELDS = ["mycontainer","mycategory","region","district","settlement",
  "location_type","terrain","climate","population"];
const LOCATION_TAGS = ["category/place","category/hub","category/region","location",
  "place","hub","region","district","settlement","ciudad","lugar","lugar"];
const LOCATION_PATHS = ["places","hubs","regions","locations","districts","continents",
  "atlas","world","map","2-world/places","2-world/hubs","2-world/regions"];

const QUEST_FIELDS = ["queststatus","quest_status","objective","reward","questgiver",
  "quest_giver","mission_status"];
const QUEST_TAGS = ["category/quest","quest","mission","mision","misión","adventure"];
const QUEST_PATHS = ["quests","missions","adventures","2-world/quests","2-campaign/quests"];

function scoreNote(
  fm: Record<string, any>,
  filePath: string,
  fields: string[],
  tags: string[],
  paths: string[]
): number {
  let score = 0;
  const fmKeys = Object.keys(fm).map(k => k.toLowerCase());
  const fmTags: string[] = Array.isArray(fm["tags"])
    ? fm["tags"].map((t: string) => t.toLowerCase())
    : typeof fm["tags"] === "string" ? [fm["tags"].toLowerCase()] : [];
  const pathLower = filePath.toLowerCase();

  // Frontmatter field match = 3 points each (max 12)
  for (const f of fields) {
    if (fmKeys.includes(f.toLowerCase())) score += 3;
  }
  score = Math.min(score, 12);

  // Tag match = 5 points (strong signal)
  for (const t of tags) {
    if (fmTags.some(ft => ft.includes(t))) { score += 5; break; }
  }

  // Path match = 2 points
  for (const p of paths) {
    if (pathLower.includes(p.toLowerCase())) { score += 2; break; }
  }

  return score;
}

// ─── SCAN: Analyze vault without importing ────────────────────────────────────
export interface VaultScanResult {
  totalNotes: number;
  groups: VaultNoteGroup[];
  skipped: number;
}

export interface VaultNoteGroup {
  type: "npc" | "session" | "faction" | "location" | "quest" | "unknown";
  count: number;
  confidence: "high" | "medium" | "low";
  sampleNames: string[];
  topFields: string[];
}

export async function scanVault(vaultPath: string): Promise<VaultScanResult> {
  const allFiles = await findMarkdownFiles(vaultPath);
  const templateFiles = allFiles.filter(f => {
    const rel = f.replace(vaultPath, "").toLowerCase();
    return rel.includes("template") || rel.includes("z_example") ||
           rel.includes("readme") || rel.includes("scratch") ||
           rel.includes("kanban") || rel.includes("0-scratch");
  });
  const contentFiles = allFiles.filter(f => !templateFiles.includes(f));

  const groups: Record<string, { files: string[]; fields: Set<string> }> = {
    npc: { files: [], fields: new Set() },
    session: { files: [], fields: new Set() },
    faction: { files: [], fields: new Set() },
    location: { files: [], fields: new Set() },
    quest: { files: [], fields: new Set() },
    unknown: { files: [], fields: new Set() },
  };

  for (const filePath of contentFiles) {
    const raw = await fs.readFile(filePath, "utf-8").catch(() => null);
    if (!raw) continue;

    const { fm } = parseFrontmatter(raw);

    const noteIcon2 = (fm["NoteIcon"] ?? fm["noteIcon"] ?? "").toLowerCase();
    const fmRole2 = (fm["Role"] ?? fm["role"] ?? "").toLowerCase();
    const isExplicitPlayer2 =
      PLAYER_NOTEICONS.includes(noteIcon2) ||
      fmRole2 === "player" ||
      scoreNote(fm, filePath, PLAYER_FIELDS, PLAYER_TAGS, PLAYER_PATHS) >= 4;
    const isExplicitNpc2 = noteIcon2 === "person" || noteIcon2 === "npc";

    const scores = {
      player: isExplicitPlayer2 ? 99 : scoreNote(fm, filePath, PLAYER_FIELDS, PLAYER_TAGS, PLAYER_PATHS),
      npc: isExplicitNpc2 ? 99 : scoreNote(fm, filePath, NPC_FIELDS, NPC_TAGS, NPC_PATHS),
      session: scoreNote(fm, filePath, SESSION_FIELDS, SESSION_TAGS, SESSION_PATHS),
      faction: scoreNote(fm, filePath, FACTION_FIELDS, FACTION_TAGS, FACTION_PATHS),
      location: scoreNote(fm, filePath, LOCATION_FIELDS, LOCATION_TAGS, LOCATION_PATHS),
      quest: scoreNote(fm, filePath, QUEST_FIELDS, QUEST_TAGS, QUEST_PATHS),
    };

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const type = best && best[1] >= 2 ? best[0] : "unknown";

    groups[type]?.files.push(filePath);
    Object.keys(fm).forEach(k => groups[type]?.fields.add(k));
  }

  const result: VaultScanResult = {
    totalNotes: contentFiles.length,
    skipped: templateFiles.length,
    groups: Object.entries(groups)
      .filter(([, g]) => g.files.length > 0)
      .map(([type, g]) => {
        const avgScore = g.files.length;
        return {
          type: type as VaultNoteGroup["type"],
          count: g.files.length,
          confidence: avgScore >= 5 ? "high" : avgScore >= 2 ? "medium" : "low",
          sampleNames: g.files.slice(0, 3).map(f => path.basename(f, ".md")),
          topFields: [...g.fields].slice(0, 6),
        };
      }),
  };

  return result;
}

// ─── IMPORT with user-confirmed mapping ───────────────────────────────────────
export interface ImportMapping {
  player: boolean;
  npc: boolean;
  session: boolean;
  faction: boolean;
  location: boolean;
  quest: boolean;
}

export interface ImportResult {
  players: { imported: number; skipped: number; errors: string[] };
  npcs: { imported: number; skipped: number; errors: string[] };
  sessions: { imported: number; skipped: number; errors: string[] };
  factions: { imported: number; skipped: number; errors: string[] };
  locations: { imported: number; skipped: number; errors: string[] };
  quests: { imported: number; skipped: number; errors: string[] };
}

export async function importFromVault(
  vaultPath: string,
  campaignId: string,
  mapping: ImportMapping = { player: true, npc: true, session: true, faction: true, location: true, quest: true }
): Promise<ImportResult> {
  const result: ImportResult = {
    players: { imported: 0, skipped: 0, errors: [] },
    npcs: { imported: 0, skipped: 0, errors: [] },
    sessions: { imported: 0, skipped: 0, errors: [] },
    factions: { imported: 0, skipped: 0, errors: [] },
    locations: { imported: 0, skipped: 0, errors: [] },
    quests: { imported: 0, skipped: 0, errors: [] },
  };

  const allFiles = await findMarkdownFiles(vaultPath);
  const contentFiles = allFiles.filter(f => {
    const rel = f.replace(vaultPath, "").toLowerCase();
    return !rel.includes("template") && !rel.includes("z_example") &&
           !rel.includes("readme") && !rel.includes("scratch") &&
           !rel.includes("kanban") && !rel.includes("0-scratch");
  });

  // DATA_DIR from env, fallback to relative path from this file
  const { fileURLToPath } = await import("node:url");
  const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = process.env["DATA_DIR"]
    ? path.resolve(process.env["DATA_DIR"])
    : path.resolve(__dirname2, "../../../../data");
  const documentsDir = path.join(dataDir, "documents", "global");
  await fs.mkdir(documentsDir, { recursive: true }).catch(() => {});

  for (const filePath of contentFiles) {
    const raw = await fs.readFile(filePath, "utf-8").catch(() => null);
    if (!raw) continue;

    const { fm, body } = parseFrontmatter(raw);
    const fileName = path.basename(filePath, ".md");

    // Player detection: NoteIcon and Role are strong signals
    const noteIcon = (fm["NoteIcon"] ?? fm["noteIcon"] ?? "").toLowerCase();
    const fmRole = (fm["Role"] ?? fm["role"] ?? "").toLowerCase();
    const isExplicitPlayer =
      PLAYER_NOTEICONS.includes(noteIcon) ||
      fmRole === "player" ||
      scoreNote(fm, filePath, PLAYER_FIELDS, PLAYER_TAGS, PLAYER_PATHS) >= 4;

    // NoteIcon: person = explicit NPC signal (boost score)
    const isExplicitNpc = noteIcon === "person" || noteIcon === "npc";

    const scores = {
      player: isExplicitPlayer ? 99 : scoreNote(fm, filePath, PLAYER_FIELDS, PLAYER_TAGS, PLAYER_PATHS),
      npc: isExplicitNpc ? 99 : scoreNote(fm, filePath, NPC_FIELDS, NPC_TAGS, NPC_PATHS),
      session: scoreNote(fm, filePath, SESSION_FIELDS, SESSION_TAGS, SESSION_PATHS),
      faction: scoreNote(fm, filePath, FACTION_FIELDS, FACTION_TAGS, FACTION_PATHS),
      location: scoreNote(fm, filePath, LOCATION_FIELDS, LOCATION_TAGS, LOCATION_PATHS),
      quest: scoreNote(fm, filePath, QUEST_FIELDS, QUEST_TAGS, QUEST_PATHS),
    };

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const best = sorted[0];
    if (!best || best[1] < 2) continue;
    const type = best[0] as keyof ImportMapping;

    if (!mapping[type]) continue;

    const cleanBody = cleanObsidianSyntax(body);

    // ── Player Character ──────────────────────────────────────────────────
    if (type === "player") {
      try {
        // If this was previously imported as NPC, migrate it
        const existingNpc = await prisma.npc.findFirst({ where: { campaignId, name: fileName } });
        if (existingNpc) {
          await prisma.npc.delete({ where: { id: existingNpc.id } });
        }

        const existing = await prisma.player.findFirst({ where: { campaignId, name: fileName } });
        if (existing) { result.players.skipped++; continue; }

        const classField = Array.isArray(fm["Class"]) ? fm["Class"].join(", ") : (fm["Class"] ?? fm["class"] ?? fm["char_class"] ?? null);
        const raceField = Array.isArray(fm["Race"]) ? fm["Race"].join(", ") : (fm["Race"] ?? fm["race"] ?? fm["char_race"] ?? null);
        const level = parseInt(fm["level"] as string ?? "1") || 1;
        const hp = fm["hp"] ? parseInt(fm["hp"] as string) : null;
        const ac = fm["ac"] ? parseInt(fm["ac"] as string) : null;
        const status = (fm["Status"] ?? fm["status"] ?? fm["char_status"] ?? "active").toString().toLowerCase();

        await prisma.player.create({
          data: {
            campaignId,
            name: fileName,
            playerName: fm["Player"] as string ?? null,
            class: classField as string ?? null,
            race: raceField as string ?? null,
            level,
            hp: isNaN(hp as number) ? null : hp,
            ac: isNaN(ac as number) ? null : ac,
            status: ["active","inactive","dead","retired","missing"].includes(status) ? status : "active",
            notes: cleanObsidianSyntax(body).slice(0, 3000) || null,
            tags: JSON.stringify([]),
          },
        });
        result.players.imported++;
      } catch (e: any) { result.players.errors.push(`${fileName}: ${e.message}`); }
      continue;
    }

    // ── NPC ────────────────────────────────────────────────────────────────
    if (type === "npc") {
      try {
        const existing = await prisma.npc.findFirst({ where: { campaignId, name: fileName } });
        if (existing) {
          // Update rawContent if missing
          if (!existing.rawContent && raw) {
            await prisma.npc.update({
              where: { id: existing.id },
              data: { rawContent: raw },
            });
          }
          result.npcs.skipped++;
          continue;
        }

        const status = mapCharStatus(fm["char_status"] as string ?? fm["status"] as string);
        const tags: string[] = [];
        const raceFields = ["char_race", "race", "species"];
        for (const f of raceFields) {
          if (fm[f]) { tags.push(fm[f] as string); break; }
        }
        if (fm["char_gender"] || fm["gender"]) tags.push(fm["char_gender"] ?? fm["gender"]);
        if (fm["char_age"] || fm["age"]) tags.push(fm["char_age"] ?? fm["age"]);

        const allies: string[] = Array.isArray(fm["allies"]) ? fm["allies"].map(extractWikiName) : [];
        const enemies: string[] = Array.isArray(fm["enemies"]) ? fm["enemies"].map(extractWikiName) : [];

        let description = cleanBody.slice(0, 4000);
        if (allies.length) description += `\n\nAllies: ${allies.join(", ")}`;
        if (enemies.length) description += `\nEnemies: ${enemies.join(", ")}`;

        const role = fm["role"] ?? fm["occupation"] ?? fm["class"] ?? fm["char_class"] ?? fm["MyCategory"] ?? null;

        await prisma.npc.create({
          data: {
            campaignId,
            name: fileName,
            role: role as string ?? null,
            description: description || null,
            rawContent: raw,  // preserve original for export
            status,
            tags: JSON.stringify(tags.filter(Boolean)),
          },
        });
        result.npcs.imported++;
      } catch (e: any) { result.npcs.errors.push(`${fileName}: ${e.message}`); }
      continue;
    }

    // ── Session ────────────────────────────────────────────────────────────
    if (type === "session") {
      try {
        const existing = await prisma.session.findFirst({ where: { campaignId, title: fileName } });
        if (existing) { result.sessions.skipped++; continue; }

        const count = await prisma.session.count({ where: { campaignId } });
        const dateField = fm["sessionDate"] ?? fm["session_date"] ?? fm["date"] ?? fm["playedOn"];
        let playedAt: Date | null = null;
        if (dateField) {
          const d = new Date(dateField as string);
          if (!isNaN(d.getTime())) playedAt = d;
        }

        const summary = fm["OneLiner"] ?? fm["one_liner"] ?? fm["summary"] ?? null;

        await prisma.session.create({
          data: {
            campaignId,
            title: fileName,
            summary: summary as string ?? null,
            notes: cleanBody || null,
            sessionNumber: count + 1,
            playedAt,
          },
        });
        result.sessions.imported++;
      } catch (e: any) { result.sessions.errors.push(`${fileName}: ${e.message}`); }
      continue;
    }

    // ── Faction ────────────────────────────────────────────────────────────
    if (type === "faction") {
      try {
        const existing = await prisma.faction.findFirst({ where: { campaignId, name: fileName } });
        if (existing) { result.factions.skipped++; continue; }

        const leader = fm["leader"] as string ?? null;
        const members: string[] = Array.isArray(fm["members"]) ? fm["members"] : [];
        let description = cleanBody.slice(0, 4000);
        if (leader) description = `Leader: ${leader}\n\n` + description;
        if (members.length) description += `\n\nMembers: ${members.join(", ")}`;

        const catField = fm["MyCategory"] ?? fm["category"] ?? fm["type"] ?? fm["faction_type"];
        const tags = catField ? [catField as string] : [];

        await prisma.faction.create({
          data: {
            campaignId,
            name: fileName,
            description: description || null,
            alignment: null,
            disposition: "unknown",
            tags: JSON.stringify(tags),
          },
        });
        result.factions.imported++;
      } catch (e: any) { result.factions.errors.push(`${fileName}: ${e.message}`); }
      continue;
    }

    // ── Location ───────────────────────────────────────────────────────────
    if (type === "location") {
      try {
        const existing = await prisma.location.findFirst({ where: { campaignId, name: fileName } });
        if (existing) { result.locations.skipped++; continue; }

        const catField = fm["MyCategory"] ?? fm["location_type"] ?? fm["type"] ?? fm["terrain"];
        const tags = catField ? [catField as string] : [];

        await prisma.location.create({
          data: {
            campaignId,
            name: fileName,
            description: cleanBody.slice(0, 2000) || null,
            parentLocationId: null,
            tags: JSON.stringify(tags),
          },
        });
        result.locations.imported++;
      } catch (e: any) { result.locations.errors.push(`${fileName}: ${e.message}`); }
      continue;
    }

    // ── Quest → stored as campaign document ───────────────────────────────
    if (type === "quest") {
      try {
        const existing = await prisma.document.findFirst({
          where: { campaignId, title: `Quest: ${fileName}` },
        });
        if (existing) { result.quests.skipped++; continue; }

        const docId = crypto.randomUUID();
        const docContent = `# ${fileName}\n\nStatus: ${fm["questStatus"] ?? fm["quest_status"] ?? "Unknown"}\n\n${cleanBody}`;
        const docPath = path.join(documentsDir, `quest_${docId}.md`);
        await fs.writeFile(docPath, docContent, "utf-8");

        await prisma.document.create({
          data: {
            id: docId,
            title: `Quest: ${fileName}`,
            path: `global/quest_${docId}.md`,
            contentType: "markdown",
            sourceType: "campaign",
            authorityLevel: "medium",
            version: "1.0",
            campaignId,
            isIndexed: false,
            chunkCount: 0,
          },
        });
        result.quests.imported++;
      } catch (e: any) { result.quests.errors.push(`${fileName}: ${e.message}`); }
    }
  }

  return result;
}

// ─── EXPORT: Assistant → Obsidian ────────────────────────────────────────────
export interface ExportResult {
  npcs: { exported: number; errors: string[] };
  sessions: { exported: number; errors: string[] };
  factions: { exported: number; errors: string[] };
  locations: { exported: number; errors: string[] };
}

export async function exportToVault(vaultPath: string, campaignId: string): Promise<ExportResult> {
  const result: ExportResult = {
    npcs: { exported: 0, errors: [] },
    sessions: { exported: 0, errors: [] },
    factions: { exported: 0, errors: [] },
    locations: { exported: 0, errors: [] },
  };

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  const dirs = {
    people: path.join(vaultPath, "2-World", "People"),
    journal: path.join(vaultPath, "1-Campaign", "Journal"),
    groups: path.join(vaultPath, "2-World", "Groups"),
    places: path.join(vaultPath, "2-World", "Places"),
  };
  for (const d of Object.values(dirs)) await fs.mkdir(d, { recursive: true });

  // NPCs
  const npcs = await prisma.npc.findMany({ where: { campaignId } });
  for (const npc of npcs) {
    try {
      const filePath = path.join(dirs.people, `${sanitizeFilename(npc.name)}.md`);

      // Conservative export: never overwrite existing vault notes
      const existsInVault = await fs.access(filePath).then(() => true).catch(() => false);
      if (existsInVault) {
        // Only update sync metadata in frontmatter, preserve all content
        const existingContent = await fs.readFile(filePath, "utf-8");
        const { fm: existingFm, body: existingBody } = parseFrontmatter(existingContent);
        existingFm["dnd-assistant-id"] = npc.id;
        existingFm["dnd-assistant-sync"] = new Date().toISOString();
        existingFm["char_status"] = mapStatusToObsidian(npc.status);
        await fs.writeFile(filePath, serializeFrontmatter(existingFm) + "\n" + existingBody, "utf-8");
        result.npcs.exported++;
        continue;
      }

      // Note does not exist — create from rawContent or description
      const rawContent = (npc as any).rawContent as string | null;
      if (rawContent) {
        const { fm: originalFm, body: originalBody } = parseFrontmatter(rawContent);
        originalFm["dnd-assistant-id"] = npc.id;
        originalFm["dnd-assistant-sync"] = new Date().toISOString();
        originalFm["char_status"] = mapStatusToObsidian(npc.status);
        await fs.writeFile(filePath, serializeFrontmatter(originalFm) + "\n" + originalBody, "utf-8");
      } else {
        let tags: string[] = [];
        try { tags = JSON.parse(npc.tags); } catch {}
        const fm: Record<string, any> = {
          tags: ["Category/People"],
          obsidianUIMode: "preview",
          char_status: mapStatusToObsidian(npc.status),
          char_race: tags.find(isRaceTag) ?? "Unknown",
          char_gender: tags.find(isGenderTag) ?? "Unknown",
          char_age: tags.find(isAgeTag) ?? "Adult",
          "dnd-assistant-id": npc.id,
          "dnd-assistant-sync": new Date().toISOString(),
        };
        const body = `\n# General\n\n${npc.description ?? ""}\n\n# GM Notes\n\n${npc.role ? `Role: ${npc.role}` : ""}\n`;
        await fs.writeFile(filePath, serializeFrontmatter(fm) + "\n" + body, "utf-8");
      }
      result.npcs.exported++;
    } catch (e: any) { result.npcs.errors.push(`${npc.name}: ${e.message}`); }
  }

  // Sessions
  const sessions = await prisma.session.findMany({ where: { campaignId }, orderBy: { sessionNumber: "asc" } });
  for (const session of sessions) {
    try {
      const dateStr = session.playedAt?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      const fm: Record<string, any> = {
        NoteIcon: "journal",
        type: "Session Journal",
        sessionDate: dateStr,
        OneLiner: session.summary ?? `Session ${session.sessionNumber}`,
        tags: ["journal", "Category/Journal"],
        obsidianUIMode: "preview",
        "dnd-assistant-id": session.id,
        "dnd-assistant-sync": new Date().toISOString(),
      };
      const body = `\n# Session Overview\n\n${session.summary ?? ""}\n\n# Notes\n\n${session.notes ?? ""}\n`;
      const title = `${dateStr} - ${session.title}`;
      const sessionPath = path.join(dirs.journal, `${sanitizeFilename(title)}.md`);
      const sessionExists = await fs.access(sessionPath).then(() => true).catch(() => false);
      if (!sessionExists) {
        await fs.writeFile(sessionPath, serializeFrontmatter(fm) + "\n" + body, "utf-8");
      }
      result.sessions.exported++;
    } catch (e: any) { result.sessions.errors.push(`${session.title}: ${e.message}`); }
  }

  // Factions
  const factions = await prisma.faction.findMany({ where: { campaignId } });
  for (const faction of factions) {
    try {
      let tags: string[] = [];
      try { tags = JSON.parse(faction.tags); } catch {}
      const fm: Record<string, any> = {
        tags: ["Category/Group"],
        obsidianUIMode: "preview",
        MyCategory: tags[0] ?? "Unknown",
        "dnd-assistant-id": faction.id,
        "dnd-assistant-sync": new Date().toISOString(),
      };
      const body = `\n# General\n\n${faction.description ?? ""}\n\n# Goals\n\n# GM Notes\n\n`;
      const factionPath = path.join(dirs.groups, `${sanitizeFilename(faction.name)}.md`);
      const factionExists = await fs.access(factionPath).then(() => true).catch(() => false);
      if (!factionExists) {
        await fs.writeFile(factionPath, serializeFrontmatter(fm) + "\n" + body, "utf-8");
      }
      result.factions.exported++;
    } catch (e: any) { result.factions.errors.push(`${faction.name}: ${e.message}`); }
  }

  // Locations
  const locations = await prisma.location.findMany({ where: { campaignId } });
  for (const location of locations) {
    try {
      let tags: string[] = [];
      try { tags = JSON.parse(location.tags); } catch {}
      const fm: Record<string, any> = {
        tags: ["Category/Place"],
        obsidianUIMode: "preview",
        MyCategory: tags[0] ?? "Unknown",
        "dnd-assistant-id": location.id,
        "dnd-assistant-sync": new Date().toISOString(),
      };
      const body = `\n# General\n\n${location.description ?? ""}\n\n# GM Notes\n\n`;
      const locationPath = path.join(dirs.places, `${sanitizeFilename(location.name)}.md`);
      const locationExists = await fs.access(locationPath).then(() => true).catch(() => false);
      if (!locationExists) {
        await fs.writeFile(locationPath, serializeFrontmatter(fm) + "\n" + body, "utf-8");
      }
      result.locations.exported++;
    } catch (e: any) { result.locations.errors.push(`${location.name}: ${e.message}`); }
  }

  return result;
}

// ─── Config helpers ───────────────────────────────────────────────────────────
export async function saveVaultPath(vaultPath: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: "obsidian_vault_path" },
    create: { key: "obsidian_vault_path", value: vaultPath },
    update: { value: vaultPath },
  });
}

export async function verifyVault(vaultPath: string) {
  try {
    await fs.access(vaultPath);
    const entries = await fs.readdir(vaultPath);
    return {
      valid: true,
      hasTemplates: entries.some(e => e.toLowerCase().includes("template")),
      hasPeople: entries.some(e => ["people","npcs","characters","party","1-party"].includes(e.toLowerCase())),
      hasJournals: entries.some(e => ["journal","sessions","1-session","sesiones"].includes(e.toLowerCase())),
      detectedFolders: entries.filter(e => !e.startsWith(".")),
    };
  } catch {
    return { valid: false, hasTemplates: false, hasPeople: false, hasJournals: false, detectedFolders: [] };
  }
}
