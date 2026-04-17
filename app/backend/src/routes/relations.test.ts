import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { prisma } from "../db/prisma.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { relationRoutes } from "./relations.js";

let campaignId: string;
let npcId: string;
let factionId: string;
let locationId: string;

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  app.setErrorHandler(errorHandler);
  await app.register(relationRoutes, { prefix: "/api/relations" });
  await app.ready();
  return app;
}

beforeAll(async () => {
  const user = await prisma.user.upsert({
    where: { id: "test-user-relations" },
    update: {},
    create: { id: "test-user-relations", name: "Test User" },
  });

  const campaign = await prisma.campaign.create({
    data: { title: "Campaña test relaciones", userId: user.id },
  });
  campaignId = campaign.id;

  const npc = await prisma.npc.create({
    data: { campaignId, name: "Gandalf", status: "alive" },
  });
  npcId = npc.id;

  const faction = await prisma.faction.create({
    data: { campaignId, name: "Gremio de los Magos" },
  });
  factionId = faction.id;

  const location = await prisma.location.create({
    data: { campaignId, name: "Torre del Hechicero" },
  });
  locationId = location.id;
});

afterAll(async () => {
  await prisma.entityRelation.deleteMany({ where: { campaignId } });
  await prisma.npc.deleteMany({ where: { campaignId } });
  await prisma.faction.deleteMany({ where: { campaignId } });
  await prisma.location.deleteMany({ where: { campaignId } });
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.campaign.delete({ where: { id: campaignId } });
  await prisma.user.delete({ where: { id: "test-user-relations" } });
  await prisma.$disconnect();
});

describe("POST /api/relations", () => {
  it("crea relación npc-faction válida", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/relations",
      payload: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "faction",
        toId: factionId,
        relationType: "miembro",
      },
    });
    await app.close();
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.relationType).toBe("miembro");
  });

  it("rechaza relationType inválido para el par", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/relations",
      payload: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "faction",
        toId: factionId,
        relationType: "frontera con",
      },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
  });

  it("rechaza par de tipos desconocido", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/relations",
      payload: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "session",
        toId: "any-id",
        relationType: "aliado",
      },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/relations", () => {
  it("devuelve relaciones en ambas direcciones para la entidad", async () => {
    const app = await buildApp();

    await prisma.entityRelation.create({
      data: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "faction",
        toId: factionId,
        relationType: "líder",
      },
    });

    const resNpc = await app.inject({
      method: "GET",
      url: `/api/relations?campaignId=${campaignId}&entityType=npc&entityId=${npcId}`,
    });
    const resFaction = await app.inject({
      method: "GET",
      url: `/api/relations?campaignId=${campaignId}&entityType=faction&entityId=${factionId}`,
    });
    await app.close();

    expect(resNpc.statusCode).toBe(200);
    const npcBody = JSON.parse(resNpc.body);
    expect(npcBody.data.length).toBeGreaterThanOrEqual(1);
    expect(npcBody.data.some((r: any) => r.entity.id === factionId)).toBe(true);

    expect(resFaction.statusCode).toBe(200);
    const factionBody = JSON.parse(resFaction.body);
    expect(factionBody.data.some((r: any) => r.entity.id === npcId)).toBe(true);
  });
});

describe("DELETE /api/relations/:id", () => {
  it("elimina la relación y devuelve 204", async () => {
    const app = await buildApp();

    const rel = await prisma.entityRelation.create({
      data: {
        campaignId,
        fromType: "npc",
        fromId: npcId,
        toType: "location",
        toId: locationId,
        relationType: "residente",
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/relations/${rel.id}`,
    });
    await app.close();

    expect(res.statusCode).toBe(204);

    const found = await prisma.entityRelation.findUnique({ where: { id: rel.id } });
    expect(found).toBeNull();
  });

  it("devuelve 404 para relación inexistente", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/relations/no-existe-id",
    });
    await app.close();
    expect(res.statusCode).toBe(404);
  });
});
