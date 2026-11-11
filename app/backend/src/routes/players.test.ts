import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import { buildTestApp } from "../test/app.js";
import { prisma } from "../db/prisma.js";

let request: ReturnType<typeof supertest>;
let app: Awaited<ReturnType<typeof buildTestApp>>;
let userId: string;
let campaignId: string;
let playerId: string;

beforeAll(async () => {
  app = await buildTestApp();
  request = supertest(app.server);
});

beforeEach(async () => {
  // Fresh user and campaign per test: other test files run deleteMany() without
  // filters in their afterAll, so shared fixtures would be unreliable.
  const user = await prisma.user.create({ data: { name: "Test User Players" } });
  const campaign = await prisma.campaign.create({
    data: { title: "Players test campaign", userId: user.id },
  });
  userId = user.id;
  campaignId = campaign.id;

  const res = await request.post("/api/players").send({ campaignId, name: "Aria" });
  expect(res.status).toBe(201);
  playerId = res.body.data.id;
});

afterEach(async () => {
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.player.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("PATCH /api/players/:id", () => {
  it("persists backgroundLocked so the background lock survives a reload", async () => {
    const patch = await request.patch(`/api/players/${playerId}`).send({ backgroundLocked: true });
    expect(patch.status).toBe(200);
    expect(patch.body.data.backgroundLocked).toBe(true);

    const reloaded = await request.get(`/api/players/${playerId}`);
    expect(reloaded.body.data.backgroundLocked).toBe(true);

    const unlock = await request.patch(`/api/players/${playerId}`).send({ backgroundLocked: false });
    expect(unlock.body.data.backgroundLocked).toBe(false);
    const stored = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    expect(stored.backgroundLocked).toBe(false);
  });

  it("still updates existing fields and records the change in the campaign changelog", async () => {
    const res = await request.patch(`/api/players/${playerId}`).send({ name: "Aria Renamed" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Aria Renamed");

    const log = await prisma.changeLog.findFirst({
      where: { entityId: playerId, reason: "Player character updated" },
    });
    expect(log?.campaignId).toBe(campaignId);
  });
});

describe("DELETE /api/players/:id", () => {
  it("removes the player and logs the deletion under its campaign", async () => {
    const res = await request.delete(`/api/players/${playerId}`);
    expect(res.status).toBe(204);
    expect(await prisma.player.findUnique({ where: { id: playerId } })).toBeNull();

    const log = await prisma.changeLog.findFirst({
      where: { entityId: playerId, reason: "Player deleted" },
    });
    expect(log).not.toBeNull();
    expect(log?.campaignId).toBe(campaignId);
  });
});
