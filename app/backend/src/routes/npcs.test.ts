import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import { buildTestApp } from "../test/app.js";
import { prisma } from "../db/prisma.js";

let request: ReturnType<typeof supertest>;
let app: Awaited<ReturnType<typeof buildTestApp>>;
let campaignId: string;

beforeAll(async () => {
  app = await buildTestApp();
  request = supertest(app.server);

  // Creamos el User y la Campaign directamente en Prisma para no depender
  // de otros endpoints. El campaignId se reutiliza en todos los tests de la suite.
  const user = await prisma.user.create({ data: { name: "Test User" } });
  const campaign = await prisma.campaign.create({
    data: { title: "Campaña de Test", userId: user.id },
  });
  campaignId = campaign.id;
});

afterEach(async () => {
  // Limpiamos solo los datos generados por cada test para mantener aislamiento.
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.npc.deleteMany({ where: { campaignId } });
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { name: "Test User" } });
  await app.close();
  await prisma.$disconnect();
});

describe("POST /api/npcs — authorType", () => {
  it('con authorType "assistant" → changelog tiene authorType "ai" y source "ai_assistant"', async () => {
    const res = await request.post("/api/npcs").send({
      campaignId,
      name: "Aldric el Herrero",
      description: "Un herrero de mediana edad con manos curtidas por años de trabajo.",
      authorType: "assistant",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const log = await prisma.changeLog.findFirst({
      where: { entityId: res.body.data.id },
    });
    expect(log).not.toBeNull();
    expect(log?.authorType).toBe("ai");
    expect(log?.source).toBe("ai_assistant");
  });

  it('sin authorType → changelog tiene authorType "user" y source "user"', async () => {
    const res = await request.post("/api/npcs").send({
      campaignId,
      name: "Mira la Exploradora",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const log = await prisma.changeLog.findFirst({
      where: { entityId: res.body.data.id },
    });
    expect(log).not.toBeNull();
    expect(log?.authorType).toBe("user");
    expect(log?.source).toBe("user");
  });

  it('con authorType inválido → responde 400', async () => {
    const res = await request.post("/api/npcs").send({
      campaignId,
      name: "NPC Inválido",
      authorType: "robot",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
