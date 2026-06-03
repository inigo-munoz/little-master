import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
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
import { seedSrdIfNeeded } from "./db/seed-srd.js";

const server = Fastify({
  logger: {
    level: env.NODE_ENV === "development" ? "debug" : "info",
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

function initDatabase() {
  // import.meta is empty in esbuild CJS bundles — __dirname is the CJS equivalent
  const dir: string = import.meta.dirname ?? __dirname;
  const schemaCandidates = [
    join(dir, "schema.prisma"),
    join(dir, "..", "prisma", "schema.prisma"),
  ];
  const schema = schemaCandidates.find(existsSync);
  if (!schema) {
    console.error("initDatabase: no schema.prisma found in", schemaCandidates);
    return;
  }

  const prismaCli = join(dir, "node_modules", "prisma", "build", "index.js");
  if (!existsSync(prismaCli)) {
    console.error("initDatabase: prisma CLI not found at", prismaCli);
    return;
  }

  // Always sync schema on every launch — safe on upgrades, fast when up to date.
  // db push --accept-data-loss is safe here: it only adds columns, never drops.
  try {
    console.log("initDatabase: pushing schema from", schema);
    execSync(`"${process.execPath}" "${prismaCli}" db push --schema="${schema}" --skip-generate --accept-data-loss`, {
      env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
      cwd: dir,
      stdio: "pipe",
      timeout: 30000,
    });
    console.log("Database schema up to date");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to sync database schema:", msg);
    if (err && typeof err === "object" && "stderr" in err) {
      console.error("stderr:", String((err as { stderr: Buffer }).stderr));
    }
  }

  // Seed default user once — marker guards this block only.
  const marker = join(env.DATA_DIR, ".db-initialized");
  if (!existsSync(marker)) {
    prisma.user.upsert({
      where: { id: "default-user" },
      update: {},
      create: { id: "default-user", name: "DM" },
    }).then(() => console.log("Default user seeded"))
      .catch((e: unknown) => console.error("Seed user failed:", e));
    writeFileSync(marker, new Date().toISOString());
  }
}

async function bootstrap() {
  // ── Ensure data directories exist ───────────────────────────────────────
  mkdirSync(env.DATA_DIR, { recursive: true });
  mkdirSync(env.DOCUMENTS_DIR, { recursive: true });
  mkdirSync(env.LOGS_DIR, { recursive: true });
  mkdirSync(join(env.DATA_DIR, "backups"), { recursive: true });

  initDatabase();

  // ── Seed SRD content on first run (desktop app) ─────────────────────────
  await seedSrdIfNeeded(env.DATA_DIR, env.SEED_DIR);

  // ── Security plugins ─────────────────────────────────────────────────────
  await server.register(helmet, { contentSecurityPolicy: false });
  await server.register(cors, {
    origin: [
      env.CORS_ORIGIN,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:1420",
      "tauri://localhost",
      "https://tauri.localhost",
      "http://tauri.localhost",
    ],
    credentials: true,
  });
  await server.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
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

process.on("unhandledRejection", (reason) => {
  server.log.fatal({ err: reason }, "Unhandled rejection");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  server.log.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

bootstrap().catch((err: unknown) => {
  server.log.fatal({ err }, "Failed to start server");
  process.exit(1);
});
