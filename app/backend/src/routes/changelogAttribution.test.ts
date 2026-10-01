import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import { buildTestApp } from "../test/app.js";
import { prisma } from "../db/prisma.js";

// Verifica que cada PATCH propague authorType y reason al changelog, y que sin
// ellos se conserve el comportamiento anterior ("user" + motivo por defecto).

let request: ReturnType<typeof supertest>;
let app: Awaited<ReturnType<typeof buildTestApp>>;
let campaignId: string;

interface Case {
  name: string;
  entityType: string;
  defaultReason: string;
  create: () => Promise<string>;
  path: (id: string) => string;
  body: Record<string, unknown>;
}

const cases: Case[] = [
  {
    name: "npcs",
    entityType: "npc",
    defaultReason: "NPC updated",
    create: async () => (await prisma.npc.create({ data: { campaignId, name: "Aldric" } })).id,
    path: (id) => `/api/npcs/${id}`,
    body: { role: "Herrero" },
  },
  {
    name: "sessions",
    entityType: "session",
    defaultReason: "Session updated",
    create: async () =>
      (await prisma.session.create({ data: { campaignId, title: "S1", sessionNumber: 1 } })).id,
    path: (id) => `/api/sessions/${id}`,
    body: { title: "S1 editada" },
  },
  {
    name: "locations",
    entityType: "location",
    defaultReason: "Location updated",
    create: async () => (await prisma.location.create({ data: { campaignId, name: "Puerto" } })).id,
    path: (id) => `/api/locations/${id}`,
    body: { description: "Un puerto nuboso" },
  },
  {
    name: "factions",
    entityType: "faction",
    defaultReason: "Faction updated",
    create: async () => (await prisma.faction.create({ data: { campaignId, name: "Gremio" } })).id,
    path: (id) => `/api/factions/${id}`,
    body: { description: "Comerciantes" },
  },
  {
    name: "players",
    entityType: "player",
    defaultReason: "Player character updated",
    create: async () => (await prisma.player.create({ data: { campaignId, name: "Frodo" } })).id,
    path: (id) => `/api/players/${id}`,
    body: { notes: "Lleva el anillo" },
  },
  {
    name: "campaigns",
    entityType: "campaign",
    defaultReason: "Campaign updated",
    create: async () => campaignId,
    path: (id) => `/api/campaigns/${id}`,
    body: { description: "Nueva descripción" },
  },
];

beforeAll(async () => {
  app = await buildTestApp();
  request = supertest(app.server);
});

beforeEach(async () => {
  await prisma.user.upsert({
    where: { id: "default-user" },
    update: {},
    create: { id: "default-user", name: "Default User" },
  });
  const campaign = await prisma.campaign.create({
    data: { title: "Campaña Atribución", userId: "default-user" },
  });
  campaignId = campaign.id;
});

afterEach(async () => {
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.npc.deleteMany({ where: { campaignId } });
  await prisma.session.deleteMany({ where: { campaignId } });
  await prisma.location.deleteMany({ where: { campaignId } });
  await prisma.faction.deleteMany({ where: { campaignId } });
  await prisma.player.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function lastLog(entityType: string, entityId: string) {
  return prisma.changeLog.findFirst({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}

describe.each(cases)("PATCH $name — atribución en el changelog", (c) => {
  it('authorType "assistant" + reason → fila con authorType "ai", source "ai_assistant" y ese reason', async () => {
    const id = await c.create();
    const res = await request
      .patch(c.path(id))
      .send({ ...c.body, authorType: "assistant", reason: "Confirmado por el DM en sesión" });

    expect(res.status).toBe(200);
    const log = await lastLog(c.entityType, id);
    expect(log?.authorType).toBe("ai");
    expect(log?.source).toBe("ai_assistant");
    expect(log?.reason).toBe("Confirmado por el DM en sesión");
  });

  it("sin authorType ni reason → sigue registrando 'user' con el motivo por defecto", async () => {
    const id = await c.create();
    const res = await request.patch(c.path(id)).send(c.body);

    expect(res.status).toBe(200);
    const log = await lastLog(c.entityType, id);
    expect(log?.authorType).toBe("user");
    expect(log?.source).toBe("user");
    expect(log?.reason).toBe(c.defaultReason);
  });

  it("authorType inválido → 400", async () => {
    const id = await c.create();
    const res = await request.patch(c.path(id)).send({ ...c.body, authorType: "robot" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH — authorType y reason no se filtran a la entidad", () => {
  it("el payload del changelog de un player no contiene reason ni authorType", async () => {
    const id = (await prisma.player.create({ data: { campaignId, name: "Sam" } })).id;
    const res = await request
      .patch(`/api/players/${id}`)
      .send({ notes: "x", authorType: "assistant", reason: "r" });
    expect(res.status).toBe(200);
    const log = await lastLog("player", id);
    expect(log?.afterJson).not.toContain('"authorType"');
  });
});
