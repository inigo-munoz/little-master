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
  // The campaign routes are bound to MVP_USER_ID = "default-user".
  await prisma.user.upsert({
    where: { id: "default-user" },
    update: {},
    create: { id: "default-user", name: "Default User" },
  });
  const res = await request.post("/api/campaigns").send({ title: "Campaign delete test" });
  expect(res.status).toBe(201);
  campaignId = res.body.data.id;
});

afterEach(async () => {
  await prisma.document.deleteMany({ where: { campaignId } });
  await prisma.session.deleteMany({ where: { campaignId } });
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.changeLog.deleteMany({ where: { entityId: campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

function createDocument(title: string) {
  return prisma.document.create({
    data: {
      campaignId,
      title,
      path: `${campaignId}/${title}.md`,
      contentType: "markdown",
      sourceType: "campaign",
      authorityLevel: "medium",
    },
  });
}

describe("DELETE /api/campaigns/:id", () => {
  it("refuses with 409 while the campaign still has documents, and changes nothing", async () => {
    const doc1 = await createDocument("notes");
    await createDocument("handout");

    const res = await request.delete(`/api/campaigns/${campaignId}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("CAMPAIGN_HAS_DOCUMENTS");
    expect(res.body.error.details).toEqual({ documentCount: 2 });

    expect(await prisma.campaign.findUnique({ where: { id: campaignId } })).not.toBeNull();
    const stillOwned = await prisma.document.findUniqueOrThrow({ where: { id: doc1.id } });
    expect(stillOwned.campaignId).toBe(campaignId);
    const deletionLog = await prisma.changeLog.findFirst({
      where: { entityId: campaignId, reason: "Campaign deleted" },
    });
    expect(deletionLog).toBeNull();
  });

  it("still deletes a campaign without documents, cascading its entities and logging it", async () => {
    await prisma.session.create({ data: { campaignId, sessionNumber: 1, title: "Session 1" } });

    const res = await request.delete(`/api/campaigns/${campaignId}`);

    expect(res.status).toBe(204);
    expect(await prisma.campaign.findUnique({ where: { id: campaignId } })).toBeNull();
    expect(await prisma.session.count({ where: { campaignId } })).toBe(0);
    const deletionLog = await prisma.changeLog.findFirst({
      where: { entityId: campaignId, reason: "Campaign deleted" },
    });
    expect(deletionLog).not.toBeNull();
  });
});
