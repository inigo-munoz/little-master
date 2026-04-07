import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import { promises as fs } from "node:fs";
import { buildTestApp } from "../test/app.js";
import { prisma } from "../db/prisma.js";

let request: ReturnType<typeof supertest>;
let app: Awaited<ReturnType<typeof buildTestApp>>;
let userId: string;
let campaignId: string;

beforeAll(async () => {
  // Asegurar que el directorio de documentos de test existe
  await fs.mkdir("/tmp/dnd-test-documents", { recursive: true });
  app = await buildTestApp();
  request = supertest(app.server);
});

beforeEach(async () => {
  const user = await prisma.user.create({ data: { name: "Test User Documents" } });
  const campaign = await prisma.campaign.create({
    data: { title: "Campaña Test Documents", userId: user.id },
  });
  userId = user.id;
  campaignId = campaign.id;
});

afterEach(async () => {
  await prisma.documentChunk.deleteMany({ where: { campaignId } });
  await prisma.document.deleteMany({ where: { campaignId } });
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
  // Limpiar documentos de test
  await fs.rm("/tmp/dnd-test-documents", { recursive: true, force: true });
});

// ─── POST /api/documents ──────────────────────────────────────────────────────

describe("POST /api/documents", () => {
  it("con contenido válido → 201 con documento creado e isIndexed false inicialmente", async () => {
    const res = await request.post("/api/documents").send({
      campaignId,
      title: "Reglas de la Mazmorra",
      content: "# Reglas\n\nEsta es una mazmorra peligrosa. Los aventureros deben tener cuidado.",
      contentType: "markdown",
      sourceType: "campaign",
      authorityLevel: "medium",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Reglas de la Mazmorra");
    expect(res.body.data.contentType).toBe("markdown");
    // El documento se crea con isIndexed false; la indexación es asíncrona
    expect(res.body.data.isIndexed).toBe(false);
    expect(res.body.data.chunkCount).toBe(0);
  });

  it("sin título → 400", async () => {
    const res = await request.post("/api/documents").send({
      campaignId,
      content: "Contenido sin título",
      contentType: "plaintext",
      sourceType: "campaign",
      authorityLevel: "low",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("sin content → 400", async () => {
    const res = await request.post("/api/documents").send({
      campaignId,
      title: "Documento sin contenido",
      contentType: "plaintext",
      sourceType: "campaign",
      authorityLevel: "low",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("con campaignId opcional → 201 como documento global", async () => {
    const res = await request.post("/api/documents").send({
      title: "SRD Global",
      content: "Reglas del SRD que aplican globalmente.",
      contentType: "plaintext",
      sourceType: "srd",
      authorityLevel: "high",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.campaignId).toBeNull();

    // Limpieza del documento global
    await prisma.documentChunk.deleteMany({ where: { documentId: res.body.data.id } });
    await prisma.document.delete({ where: { id: res.body.data.id } });
  });
});

// ─── POST /api/documents/:id/reindex ─────────────────────────────────────────

describe("POST /api/documents/:id/reindex", () => {
  it("endpoint existe y responde 200 con chunkCount", async () => {
    // Primero crear un documento
    const createRes = await request.post("/api/documents").send({
      campaignId,
      title: "Doc para Reindexar",
      content: "Párrafo uno con información importante.\n\nPárrafo dos con más detalles sobre la aventura.",
      contentType: "markdown",
      sourceType: "campaign",
      authorityLevel: "medium",
    });
    expect(createRes.status).toBe(201);
    const docId = createRes.body.data.id;

    // Reindexar
    const reindexRes = await request.post(`/api/documents/${docId}/reindex`).send({});
    expect(reindexRes.status).toBe(200);
    expect(reindexRes.body.success).toBe(true);
    expect(typeof reindexRes.body.data.chunkCount).toBe("number");
    expect(reindexRes.body.data.chunkCount).toBeGreaterThan(0);
  });
});

// ─── POST /api/documents/upload ───────────────────────────────────────────────

describe("POST /api/documents/upload", () => {
  it("con archivo .md → 201 con documento creado", async () => {
    const mdContent = "# Reglas de Combate\n\nEl combate se desarrolla en rondas de 6 segundos.";

    const res = await request
      .post("/api/documents/upload")
      .field("title", "Reglas de Combate")
      .field("sourceType", "homebrew_user")
      .field("authorityLevel", "medium")
      .field("campaignId", campaignId)
      .attach("file", Buffer.from(mdContent), { filename: "combat.md", contentType: "text/markdown" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Reglas de Combate");
    expect(res.body.data.contentType).toBe("markdown");
    expect(res.body.data.isIndexed).toBe(false);
  });

  it("con archivo demasiado grande → 413", async () => {
    // Generar buffer mayor a 10 MB
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, "a");

    const res = await request
      .post("/api/documents/upload")
      .attach("file", bigBuffer, { filename: "huge.txt", contentType: "text/plain" });

    expect(res.status).toBe(413);
  });

  it("sin archivo → 400", async () => {
    const res = await request
      .post("/api/documents/upload")
      .field("title", "Sin archivo")
      .field("sourceType", "homebrew_user")
      .field("authorityLevel", "low");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("usa el nombre del archivo como título si no se especifica", async () => {
    const content = "Contenido de prueba para el archivo sin título explícito.";

    const res = await request
      .post("/api/documents/upload")
      .field("sourceType", "homebrew_user")
      .field("authorityLevel", "low")
      .attach("file", Buffer.from(content), { filename: "notas-sesion.txt", contentType: "text/plain" });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("notas-sesion");
  });
});
