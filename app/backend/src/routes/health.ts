import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";

export const healthRoutes: FastifyPluginAsync = async (server) => {
  server.get("/", { config: { rateLimit: false } }, async (_request, reply) => {
    // Check DB connectivity
    let dbStatus: "ok" | "error" = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "error";
    }

    const status = dbStatus === "ok" ? "ok" : "degraded";
    const code = status === "ok" ? 200 : 503;

    return reply.status(code).send({
      status,
      version: "0.1.0",
      env: env.NODE_ENV,
      services: {
        database: dbStatus,
      },
      timestamp: new Date().toISOString(),
    });
  });
};
