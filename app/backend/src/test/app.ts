import Fastify from "fastify";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import { errorHandler } from "../middleware/errorHandler.js";
import { makeHostGuard } from "../middleware/hostGuard.js";
import { campaignRoutes } from "../routes/campaigns.js";
import { npcRoutes } from "../routes/npcs.js";
import { changeLogRoutes } from "../routes/changeLog.js";
import { sessionRoutes } from "../routes/sessions.js";
import { locationRoutes } from "../routes/locations.js";
import { factionRoutes } from "../routes/factions.js";
import { pdfRoutes } from "../routes/pdf.js";
import { documentRoutes } from "../routes/documents.js";

/**
 * Construye una instancia de Fastify para tests de integración.
 * No llama a listen() — supertest abre el socket por su cuenta.
 */
export async function buildTestApp() {
  const app = Fastify({ logger: false });

  // Mirror production: supertest connects over 127.0.0.1, so loopback Hosts pass.
  app.addHook("onRequest", makeHostGuard(["127.0.0.1", "localhost", "::1"]));

  await app.register(sensible);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  app.setErrorHandler(errorHandler);

  await app.register(campaignRoutes, { prefix: "/api/campaigns" });
  await app.register(npcRoutes, { prefix: "/api/npcs" });
  await app.register(changeLogRoutes, { prefix: "/api/changelog" });
  await app.register(sessionRoutes, { prefix: "/api/sessions" });
  await app.register(locationRoutes, { prefix: "/api/locations" });
  await app.register(factionRoutes, { prefix: "/api/factions" });
  await app.register(pdfRoutes, { prefix: "/api/pdf" });
  await app.register(documentRoutes, { prefix: "/api/documents" });

  await app.ready();
  return app;
}
