-- SQLite requires recreating the table to change FK behaviour.
-- Add ON DELETE SET NULL to Location.parentLocationId so deleting a parent
-- location nulls out children instead of causing a FK violation.

PRAGMA foreign_keys=OFF;

CREATE TABLE "Location_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentLocationId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'campaign',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Location_parentLocationId_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "Location_new" SELECT * FROM "Location";

DROP TABLE "Location";

ALTER TABLE "Location_new" RENAME TO "Location";

PRAGMA foreign_keys=ON;
