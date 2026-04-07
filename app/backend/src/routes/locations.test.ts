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
  const user = await prisma.user.create({ data: { name: "Test User Locations" } });
  const campaign = await prisma.campaign.create({
    data: { title: "Campaña de Test Locations", userId: user.id },
  });
  userId = user.id;
  campaignId = campaign.id;
});

afterEach(async () => {
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.location.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("POST /api/locations — authorType", () => {
  it('con authorType "assistant" → responde 201 con la localización creada', async () => {
    const res = await request.post("/api/locations").send({
      campaignId,
      name: "Castillo Ravenloft",
      description: "Una fortaleza oscura en lo alto de una colina brumosa.",
      authorType: "assistant",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Castillo Ravenloft");

    const log = await prisma.changeLog.findFirst({
      where: { entityId: res.body.data.id },
    });
    expect(log?.authorType).toBe("ai");
    expect(log?.source).toBe("ai_assistant");
  });

  it("sin nombre → responde 400", async () => {
    const res = await request.post("/api/locations").send({
      campaignId,
      description: "Una localización sin nombre.",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
