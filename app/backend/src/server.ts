import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRoutes } from "./routes/health.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { sessionRoutes } from "./routes/sessions.js";
import { npcRoutes } from "./routes/npcs.js";
import { documentRoutes } from "./routes/documents.js";
import { llmConfigRoutes } from "./routes/llmConfig.js";
import { changeLogRoutes } from "./routes/changeLog.js";
import { issueRoutes } from "./routes/issues.js";
import { chatRoutes } from "./routes/chat.js";
import { documentSearchRoutes } from "./routes/documentSearch.js";
import { campaignRuleRoutes } from "./routes/campaignRules.js";
import { embeddingRoutes } from "./routes/embeddings.js";
import { rulesRoutes } from "./routes/rules.js";
import { obsidianRoutes } from "./routes/obsidian.js";
import { playerRoutes } from "./routes/players.js";
import { locationRoutes } from "./routes/locations.js";
import { factionRoutes } from "./routes/factions.js";
import { pdfRoutes } from "./routes/pdf.js";
import { srdRoutes } from "./routes/srd.js";
import { encounterRoutes } from "./routes/encounters.js";
import { wikiRoutes } from "./routes/wiki.js";
import { relationRoutes } from "./routes/relations.js";
import { spellRoutes } from "./routes/spells.js";

const server = Fastify({
  logger: {
    level: env.NODE_ENV === "development" ? "debug" : "info",
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

async function bootstrap() {
  // ── Security plugins ─────────────────────────────────────────────────────
  await server.register(helmet, { contentSecurityPolicy: false });
  await server.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  await server.register(sensible);
  await server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

  // ── Global error handler ─────────────────────────────────────────────────
  server.setErrorHandler(errorHandler);

  // ── Routes ───────────────────────────────────────────────────────────────
  await server.register(healthRoutes, { prefix: "/health" });
  await server.register(campaignRoutes, { prefix: "/api/campaigns" });
  await server.register(sessionRoutes, { prefix: "/api/sessions" });
  await server.register(npcRoutes, { prefix: "/api/npcs" });
  await server.register(documentRoutes, { prefix: "/api/documents" });
  await server.register(llmConfigRoutes, { prefix: "/api/llm-config" });
  await server.register(changeLogRoutes, { prefix: "/api/changelog" });
  await server.register(issueRoutes, { prefix: "/api/issues" });
  await server.register(chatRoutes, { prefix: "/api/chat" });
  await server.register(documentSearchRoutes, { prefix: "/api/documents" });
  await server.register(campaignRuleRoutes, { prefix: "/api/campaign-rules" });
  await server.register(embeddingRoutes, { prefix: "/api/embeddings" });
  await server.register(rulesRoutes, { prefix: "/api/rules" });
  await server.register(obsidianRoutes, { prefix: "/api/obsidian" });
  await server.register(playerRoutes, { prefix: "/api/players" });
  await server.register(locationRoutes, { prefix: "/api/locations" });
  await server.register(factionRoutes, { prefix: "/api/factions" });
  await server.register(pdfRoutes, { prefix: "/api/pdf" });
  await server.register(srdRoutes, { prefix: "/api/srd" });
  await server.register(encounterRoutes, { prefix: "/api/encounters" });
  await server.register(wikiRoutes, { prefix: "/api/campaigns" });
  await server.register(relationRoutes, { prefix: "/api/relations" });
  await server.register(spellRoutes, { prefix: "/api/spells" });

  // ── Start ─────────────────────────────────────────────────────────────────
  await server.listen({ port: env.PORT, host: env.HOST });
  server.log.info(`Backend running at http://${env.HOST}:${env.PORT}`);
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown() {
  server.log.info("Shutting down...");
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
