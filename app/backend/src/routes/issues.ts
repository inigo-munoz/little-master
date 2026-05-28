import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { EntityTypeSchema } from "@dnd/shared";
import { issueService } from "../services/issue.service.js";

export const issueRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { campaignId: string; status?: string } }>("/", async (request) => {
    const { campaignId, status } = z
      .object({
        campaignId: z.string(),
        status: z.enum(["open", "in_progress", "resolved", "dismissed"]).optional(),
      })
      .parse(request.query);

    const issues = await issueService.listByCampaign(campaignId, status);
    return { success: true, data: issues };
  });

  server.post<{ Body: unknown }>("/", async (request, reply) => {
    const schema = z.object({
      campaignId: z.string().optional(),
      type: z.enum([
        "rules_conflict",
        "narrative_inconsistency",
        "duplicate_entity",
        "unbalanced_encounter",
        "broken_reference",
        "data_inconsistency",
      ]),
      severity: z.enum(["critical", "major", "minor", "info"]),
      description: z.string().min(1).max(5000),
      relatedEntityType: EntityTypeSchema.optional(),
      relatedEntityId: z.string().optional(),
    });

    const data = schema.parse(request.body);
    const issue = await issueService.create(data);
    return reply.status(201).send({ success: true, data: issue });
  });

  server.post<{ Params: { id: string }; Body: unknown }>("/:id/resolve", async (request) => {
    const { resolution } = z
      .object({ resolution: z.string().min(1).max(2000) })
      .parse(request.body);

    const issue = await issueService.resolve(request.params.id, resolution);
    return { success: true, data: issue };
  });

  server.post<{ Params: { id: string } }>("/:id/dismiss", async (request) => {
    const issue = await issueService.dismiss(request.params.id);
    return { success: true, data: issue };
  });
};
