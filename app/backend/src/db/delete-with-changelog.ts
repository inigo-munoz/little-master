/**
 * Shared "delete + ChangeLog" transaction helper.
 *
 * Several routes (locations, factions, players, sessions, encounters) all
 * follow the same shape for DELETE handlers: log the pre-delete state to
 * ChangeLog, optionally clean up EntityRelation rows pointing at the entity,
 * then delete the row — all inside one transaction. The caller still does
 * its own `findUnique` + not-found check (each model's delegate has a
 * distinct Prisma type, so that part isn't worth abstracting), and passes a
 * small callback for the actual `tx.<model>.delete(...)` call, which keeps
 * this helper free of `any`/type assertions despite Prisma's per-model typing.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import type { EntityType, AuthorType } from "@dnd/shared";
import { changeLogService } from "../services/changeLog.service.js";

export interface DeleteWithChangeLogOptions<T extends { id: string }> {
  prisma: PrismaClient;
  existing: T;
  campaignId: string | null;
  entityType: EntityType;
  reason: string;
  /** Author type recorded in the ChangeLog entry. Defaults to "user". */
  authorType?: AuthorType;
  /** Source recorded in the ChangeLog entry. Defaults to "user". */
  source?: string;
  /** Set true when the entity participates in EntityRelation (npc/faction/location). */
  cleanupEntityRelations?: boolean;
  /** Performs the actual `tx.<model>.delete(...)` call for the concrete model. */
  deleteEntity: (tx: Prisma.TransactionClient) => Promise<unknown>;
}

export async function deleteWithChangeLog<T extends { id: string }>(
  options: DeleteWithChangeLogOptions<T>
): Promise<void> {
  const {
    prisma,
    existing,
    campaignId,
    entityType,
    reason,
    authorType = "user",
    source = "user",
    cleanupEntityRelations = false,
    deleteEntity,
  } = options;

  await prisma.$transaction(async (tx) => {
    await changeLogService.log(
      {
        campaignId,
        entityType,
        entityId: existing.id,
        beforeJson: JSON.stringify(existing),
        afterJson: null,
        reason,
        source,
        authorType,
      },
      tx
    );

    if (cleanupEntityRelations) {
      await tx.entityRelation.deleteMany({
        where: { OR: [{ fromId: existing.id }, { toId: existing.id }] },
      });
    }

    await deleteEntity(tx);
  });
}
