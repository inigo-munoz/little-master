import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "../db/prisma.js";
import { importFromVault } from "./obsidian.service.js";

let campaignId: string;
let vaultPath: string;

const PLAYER_NOTE = "---\nNoteIcon: player\nClass: Wizard\nlevel: 3\n---\nA brave wizard.\n";

beforeAll(async () => {
  const user = await prisma.user.create({ data: { name: "Obsidian Test User" } });
  const campaign = await prisma.campaign.create({
    data: { title: "Obsidian Test Campaign", userId: user.id },
  });
  campaignId = campaign.id;
});

beforeEach(async () => {
  vaultPath = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-vault-"));
  await fs.writeFile(path.join(vaultPath, "Gandalf.md"), PLAYER_NOTE);
});

afterEach(async () => {
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.entityRelation.deleteMany({ where: { campaignId } });
  await prisma.player.deleteMany({ where: { campaignId } });
  await prisma.npc.deleteMany({ where: { campaignId } });
  await fs.rm(vaultPath, { recursive: true, force: true });
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { name: "Obsidian Test User" } });
  await prisma.$disconnect();
});

describe("importFromVault — player notes", () => {
  it("importing the same player twice keeps the player and skips the second time", async () => {
    const first = await importFromVault(vaultPath, campaignId);
    const second = await importFromVault(vaultPath, campaignId);

    expect(first.players.imported).toBe(1);
    expect(second.players.imported).toBe(0);
    expect(second.players.skipped).toBe(1);
    expect(second.players.errors).toEqual([]);
    expect(await prisma.player.count({ where: { campaignId, name: "Gandalf" } })).toBe(1);
  });

  it("migrates a previously imported NPC to a player and removes its relations", async () => {
    const npc = await prisma.npc.create({ data: { campaignId, name: "Gandalf" } });
    const other = await prisma.npc.create({ data: { campaignId, name: "Frodo" } });
    await prisma.entityRelation.createMany({
      data: [
        { campaignId, fromType: "npc", fromId: npc.id, toType: "npc", toId: other.id, relationType: "ally" },
        { campaignId, fromType: "npc", fromId: other.id, toType: "npc", toId: npc.id, relationType: "friend" },
      ],
    });

    const result = await importFromVault(vaultPath, campaignId);

    expect(result.players.imported).toBe(1);
    expect(result.players.errors).toEqual([]);
    expect(await prisma.player.count({ where: { campaignId, name: "Gandalf" } })).toBe(1);
    expect(await prisma.npc.findUnique({ where: { id: npc.id } })).toBeNull();
    expect(await prisma.npc.findUnique({ where: { id: other.id } })).not.toBeNull();
    expect(
      await prisma.entityRelation.count({
        where: { OR: [{ fromId: npc.id }, { toId: npc.id }] },
      })
    ).toBe(0);

    const log = await prisma.changeLog.findFirst({
      where: { entityId: npc.id, entityType: "npc" },
    });
    expect(log).not.toBeNull();
    expect(log?.afterJson).toBeNull();
    expect(log?.beforeJson).toContain("Gandalf");
  });

  it("does not delete the NPC (nor its relations) when the player import is skipped", async () => {
    await prisma.player.create({ data: { campaignId, name: "Gandalf" } });
    const npc = await prisma.npc.create({ data: { campaignId, name: "Gandalf" } });
    const other = await prisma.npc.create({ data: { campaignId, name: "Frodo" } });
    await prisma.entityRelation.create({
      data: { campaignId, fromType: "npc", fromId: npc.id, toType: "npc", toId: other.id, relationType: "ally" },
    });

    const result = await importFromVault(vaultPath, campaignId);

    expect(result.players.skipped).toBe(1);
    expect(result.players.imported).toBe(0);
    expect(await prisma.npc.findUnique({ where: { id: npc.id } })).not.toBeNull();
    expect(await prisma.entityRelation.count({ where: { fromId: npc.id } })).toBe(1);
    expect(await prisma.changeLog.count({ where: { entityId: npc.id } })).toBe(0);
  });
});
