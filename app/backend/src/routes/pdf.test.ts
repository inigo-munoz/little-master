import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import { buildTestApp } from "../test/app.js";
import { prisma } from "../db/prisma.js";

let request: ReturnType<typeof supertest>;
let app: Awaited<ReturnType<typeof buildTestApp>>;
let userId: string;
let campaignId: string;
let npcId: string;
let sessionId: string;
let locationId: string;
let factionId: string;

beforeAll(async () => {
  app = await buildTestApp();
  request = supertest(app.server);
});

beforeEach(async () => {
  const user = await prisma.user.create({ data: { name: "Test User PDF" } });
  const campaign = await prisma.campaign.create({
    data: { title: "Campaña Test PDF", userId: user.id },
  });
  userId = user.id;
  campaignId = campaign.id;

  const npc = await prisma.npc.create({
    data: {
      campaignId,
      name: "Aldric el Herrero",
      role: "Herrero",
      description: "Un herrero de mediana edad con manos curtidas por años de trabajo en la fragua.",
      status: "alive",
    },
  });
  npcId = npc.id;

  const session = await prisma.session.create({
    data: {
      campaignId,
      title: "La Cueva del Dragón",
      sessionNumber: 1,
      summary: "El grupo exploró la cueva y encontró el tesoro.",
    },
  });
  sessionId = session.id;

  const location = await prisma.location.create({
    data: {
      campaignId,
      name: "Castillo Ravenloft",
      description: "Una fortaleza oscura en lo alto de una colina.",
    },
  });
  locationId = location.id;

  const faction = await prisma.faction.create({
    data: {
      campaignId,
      name: "Los Telentáculos",
      description: "Una organización criminal.",
    },
  });
  factionId = faction.id;
});

afterEach(async () => {
  await prisma.faction.deleteMany({ where: { campaignId } });
  await prisma.location.deleteMany({ where: { campaignId } });
  await prisma.session.deleteMany({ where: { campaignId } });
  await prisma.npc.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("GET /api/pdf/:entity/:id", () => {
  it("NPC con ID válido → 200 con Content-Type application/pdf", async () => {
    const res = await request.get(`/api/pdf/npc/${npcId}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    // Los PDFs empiezan con %PDF-
    expect(res.body.toString().slice(0, 4)).toBe("%PDF");
  });

  it("NPC con ID inexistente → 404", async () => {
    const res = await request.get("/api/pdf/npc/npc-que-no-existe");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("Sesión con ID válido → 200 con Content-Type application/pdf", async () => {
    const res = await request.get(`/api/pdf/session/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("Localización con ID válido → 200 con Content-Type application/pdf", async () => {
    const res = await request.get(`/api/pdf/location/${locationId}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("Facción con ID válido → 200 con Content-Type application/pdf", async () => {
    const res = await request.get(`/api/pdf/faction/${factionId}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("Campaña con ID válido → 200 con Content-Type application/pdf", async () => {
    const res = await request.get(`/api/pdf/campaign/${campaignId}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("Campaña con ID inexistente → 404", async () => {
    const res = await request.get("/api/pdf/campaign/no-existe");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
