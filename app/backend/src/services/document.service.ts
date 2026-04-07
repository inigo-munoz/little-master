import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { AppError, ErrorCode } from "@dnd/shared";
import { changeLogService } from "./changeLog.service.js";
import type { SourceType, AuthorityLevel } from "@dnd/shared";

const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024; // 5 MB
const CHUNK_SIZE = 1500;        // chars per chunk
const CHUNK_OVERLAP = 200;      // overlap between chunks

export const documentService = {
  async list(campaignId?: string) {
    return prisma.document.findMany({
      where: campaignId
        ? { OR: [{ campaignId }, { campaignId: null }] }
        : { campaignId: null },
      orderBy: { updatedAt: "desc" },
    });
  },

  async getById(id: string) {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw AppError.notFound(ErrorCode.DOCUMENT_NOT_FOUND, `Document ${id} not found`);
    return doc;
  },

  async readContent(id: string): Promise<string> {
    const doc = await this.getById(id);
    const fullPath = path.join(env.DOCUMENTS_DIR, doc.path);
    return fs.readFile(fullPath, "utf-8");
  },

  async create(input: {
    title: string;
    content: string;
    contentType: "markdown" | "plaintext";
    sourceType: SourceType;
    authorityLevel: AuthorityLevel;
    campaignId?: string;
    version?: string;
  }) {
    // Validate size
    const byteSize = Buffer.byteLength(input.content, "utf-8");
    if (byteSize > MAX_DOCUMENT_SIZE) {
      throw new AppError(
        ErrorCode.DOCUMENT_TOO_LARGE,
        `Document exceeds 5 MB limit (${Math.round(byteSize / 1024)} KB)`,
        400
      );
    }

    // Determine storage path: /data/documents/<campaignId|global>/<id>.md
    const scope = input.campaignId ?? "global";
    const docId = crypto.randomUUID();
    const ext = input.contentType === "markdown" ? "md" : "txt";
    const relativePath = path.join(scope, `${docId}.${ext}`);
    const absolutePath = path.join(env.DOCUMENTS_DIR, relativePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.content, "utf-8");

    // Save metadata to DB
    const doc = await prisma.document.create({
      data: {
        id: docId,
        title: input.title,
        path: relativePath,
        contentType: input.contentType,
        sourceType: input.sourceType,
        authorityLevel: input.authorityLevel,
        version: input.version ?? "1.0",
        campaignId: input.campaignId ?? null,
        isIndexed: false,
        chunkCount: 0,
      },
    });

    // Index then embed — async, do not block the response
    void this.indexAndEmbed(doc.id, input.content);

    await changeLogService.log({
      campaignId: input.campaignId ?? null,
      entityType: "document",
      entityId: doc.id,
      beforeJson: null,
      afterJson: JSON.stringify({ id: doc.id, title: doc.title, sourceType: doc.sourceType }),
      reason: "Document created",
      source: "user",
      authorType: "user",
    });

    return doc;
  },

  async delete(id: string) {
    const doc = await this.getById(id);
    const fullPath = path.join(env.DOCUMENTS_DIR, doc.path);

    // Delete chunks first
    await prisma.documentChunk.deleteMany({ where: { documentId: id } });
    await prisma.document.delete({ where: { id } });

    // Delete file (best-effort)
    await fs.unlink(fullPath).catch(() => {});
  },

  async indexAndEmbed(documentId: string, content: string) {
    try {
      const chunkCount = await this.indexDocument(documentId, content);
      if (chunkCount > 0) {
        const { embeddingService } = await import('./embedding.service.js');
        const result = await embeddingService.embedDocument(documentId);
        console.log(`[embed] doc=${documentId} embedded=${result.embedded} failed=${result.failed}`);
      }
    } catch (err) {
      console.error('[embed] Failed for doc=' + documentId + ':', err);
    }
  },

  async indexDocument(documentId: string, content: string) {
    const doc = await this.getById(documentId);

    // Delete existing chunks if re-indexing
    await prisma.documentChunk.deleteMany({ where: { documentId } });

    // Split into overlapping chunks
    const chunks = this.chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);

    // Batch insert chunks
    await prisma.documentChunk.createMany({
      data: chunks.map((content, i) => ({
        documentId,
        campaignId: doc.campaignId ?? null,
        content,
        chunkIndex: i,
        sourceType: doc.sourceType,
        authorityLevel: doc.authorityLevel,
        embeddingJson: null, // Sprint 2: generate and store embedding
      })),
    });

    // Mark document as indexed
    await prisma.document.update({
      where: { id: documentId },
      data: { isIndexed: true, chunkCount: chunks.length },
    });

    return chunks.length;
  },

  chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    // Split on paragraph boundaries where possible
    const paragraphs = text.split(/\n\n+/);
    let current = "";

    for (const para of paragraphs) {
      if ((current + para).length > chunkSize && current.length > 0) {
        chunks.push(current.trim());
        // Start next chunk with overlap from end of current
        const words = current.split(" ");
        const overlapWords = words.slice(-Math.ceil(overlap / 6)); // rough word count
        current = overlapWords.join(" ") + " " + para;
      } else {
        current = current ? current + "\n\n" + para : para;
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks.filter((c) => c.length > 0);
  },
};
