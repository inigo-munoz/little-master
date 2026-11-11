import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import { prisma } from "../db/prisma.js";
import { embeddingService } from "./embedding.service.js";

// Tiny 3-dimensional vectors keep cosine similarity easy to reason about.
const QUERY = [1, 0, 0];

let userId: string;
let campaignId: string;
let otherCampaignId: string;
const docIds: string[] = [];

async function addEmbeddedChunk(scope: string | null, title: string, vector: number[] | null) {
  const doc = await prisma.document.create({
    data: {
      campaignId: scope,
      title,
      path: `test/${title}.md`,
      contentType: "markdown",
      sourceType: "campaign",
      authorityLevel: "medium",
    },
  });
  docIds.push(doc.id);
  return prisma.documentChunk.create({
    data: {
      documentId: doc.id,
      campaignId: scope,
      content: `content of ${title}`,
      chunkIndex: 0,
      sourceType: "campaign",
      authorityLevel: "medium",
      embeddingJson: vector ? JSON.stringify(vector) : null,
    },
  });
}

function vectorLoads(calls: unknown[][]) {
  return calls.filter((call) => {
    const where = (call[0] as { where?: { embeddingJson?: unknown } } | undefined)?.where;
    return where?.embeddingJson !== undefined;
  }).length;
}

const search = () => embeddingService.search({ query: "q", campaignId, limit: 8, minScore: 0.5 });
const titlesOf = (results: { documentTitle: string }[]) => results.map((r) => r.documentTitle);

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { name: "Embedding search test" } })).id;
  campaignId = (await prisma.campaign.create({ data: { title: "ES A", userId } })).id;
  otherCampaignId = (await prisma.campaign.create({ data: { title: "ES B", userId } })).id;

  await addEmbeddedChunk(campaignId, "es-close", [0.9, 0.1, 0]);
  await addEmbeddedChunk(campaignId, "es-closest", [1, 0, 0]);
  await addEmbeddedChunk(campaignId, "es-orthogonal", [0, 1, 0]);
  await addEmbeddedChunk(campaignId, "es-not-embedded", null);
  await addEmbeddedChunk(otherCampaignId, "es-other-campaign", [1, 0, 0]);
});

beforeEach(() => {
  vi.spyOn(embeddingService, "embed").mockResolvedValue(QUERY);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.document.deleteMany({ where: { id: { in: docIds } } });
  await prisma.campaign.deleteMany({ where: { id: { in: [campaignId, otherCampaignId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("embeddingService.search", () => {
  it("ranks embedded chunks by cosine similarity within the campaign and minScore", async () => {
    const results = await search();

    expect(titlesOf(results)).toEqual(["es-closest", "es-close"]);
    expect(results[0]?.content).toBe("content of es-closest");
    expect(results[0]?.rawSimilarity).toBeCloseTo(1, 5);
  });

  it("reads the stored vectors from the database once, not on every query", async () => {
    embeddingService.invalidateVectorCache();
    const findMany = vi.spyOn(prisma.documentChunk, "findMany");

    await search();
    await search();
    await search();

    expect(vectorLoads(findMany.mock.calls)).toBe(1);
  });

  it("picks up a chunk embedded after the cache was built", async () => {
    await search();
    await addEmbeddedChunk(campaignId, "es-new-exact", [1, 0, 0.0001]);

    expect(titlesOf(await search())).toContain("es-new-exact");
  });

  it("stops returning a chunk once it is deleted", async () => {
    const doomed = await addEmbeddedChunk(campaignId, "es-doomed", [1, 0, 0]);
    expect(titlesOf(await search())).toContain("es-doomed");

    await prisma.documentChunk.delete({ where: { id: doomed.id } });

    expect(titlesOf(await search())).not.toContain("es-doomed");
  });
});
