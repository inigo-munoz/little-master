import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { rulesEngine } from "../services/rulesEngine.service.js";
import { prisma } from "../db/prisma.js";

const MonsterSchema = z.object({
  name: z.string().min(1),
  cr: z.number().min(0),
  count: z.number().int().positive().default(1),
});

const PartySchema = z.object({
  size: z.number().int().min(1).max(20),
  averageLevel: z.number().int().min(1).max(20),
  levels: z.array(z.number().int().min(1).max(20)).optional(),
});

export const rulesRoutes: FastifyPluginAsync = async (server) => {
  // ── Validate encounter balance ───────────────────────────────────────────
  server.post<{ Body: unknown }>("/validate-encounter", async (request) => {
    const schema = z.object({
      campaignId: z.string().optional(),
      party: PartySchema,
      monsters: z.array(MonsterSchema).min(1),
    });

    const { party, monsters } = schema.parse(request.body);
    const result = rulesEngine.validateEncounter(party, monsters);

    return { success: true, data: result };
  });

  // ── Detect rule conflicts ────────────────────────────────────────────────
  server.post<{ Body: unknown }>("/audit-rules", async (request) => {
    const { campaignId } = z
      .object({ campaignId: z.string() })
      .parse(request.body);

    const result = await rulesEngine.auditRules(campaignId);
    return { success: true, data: result };
  });

  // ── Detect broken entity relations ──────────────────────────────────────
  server.post<{ Body: unknown }>("/audit-integrity", async (request) => {
    const { campaignId } = z
      .object({ campaignId: z.string() })
      .parse(request.body);

    const result = await rulesEngine.auditDataIntegrity(campaignId);
    return { success: true, data: result };
  });

  // ── Get active rules for campaign (sorted by authority) ──────────────────
  server.get<{ Querystring: { campaignId: string } }>("/active", async (request) => {
    const { campaignId } = z
      .object({ campaignId: z.string() })
      .parse(request.query);

    const rules = await prisma.campaignRule.findMany({
      where: { campaignId, active: true },
      include: { ruleSource: { select: { name: true } } },
      orderBy: { authorityLevel: "asc" },
    });

    return { success: true, data: rules };
  });
};
