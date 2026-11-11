import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../db/prisma.js";
import { tokenizeQuery, keywordSearch } from "./keyword-search.js";
import { chatService } from "./chat.service.js";
import supertest from "supertest";
import { buildTestApp } from "../test/app.js";

describe("tokenizeQuery", () => {
  it("keeps accented Spanish words whole and drops punctuation and stopwords", () => {
    expect(tokenizeQuery("¿Cómo funciona la bola de fuego?")).toEqual(["funciona", "bola", "fuego"]);
  });

  it("lowercases, drops English stopwords and short tokens, and dedupes", () => {
    expect(tokenizeQuery("What does the Fireball spell do? Fireball!")).toEqual(["fireball", "spell"]);
  });

  it("returns no tokens for a query made only of stopwords", () => {
    expect(tokenizeQuery("¿Qué es eso?")).toEqual([]);
  });
});

describe("keyword retrieval against the database", () => {
  let userId: string;
  let campaignId: string;
  let otherCampaignId: string;
  const docIds: string[] = [];

  async function addChunk(scope: string | null, title: string, content: string, authorityLevel = "medium") {
    const doc = await prisma.document.create({
      data: {
        campaignId: scope,
        title,
        path: `test/${title}.md`,
        contentType: "markdown",
        sourceType: "campaign",
        authorityLevel,
      },
    });
    docIds.push(doc.id);
    await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        campaignId: scope,
        content,
        chunkIndex: 0,
        sourceType: "campaign",
        authorityLevel,
      },
    });
  }

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { name: "Keyword search test" } });
    userId = user.id;
    campaignId = (await prisma.campaign.create({ data: { title: "KW A", userId } })).id;
    otherCampaignId = (await prisma.campaign.create({ data: { title: "KW B", userId } })).id;

    await addChunk(campaignId, "kw-fireball", "La bola de fuego explota en una esfera de 20 pies de radio.");
    await addChunk(campaignId, "kw-partial", "El fuego del hogar calienta la taberna.");
    await addChunk(null, "kw-global", "Reglas globales: la bola de fuego inflige 8d6 de daño de fuego.", "high");
    await addChunk(otherCampaignId, "kw-other", "Otra campaña: bola de fuego secreta.");
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { id: { in: docIds } } });
    await prisma.campaign.deleteMany({ where: { id: { in: [campaignId, otherCampaignId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("ranks chunks by how many query terms they contain, scoped to the campaign plus global", async () => {
    const results = await keywordSearch({
      query: "¿Cómo funciona la bola de fuego?",
      campaignId,
      limit: 8,
    });
    const titles = results.map((r) => r.documentTitle);

    expect(titles).toContain("kw-fireball");
    expect(titles).toContain("kw-global");
    expect(titles).not.toContain("kw-other");
    // "bola" + "fuego" beat a chunk that only mentions "fuego"
    expect(titles.indexOf("kw-partial")).toBeGreaterThan(titles.indexOf("kw-fireball"));
  });

  it("matches capitalized accented words (SQLite LIKE only folds ASCII case)", async () => {
    await addChunk(campaignId, "kw-acid", "Tipos de daño: el daño de Ácido corroe el metal.");
    const results = await keywordSearch({ query: "¿qué hace el ácido?", campaignId, limit: 8 });
    expect(results.map((r) => r.documentTitle)).toContain("kw-acid");
  });

  it("does not let many chunks with a generic term crowd out the best match", async () => {
    const noise = await prisma.document.create({
      data: {
        campaignId,
        title: "kw-noise",
        path: "test/kw-noise.md",
        contentType: "markdown",
        sourceType: "campaign",
        authorityLevel: "medium",
      },
    });
    docIds.push(noise.id);
    await prisma.documentChunk.createMany({
      data: Array.from({ length: 250 }, (_, i) => ({
        documentId: noise.id,
        campaignId,
        content: `Ataque genérico número ${i}.`,
        chunkIndex: i,
        sourceType: "campaign",
        authorityLevel: "medium",
      })),
    });
    // Inserted last, so a capped scan in insertion order would never reach it
    await addChunk(campaignId, "kw-opportunity", "Ataque de oportunidad: reacción cuando un enemigo sale de tu alcance.");

    const results = await keywordSearch({ query: "¿Cómo funciona un ataque de oportunidad?", campaignId, limit: 5 });
    expect(results[0]?.documentTitle).toBe("kw-opportunity");
  });

  it("backs GET /api/documents/search in keyword mode", async () => {
    const app = await buildTestApp();
    try {
      const res = await supertest(app.server)
        .get("/api/documents/search")
        .query({ query: "bola de fuego", campaignId, mode: "keyword" });
      expect(res.status).toBe(200);
      expect(res.body.meta.method).toBe("keyword");
      const titles = res.body.data.map((r: { documentTitle: string }) => r.documentTitle);
      expect(titles).toContain("kw-fireball");
      expect(titles).not.toContain("kw-other");
    } finally {
      await app.close();
    }
  });

  it("feeds the chat context when no embeddings are available", async () => {
    const context = await chatService.retrieveContext(campaignId, "¿Cómo funciona la bola de fuego?", 8);
    const titles = context.map((c) => c.documentTitle);

    expect(titles).toContain("kw-fireball");
    expect(titles).not.toContain("kw-other");
  });
});
