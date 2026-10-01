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

  const user = await prisma.user.create({ data: { name: "Test User Changelog" } });
  const campaign = await prisma.campaign.create({
    data: { title: "Campaña de Test Changelog", userId: user.id },
  });
  campaignId = campaign.id;
});

afterEach(async () => {
  await prisma.changeLog.deleteMany({ where: { campaignId } });
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { name: "Test User Changelog" } });
  await app.close();
  await prisma.$disconnect();
});

describe("POST /api/changelog", () => {
  it('crea una fila con authorType "ai", source "ai_assistant" y el reason indicado (forma de log_change)', async () => {
    const res = await request.post("/api/changelog").send({
      campaignId,
      entityType: "npc",
      entityId: "npc-123",
      beforeJson: '{"status":"alive"}',
      afterJson: '{"status":"dead"}',
      reason: "Confirmado en la sesión 4",
      authorType: "ai",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const log = await prisma.changeLog.findFirst({ where: { campaignId, entityId: "npc-123" } });
    expect(log).not.toBeNull();
    expect(log?.authorType).toBe("ai");
    expect(log?.source).toBe("ai_assistant");
    expect(log?.reason).toBe("Confirmado en la sesión 4");
    expect(log?.beforeJson).toBe('{"status":"alive"}');
    expect(log?.afterJson).toBe('{"status":"dead"}');
  });

  it("rechaza un authorType inválido con 400 y no escribe nada", async () => {
    const res = await request.post("/api/changelog").send({
      campaignId,
      entityType: "npc",
      entityId: "npc-123",
      reason: "x",
      authorType: "robot",
    });

    expect(res.status).toBe(400);
    expect(await prisma.changeLog.count({ where: { campaignId } })).toBe(0);
  });

  it("rechaza un entityType desconocido con 400", async () => {
    const res = await request.post("/api/changelog").send({
      campaignId,
      entityType: "dragon",
      entityId: "e1",
      reason: "x",
    });
    expect(res.status).toBe(400);
  });

  it("devuelve 404 si la campaña no existe", async () => {
    const res = await request.post("/api/changelog").send({
      campaignId: "no-existe",
      entityType: "npc",
      entityId: "e1",
      reason: "x",
    });
    expect(res.status).toBe(404);
  });

  it("ignora campos desconocidos en vez de pasarlos a Prisma", async () => {
    const res = await request.post("/api/changelog").send({
      campaignId,
      entityType: "npc",
      entityId: "npc-999",
      reason: "x",
      authorType: "ai",
      id: "forzado",
      createdAt: "2000-01-01T00:00:00.000Z",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe("forzado");
  });
});
