import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { documentService } from "../services/document.service.js";
import { AppError, ErrorCode } from "@dnd/shared";
import type { SourceType, AuthorityLevel } from "@dnd/shared";

export const documentRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { campaignId?: string } }>("/", async (request) => {
    const { campaignId } = z.object({ campaignId: z.string().optional() }).parse(request.query);
    const docs = await documentService.list(campaignId);
    return { success: true, data: docs };
  });

  server.get<{ Params: { id: string } }>("/:id", async (request) => {
    const doc = await documentService.getById(request.params.id);
    return { success: true, data: doc };
  });

  server.get<{ Params: { id: string } }>("/:id/content", async (request) => {
    const content = await documentService.readContent(request.params.id);
    return { success: true, data: { content } };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      content: z.string().min(1),
      contentType: z.enum(["markdown", "plaintext"]),
      sourceType: z.enum(["official", "srd", "campaign", "homebrew_external", "homebrew_user", "ai_inferred"]),
      authorityLevel: z.enum(["high", "medium", "low"]),
      campaignId: z.string().optional(),
      version: z.string().optional(),
    });

    const data = schema.parse(request.body);
    const doc = await documentService.create(data);
    return reply.status(201).send({ success: true, data: doc });
  });

  // ── Subida de archivo (multipart/form-data) ────────────────────────────────
  server.post("/upload", async (request, reply) => {
    let fileBuffer: Buffer | null = null;
    let filename = "";
    let mimetype = "";
    const fields: Record<string, string> = {};

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === "file") {
        fileBuffer = await part.toBuffer();
        filename = part.filename ?? "upload";
        mimetype = part.mimetype ?? "";
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "No file provided", 400);
    }

    if (fileBuffer.length > 10 * 1024 * 1024) {
      return reply.status(413).send({
        success: false,
        error: { code: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" },
      });
    }

    let content = "";
    let contentType: "markdown" | "plaintext" = "plaintext";

    if (mimetype === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
      const pdfData = await parser.getText();
      await parser.destroy();
      content = pdfData.text;
      contentType = "plaintext";
    } else if (filename.endsWith(".md") || filename.endsWith(".markdown")) {
      content = fileBuffer.toString("utf-8");
      contentType = "markdown";
    } else {
      content = fileBuffer.toString("utf-8");
      contentType = "plaintext";
    }

    if (!content.trim()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "File is empty or could not be parsed", 400);
    }

    const title = fields.title?.trim() || filename.replace(/\.[^.]+$/, "");
    const description = fields.description?.trim() || undefined;
    const sourceType = (fields.sourceType as SourceType) ?? "homebrew_user";
    const authorityLevel = (fields.authorityLevel as AuthorityLevel) ?? "medium";
    const campaignId = fields.campaignId || undefined;
    const version = fields.version || "1.0";

    const doc = await documentService.create({
      title,
      description,
      content,
      contentType,
      sourceType,
      authorityLevel,
      campaignId,
      version,
    });

    return reply.status(201).send({ success: true, data: doc });
  });

  server.post<{ Params: { id: string } }>("/:id/reindex", async (request) => {
    const content = await documentService.readContent(request.params.id);
    const chunkCount = await documentService.indexDocument(request.params.id, content);
    return { success: true, data: { chunkCount } };
  });

  server.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await documentService.delete(request.params.id);
    return reply.status(204).send();
  });
};
