-- Add explicit ON DELETE behaviour to three relations that previously relied on
-- the Prisma implicit default:
--   Campaign.user            -> ON DELETE CASCADE   (deleting a user removes their campaigns)
--   CampaignRule.ruleSource  -> ON DELETE SET NULL  (explicit; already the implicit default for an optional FK)
--   AssistantRun.llmConfig   -> ON DELETE SET NULL  (explicit; already the implicit default for an optional FK)
--
-- Only Campaign.user changes actual DB behaviour: a required FK's implicit default
-- is restrict/no-action, now cascade. The two optional FKs already behaved as
-- SET NULL, so making them explicit produces no schema change here — hence only
-- Campaign is recreated below.
--
-- SQLite requires recreating the table to change FK behaviour.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "system" TEXT NOT NULL DEFAULT 'D&D 2024',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("createdAt", "description", "id", "status", "system", "title", "updatedAt", "userId") SELECT "createdAt", "description", "id", "status", "system", "title", "updatedAt", "userId" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
