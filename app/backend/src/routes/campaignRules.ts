import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { changeLogService } from "../services/changeLog.service.js";
import { AppError, ErrorCode } from "@dnd/shared";

export const campaignRuleRoutes: FastifyPluginAsync = async (server) => {
  // List rules for a campaign
  server.get<{ Querystring: { campaignId: string; active?: string } }>(
    "/",
    async (request) => {
      const { campaignId, active } = z
        .object({
          campaignId: z.string(),
          active: z.coerce.boolean().optional(),
        })
        .parse(request.query);

      const rules = await prisma.campaignRule.findMany({
        where: {
          campaignId,
          ...(active !== undefined && { active }),
        },
        include: { ruleSource: true },
        orderBy: [{ authorityLevel: "asc" }, { title: "asc" }],
      });

      return { success: true, data: rules };
    }
  );

  // Search rules by keyword + source type
  server.get<{
    Querystring: { campaignId: string; query: string; sourceTypes?: string };
  }>("/search", async (request) => {
    const { campaignId, query, sourceTypes } = z
      .object({
        campaignId: z.string(),
        query: z.string().min(1).max(500),
        sourceTypes: z.string().optional(),
      })
      .parse(request.query);

    const allowedSources = sourceTypes?.split(",").filter(Boolean);
    const primaryToken = query.toLowerCase().split(/\s+/)[0] ?? "";

    const rules = await prisma.campaignRule.findMany({
      where: {
        campaignId,
        active: true,
        content: { contains: primaryToken },
        ...(allowedSources?.length ? { sourceType: { in: allowedSources } } : {}),
      },
      include: { ruleSource: { select: { name: true } } },
      orderBy: { authorityLevel: "asc" },
      take: 10,
    });

    // Sort: official > srd > campaign > homebrew_external > homebrew_user
    const authorityOrder: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    const sorted = rules.sort((a: any, b: any) =>
        (authorityOrder[a.authorityLevel] ?? 2) -
        (authorityOrder[b.authorityLevel] ?? 2)
    );

    return { success: true, data: sorted };
  });

  // Create a rule
  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string(),
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(20000),
      sourceId: z.string().optional(),
      sourceType: z.enum([
        "official", "srd", "campaign", "homebrew_external", "homebrew_user", "ai_inferred",
      ]),
      authorityLevel: z.enum(["high", "medium", "low"]),
      version: z.string().default("1.0"),
    });

    const data = schema.parse(request.body);
    const rule = await prisma.campaignRule.create({ data: { ...data, active: true } });

    await changeLogService.log({
      campaignId: data.campaignId,
      entityType: "campaign_rule",
      entityId: rule.id,
      beforeJson: null,
      afterJson: JSON.stringify(rule),
      reason: "Rule created",
      source: "user",
      authorType: "user",
    });

    return reply.status(201).send({ success: true, data: rule });
  });

  // Toggle active state
  server.patch<{ Params: { id: string }; Body: unknown }>(
    "/:id/toggle",
    async (request) => {
      const rule = await prisma.campaignRule.findUnique({
        where: { id: request.params.id },
      });
      if (!rule) {
        throw AppError.notFound(ErrorCode.NOT_FOUND, "Rule not found");
      }

      const updated = await prisma.campaignRule.update({
        where: { id: request.params.id },
        data: { active: !rule.active },
      });

      await changeLogService.log({
        campaignId: rule.campaignId,
        entityType: "campaign_rule",
        entityId: rule.id,
        beforeJson: JSON.stringify({ active: rule.active }),
        afterJson: JSON.stringify({ active: updated.active }),
        reason: `Rule ${updated.active ? "activated" : "deactivated"}`,
        source: "user",
        authorType: "user",
      });

      return { success: true, data: updated };
    }
  );
};
