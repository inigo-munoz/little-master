import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";
import type { IssueType, IssueSeverity, EntityType } from "@dnd/shared";

interface CreateIssueInput {
  campaignId?: string;
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  relatedEntityType?: EntityType;
  relatedEntityId?: string;
}

export const issueService = {
  async create(input: CreateIssueInput) {
    return prisma.issue.create({
      data: {
        campaignId: input.campaignId ?? null,
        type: input.type,
        severity: input.severity,
        status: "open",
        description: input.description,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      },
    });
  },

  async listByCampaign(campaignId: string, status?: string) {
    return prisma.issue.findMany({
      where: {
        campaignId,
        ...(status && { status }),
      },
      orderBy: [
        { severity: "asc" }, // critical first (alphabetically happens to work)
        { createdAt: "desc" },
      ],
    });
  },

  async resolve(id: string, resolution: string) {
    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) throw AppError.notFound(ErrorCode.NOT_FOUND, `Issue ${id} not found`);

    return prisma.issue.update({
      where: { id },
      data: {
        status: "resolved",
        resolution,
        resolvedAt: new Date(),
      },
    });
  },

  async dismiss(id: string) {
    return prisma.issue.update({
      where: { id },
      data: { status: "dismissed" },
    });
  },
};
