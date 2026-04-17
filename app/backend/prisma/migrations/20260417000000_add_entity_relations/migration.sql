-- CreateTable
CREATE TABLE "EntityRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntityRelation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EntityRelation_campaignId_idx" ON "EntityRelation"("campaignId");

-- CreateIndex
CREATE INDEX "EntityRelation_fromType_fromId_idx" ON "EntityRelation"("fromType", "fromId");

-- CreateIndex
CREATE INDEX "EntityRelation_toType_toId_idx" ON "EntityRelation"("toType", "toId");
