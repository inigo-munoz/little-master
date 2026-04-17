import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import { buildTestApp } from "../test/app.js";
import { prisma } from "../db/prisma.js";

let request: ReturnType<typeof supertest>;
let app: Awaited<ReturnType<typeof buildTestApp>>;
let campaignId: string;

beforeAll(async () => {
  app = await buildTestApp();
  request = supertest(app.server);
});

beforeEach(async () => {
  // Asegurarse de que existe el usuario MVP (MVP_USER_ID = "default-user")
  await prisma.user.upsert({
    where: { id: "default-user" },
    update: {},
    create: { id: "default-user", name: "Default User" },
  });

  // Crear la campaña via la ruta para que quede asociada a MVP_USER_ID
  const res = await request.post("/api/campaigns").send({ title: "Campaña de Test Dashboard" });
  campaignId = res.body.data.id;

  // Crear entidades de prueba para verificar conteos
  await prisma.npc.create({ data: { campaignId, name: "Gandalf", status: "alive" } });
  await prisma.npc.create({ data: { campaignId, name: "Sauron", status: "alive" } });
  await prisma.location.create({ data: { campaignId, name: "La Comarca" } });
  await prisma.faction.create({ data: { campaignId, name: "Istari" } });
  await prisma.faction.create({ data: { campaignId, name: "Nazgûl" } });
  await prisma.player.create({
    data: {
      campaignId,
      name: "Frodo",
      playerName: "Jugador1",
      class: "Pícaro",
      level: 3,
      hp: 20,
      ac: 13,
    },
  });
});

afterEach(async () => {
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.player.deleteMany({ where: { campaignId } });
  await prisma.faction.deleteMany({ where: { campaignId } });
  await prisma.location.deleteMany({ where: { campaignId } });
  await prisma.npc.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  // No borrar el usuario "default-user" ya que es compartido
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("GET /api/campaigns — _count", () => {
  it("devuelve _count con sessions, npcs, issues, locations, factions, players", async () => {
    const res = await request.get("/api/campaigns");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const campaign = res.body.data.find((c: any) => c.id === campaignId);
    expect(campaign).toBeDefined();
    expect(campaign._count.npcs).toBe(2);
    expect(campaign._count.locations).toBe(1);
    expect(campaign._count.factions).toBe(2);
    expect(campaign._count.players).toBe(1);
    expect(campaign._count.sessions).toBe(0);
  });
});
