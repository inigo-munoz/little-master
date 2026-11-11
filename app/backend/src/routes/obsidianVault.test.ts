import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildTestApp } from "../test/app.js";
import { prisma } from "../db/prisma.js";

const SETTING = "obsidian_vault_path";

let request: ReturnType<typeof supertest>;
let app: Awaited<ReturnType<typeof buildTestApp>>;
let userId: string;
let campaignId: string;
let scratch: string;
let vault: string;
let plainDir: string;
let previousSetting: string | null;

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { recursive: true });
  return entries.map(String);
}

beforeAll(async () => {
  app = await buildTestApp();
  request = supertest(app.server);
  userId = (await prisma.user.create({ data: { name: "Obsidian vault test" } })).id;
  campaignId = (await prisma.campaign.create({ data: { title: "Vault test", userId } })).id;
  await prisma.npc.create({ data: { campaignId, name: "Elminster", status: "alive" } });
  previousSetting = (await prisma.appSetting.findUnique({ where: { key: SETTING } }))?.value ?? null;
});

beforeEach(async () => {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-guard-"));
  vault = path.join(scratch, "vault");
  plainDir = path.join(scratch, "not-a-vault");
  await fs.mkdir(path.join(vault, ".obsidian"), { recursive: true });
  await fs.mkdir(plainDir);
  await fs.writeFile(path.join(plainDir, "notes.md"), "# Private notes\n");
});

afterEach(async () => {
  await fs.rm(scratch, { recursive: true, force: true });
  await prisma.appSetting.deleteMany({ where: { key: SETTING } });
});

afterAll(async () => {
  if (previousSetting !== null) {
    await prisma.appSetting.create({ data: { key: SETTING, value: previousSetting } });
  }
  await prisma.changeLog.deleteMany({ where: { campaignId } });
  await prisma.npc.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await app.close();
  await prisma.$disconnect();
});

describe("Obsidian vault validation", () => {
  it("verify reports a folder without .obsidian as not a vault", async () => {
    const plain = await request.post("/api/obsidian/verify").send({ vaultPath: plainDir });
    expect(plain.status).toBe(200);
    expect(plain.body.data.valid).toBe(false);

    const real = await request.post("/api/obsidian/verify").send({ vaultPath: vault });
    expect(real.body.data.valid).toBe(true);
  });

  it("refuses to save a folder that is not an Obsidian vault", async () => {
    const res = await request.post("/api/obsidian/config").send({ vaultPath: plainDir });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.appSetting.findUnique({ where: { key: SETTING } })).toBeNull();

    const ok = await request.post("/api/obsidian/config").send({ vaultPath: vault });
    expect(ok.status).toBe(200);
  });

  it("refuses to scan an arbitrary folder", async () => {
    const res = await request.post("/api/obsidian/scan").send({ vaultPath: plainDir });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses to export into a stored path that is not a vault, writing nothing", async () => {
    // A path stored before this check existed, or written straight to the database
    await prisma.appSetting.create({ data: { key: SETTING, value: plainDir } });

    const res = await request.post("/api/obsidian/export").send({ campaignId });

    expect(res.status).toBe(400);
    expect(await listFilesRecursive(plainDir)).toEqual(["notes.md"]);
  });

  it("still exports into a real vault", async () => {
    await prisma.appSetting.create({ data: { key: SETTING, value: vault } });

    const res = await request.post("/api/obsidian/export").send({ campaignId });

    expect(res.status).toBe(200);
    const written = await listFilesRecursive(vault);
    expect(written.some((f) => f.endsWith("Elminster.md"))).toBe(true);
  });
});
