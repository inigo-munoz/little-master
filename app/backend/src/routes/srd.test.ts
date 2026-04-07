import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import Fastify from "fastify";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { srdRoutes } from "./srd.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { prisma } from "../db/prisma.js";

const DOCUMENTS_DIR = process.env["DOCUMENTS_DIR"] ?? "/tmp/dnd-test-documents";
const TEST_FILE_PATH = "global/srd-monsters-test.txt";

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
