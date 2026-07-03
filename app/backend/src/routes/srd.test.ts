import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import Fastify from "fastify";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { srdRoutes } from "./srd.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { prisma } from "../db/prisma.js";

const DOCUMENTS_DIR = process.env["DOCUMENTS_DIR"] ?? "/tmp/dnd-test-documents";
const DATA_DIR = process.env["DATA_DIR"] ?? "/tmp/dnd-test-data";
const TEST_FILE_PATH = "global/srd-monsters-test.txt";
const PRIVATE_MONSTER_DIR = join(DATA_DIR, "private", "mm2024");
const PRIVATE_MONSTER_PATH = join(PRIVATE_MONSTER_DIR, "monster-data.json");

// Contenido de prueba en el formato real del SRD 5.2.1
const TEST_MONSTER_FILE = `Monsters A–Z

Goblin
Small Humanoid (Goblinoid), Neutral Evil
AC 15\t\t
Initiative +3 (13)
HP 7 (2d6)
Speed 30 ft.
MOD SAVE

Str 8 −1 −1
Dex 14 +2 +2
Con 10 +0 +0
Int 10 +0 +0
Wis 8 −1 −1
Cha 8 −1 −1

Senses Darkvision 60 ft.; Passive Perception 9
Languages Goblin, Common
CR 1/4 (XP 50; PB +2)

Actions
Scimitar. Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage.

Dragon Wyrmling
Dragon Wyrmling
Small Dragon, Chaotic Evil
AC 17\t\t
Initiative +2 (12)
HP 45 (7d8 + 14)
Speed 30 ft., fly 60 ft.
MOD SAVE

Str 17 +3 +3
Dex 10 +0 +0
Con 15 +2 +2
Int 12 +1 +1
Wis 11 +0 +0
Cha 15 +2 +2

Senses Blindsight 10 ft., Darkvision 60 ft.; Passive Perception 12
Languages Draconic
CR 2 (XP 450; PB +2)

Actions
Bite. Melee Attack Roll: +5, reach 5 ft. Hit: 8 (1d10 + 3) Piercing damage.

Zombie
Zombie
Medium Undead, Neutral Evil
AC 8\t\t
Initiative −2 (8)
HP 22 (3d8 + 9)
Speed 20 ft.
MOD SAVE

Str 13 +1 +1
Dex 6 −2 −2
Con 16 +3 +3
Int 3 −4 −4
Wis 6 −2 −2
Cha 5 −3 −3

Immunities Poison; Exhaustion, Poisoned
Senses Darkvision 60 ft.; Passive Perception 8
Languages Understands languages it knew in life but can't speak
CR 1/4 (XP 50; PB +2)
`;

let app: ReturnType<typeof Fastify>;
let request: ReturnType<typeof supertest>;
let docId: string;

beforeAll(async () => {
  await fs.mkdir(join(DOCUMENTS_DIR, "global"), { recursive: true });

  app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  await app.register(srdRoutes, { prefix: "/api/srd" });
  await app.ready();
  request = supertest(app.server);
});

beforeEach(async () => {
  await fs.writeFile(join(DOCUMENTS_DIR, TEST_FILE_PATH), TEST_MONSTER_FILE, "utf-8");

  const doc = await prisma.document.create({
    data: {
      title: "SRD 5.2.1 — Monsters Test",
      path: TEST_FILE_PATH,
      contentType: "plaintext",
      sourceType: "srd",
      authorityLevel: "high",
      isIndexed: true,
    },
  });
  docId = doc.id;
});

