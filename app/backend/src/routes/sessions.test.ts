import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import { buildTestApp } from "../test/app.js";
import { prisma } from "../db/prisma.js";

let request: ReturnType<typeof supertest>;
let app: Awaited<ReturnType<typeof buildTestApp>>;
let userId: string;
let campaignId: string;

beforeAll(async () => {
  app = await buildTestApp();
  request = supertest(app.server);
});

beforeEach(async () => {
  // Creamos usuario y campaña frescos en cada test para evitar interferencias
  // con otros test files que hacen deleteMany() sin filtro en su afterAll.
  const user = await prisma.user.create({ data: { name: "Test User Sessions" } });
  const campaign = await prisma.campaign.create({
    data: { title: "Campaña de Test Sessions", userId: user.id },
  });
  userId = user.id;
  campaignId = campaign.id;
});

afterEach(async () => {
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.session.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("POST /api/sessions — authorType", () => {
  it('con authorType "assistant" → changelog tiene authorType "ai"', async () => {
    const res = await request.post("/api/sessions").send({
      campaignId,
      title: "La Caverna del Dragón",
      summary: "El grupo exploró la caverna y encontró el tesoro.",
      sessionNumber: 1,
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

  it('sin authorType → changelog tiene authorType "user"', async () => {
    const res = await request.post("/api/sessions").send({
      campaignId,
      title: "La Taberna del Jabalí",
      sessionNumber: 2,
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

  it("sin campaignId → responde 400", async () => {
    const res = await request.post("/api/sessions").send({
      title: "Sin campaña",
      sessionNumber: 1,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("sessionNumber duplicado en la misma campaña → 409 DUPLICATE_SESSION_NUMBER", async () => {
    // Crear primera sesión
    await request.post("/api/sessions").send({
      campaignId,
      title: "Primera Sesión",
      sessionNumber: 5,
    });

    // Intentar crear segunda con el mismo número
    const res = await request.post("/api/sessions").send({
      campaignId,
      title: "Segunda Sesión — Duplicada",
      sessionNumber: 5,
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("DUPLICATE_SESSION_NUMBER");
    expect(res.body.error.message).toContain("número");
  });
});

describe("DELETE /api/sessions/:id", () => {
  it("→ 204, borra la sesión y registra changelog con beforeJson", async () => {
    const session = await prisma.session.create({
      data: { campaignId, title: "Sesión a Borrar", sessionNumber: 99 },
    });

    const res = await request.delete(`/api/sessions/${session.id}`);
    expect(res.status).toBe(204);

    const deleted = await prisma.session.findUnique({ where: { id: session.id } });
    expect(deleted).toBeNull();

    // El changelog se escribe en la misma transacción que el delete
    const log = await prisma.changeLog.findFirst({
      where: { entityType: "session", entityId: session.id },
    });
    expect(log).not.toBeNull();
    expect(log?.reason).toBe("Session deleted");
    expect(log?.afterJson).toBeNull();
    expect(JSON.parse(log?.beforeJson ?? "{}").title).toBe("Sesión a Borrar");
  });

  it("con id inexistente → 404", async () => {
    const res = await request.delete("/api/sessions/no-existe");
    expect(res.status).toBe(404);
  });
});