afterEach(async () => {
  await prisma.documentChunk.deleteMany({ where: { documentId: docId } });
  await prisma.document.deleteMany({ where: { id: docId } });
  await fs.rm(join(DOCUMENTS_DIR, TEST_FILE_PATH), { force: true });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

// ─── GET /api/srd/monsters ────────────────────────────────────────────────────

describe("GET /api/srd/monsters", () => {
  it("devuelve 200 con array de monstruos extraídos del fichero SRD", async () => {
    const res = await request.get("/api/srd/monsters");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const names = res.body.data.map((m: { name: string }) => m.name);
    expect(names).toContain("Goblin");
  });

  it("cada monstruo tiene campos name, cr, type, size correctos", async () => {
    const res = await request.get("/api/srd/monsters");

    const goblin = res.body.data.find((m: { name: string }) => m.name === "Goblin");
    expect(goblin).toBeDefined();
    expect(goblin.cr).toBe("1/4");
    expect(goblin.size).toBe("Small");
    expect(goblin.type).toContain("Humanoid");
  });

  it("?q=dragon filtra por nombre case-insensitive", async () => {
    const res = await request.get("/api/srd/monsters?q=dragon");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const names = res.body.data.map((m: { name: string }) => m.name);
    expect(names).toContain("Dragon Wyrmling");
    expect(names).not.toContain("Goblin");
    expect(names).not.toContain("Zombie");
  });

  it("?q=ZOMBIE filtra correctamente en mayúsculas", async () => {
    const res = await request.get("/api/srd/monsters?q=ZOMBIE");

    expect(res.status).toBe(200);
    const names = res.body.data.map((m: { name: string }) => m.name);
    expect(names).toContain("Zombie");
    expect(names).not.toContain("Goblin");
  });

  it("devuelve array vacío si no existe el documento SRD de monstruos", async () => {
    // Eliminar el documento antes de la petición
    await prisma.documentChunk.deleteMany({ where: { documentId: docId } });
    await prisma.document.deleteMany({ where: { id: docId } });
    docId = ""; // evitar doble cleanup en afterEach

    const res = await request.get("/api/srd/monsters");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ─── Overlay privado (data/private/mm2024/monster-data.json) ────────────────

const PRIVATE_NEW_MONSTER = {
  name: "Umbral Wraith",
  source: "MM 2024",
  size: "Medium",
  type: "Undead",
  alignment: "Chaotic Evil",
  cr: "3",
  xp: 700,
  pb: 2,
  ac: 14,
  hp: 60,
  speed: "9 m, fly 18 m",
  str: 6,
  dex: 16,
  con: 16,
  int: 12,
  wis: 14,
  cha: 15,
  savingThrows: "DES +5",
  skills: "Sigilo +5",
  vulnerabilities: "",
  resistances: "Necrotic",
  conditionImmunities: "Exhaustion",
  damageImmunities: "Poison",
  senses: "Darkvision 18 m",
  passivePerception: 12,
  languages: "Common",
  traits: "Incorporeal Movement, Sunlight Sensitivity",
  legendaryResistances: 0,
  actions: [{ name: "Life Drain", description: "Melee Attack Roll: +5. Hit: 21 (4d8 + 3) Necrotic damage." }],
  spellcasting: "The wraith casts Invisibility at will.",
  bonusAction: "Shadow Step: teleports between shadows it can see within 9 m.",
  reaction: "Dodge: avoids an incoming attack.",
  legendaryActions: "Move: the wraith moves up to half its speed.",
  lair: false,
};

// Same name as the SRD fixture's "Goblin" (cr 1/4, Humanoid, no ac/hp exposed
// on the list). The private version must win on duplicates.
const PRIVATE_DUPLICATE_MONSTER = {
  name: "Goblin",
  source: "MM 2024 Reskin",
  size: "Large",
  type: "Fiend",
  alignment: "Chaotic Evil",
  cr: "5",
  xp: 1800,
  pb: 3,
  ac: 99,
  hp: 999,
  speed: "9 m",
  str: 18,
  dex: 14,
  con: 18,
  int: 8,
  wis: 10,
  cha: 12,
  savingThrows: "",
  skills: "",
  vulnerabilities: "",
  resistances: "",
  conditionImmunities: "",
  damageImmunities: "",
  senses: "",
  passivePerception: 10,
  languages: "",
  traits: "",
  legendaryResistances: 0,
  actions: [],
  spellcasting: null,
  bonusAction: "",
  reaction: "",
  legendaryActions: "",
  lair: false,
};

async function writePrivateMonsterFile(content: unknown) {
  await fs.mkdir(PRIVATE_MONSTER_DIR, { recursive: true });
  await fs.writeFile(PRIVATE_MONSTER_PATH, JSON.stringify(content), "utf-8");
}

describe("Overlay privado de monstruos (data/private/mm2024/monster-data.json)", () => {
  afterEach(async () => {
    await fs.rm(PRIVATE_MONSTER_DIR, { recursive: true, force: true });
  });

  it("sin fichero privado, GET /monsters devuelve solo SRD (comportamiento actual intacto)", async () => {
    const res = await request.get("/api/srd/monsters");

    expect(res.status).toBe(200);
    const names = res.body.data.map((m: { name: string }) => m.name);
    expect(names).toContain("Goblin");

    const goblin = res.body.data.find((m: { name: string }) => m.name === "Goblin");
    expect(goblin.cr).toBe("1/4");
    expect(goblin.source).toBe("srd");
    expect(goblin.ac).toBeUndefined();
    expect(goblin.hp).toBeUndefined();

    expect(res.body.data.some((m: { source?: string }) => m.source === "mm")).toBe(false);
  });

  it("con fichero privado, GET /monsters incluye la entrada nueva etiquetada 'mm' y el duplicado lo sirve la versión privada", async () => {
    await writePrivateMonsterFile([PRIVATE_NEW_MONSTER, PRIVATE_DUPLICATE_MONSTER]);

    const res = await request.get("/api/srd/monsters");
    expect(res.status).toBe(200);

    const wraith = res.body.data.find((m: { name: string }) => m.name === "Umbral Wraith");
    expect(wraith).toBeDefined();
    expect(wraith.source).toBe("mm");
    expect(wraith.ac).toBe(14);
    expect(wraith.hp).toBe(60);

    const goblinEntries = res.body.data.filter((m: { name: string }) => m.name === "Goblin");
    expect(goblinEntries).toHaveLength(1);
    expect(goblinEntries[0].source).toBe("mm");
    expect(goblinEntries[0].cr).toBe("5");
    expect(goblinEntries[0].type).toBe("Fiend");
    expect(goblinEntries[0].ac).toBe(99);
    expect(goblinEntries[0].hp).toBe(999);
  });

  it("un fichero privado ausente o no parseable produce overlay vacío sin error", async () => {
    await fs.mkdir(PRIVATE_MONSTER_DIR, { recursive: true });
    await fs.writeFile(PRIVATE_MONSTER_PATH, "{ esto no es JSON válido", "utf-8");

    const res = await request.get("/api/srd/monsters");
    expect(res.status).toBe(200);
    expect(res.body.data.some((m: { source?: string }) => m.source === "mm")).toBe(false);
    const names = res.body.data.map((m: { name: string }) => m.name);
    expect(names).toContain("Goblin");
  });

  it("GET /monsters/:name de una entrada privada devuelve el stat block completo mapeado", async () => {
    await writePrivateMonsterFile([PRIVATE_NEW_MONSTER, PRIVATE_DUPLICATE_MONSTER]);

    const res = await request.get("/api/srd/monsters/Umbral%20Wraith");
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toBeDefined();

    expect(data.name).toBe("Umbral Wraith");
    expect(data.size).toBe("Medium");
    expect(data.type).toBe("Undead");
    expect(data.alignment).toBe("Chaotic Evil");
    expect(data.ac).toBe("14");
    expect(data.hp).toBe("60");
    expect(data.speed).toBe("9 m, fly 18 m");
    expect(data.str).toBe(6);
    expect(data.cha).toBe(15);
    expect(data.savingThrows).toBe("DES +5");
    expect(data.skills).toBe("Sigilo +5");
    expect(data.resistances).toBe("Necrotic");
    expect(data.immunities).toBe("Poison");
    expect(data.conditionImmunities).toBe("Exhaustion");
    expect(data.senses).toBe("Darkvision 18 m, percepción pasiva 12");
    expect(data.languages).toBe("Common");
    expect(data.cr).toBe("3");
    expect(data.xp).toBe("700 XP");
    expect(data.profBonus).toBe("+2");

    expect(data.traits).toEqual([
      { name: "Incorporeal Movement", description: "" },
      { name: "Sunlight Sensitivity", description: "" },
      { name: "Spellcasting", description: "The wraith casts Invisibility at will." },
    ]);
    expect(data.actions).toEqual([
      { name: "Life Drain", description: "Melee Attack Roll: +5. Hit: 21 (4d8 + 3) Necrotic damage." },
    ]);
    expect(data.bonusActions).toHaveLength(1);
    expect(data.bonusActions[0].description).toBe("Shadow Step: teleports between shadows it can see within 9 m.");
    expect(data.reactions).toHaveLength(1);
    expect(data.reactions[0].description).toBe("Dodge: avoids an incoming attack.");
    expect(data.legendaryActions).toHaveLength(1);
    expect(data.legendaryActions[0].description).toBe("Move: the wraith moves up to half its speed.");
  });
});
