/**
 * Database setup script.
 * Run after `prisma db push` to seed required reference data and import the SRD.
 *
 * Usage: npx tsx src/db/setup.ts
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";
import { importSrd } from "./srd-import.js";

const prisma = new PrismaClient();

const DATA_DIR = path.resolve(process.env["DATA_DIR"] ?? "../../../data");

const DIRS = [
  path.join(DATA_DIR, "campaigns"),
  path.join(DATA_DIR, "documents", "global"),
  path.join(DATA_DIR, "embeddings"),
  path.join(DATA_DIR, "logs"),
];

async function ensureDirectories() {
  for (const dir of DIRS) {
    await fs.mkdir(dir, { recursive: true });
    console.log(`  ✓ ${dir}`);
  }
}

async function seedRuleSources() {
  const sources = [
    {
      name: "D&D 2024 Player's Handbook",
      sourceType: "official",
      authorityLevel: "high",
      version: "2024",
      description: "Core rules for D&D 2024 (One D&D)",
    },
    {
      name: "D&D 2024 Dungeon Master's Guide",
      sourceType: "official",
      authorityLevel: "high",
      version: "2024",
      description: "DM rules and world-building guidance",
    },
    {
      name: "D&D SRD 5.2.1",
      sourceType: "srd",
      authorityLevel: "high",
      version: "5.2.1",
      description:
        "System Reference Document 5.2.1 — CC-BY-4.0. Includes D&D 2024 core rules. " +
        "Source: https://www.dndbeyond.com/srd",
    },
  ];

  for (const source of sources) {
    const existing = await prisma.ruleSource.findFirst({
      where: { name: source.name },
    });
    if (!existing) {
      await prisma.ruleSource.create({ data: source });
    }
    console.log(`  ✓ Rule source: ${source.name}`);
  }
}

async function seedDefaultUser() {
  const existing = await prisma.user.findFirst({ where: { id: "default-user" } });
  if (!existing) {
    await prisma.user.create({
      data: { id: "default-user", name: "DM", email: null },
    });
    console.log("  ✓ Default user created");
  } else {
    console.log("  ✓ Default user already exists");
  }
}

async function main() {
  console.log("\n🏰 D&D Campaign Assistant — Database Setup\n");

  console.log("Creating data directories...");
  await ensureDirectories();

  console.log("\nSeeding rule sources...");
  await seedRuleSources();

  console.log("\nCreating default user...");
  await seedDefaultUser();

  console.log("\nImporting SRD 5.2.1 (CC-BY-4.0)...");
  console.log("  Attribution: SRD 5.2.1 by Wizards of the Coast LLC — https://www.dndbeyond.com/srd");
  const srdResult = await importSrd(prisma, DATA_DIR, { skipIfExists: true, verbose: true });

  if (srdResult.errors.length > 0) {
    console.log("\n  ⚠ SRD import warnings:");
    srdResult.errors.forEach((e) => console.log(`    - ${e}`));
  }

  console.log(
    `\n  SRD result: ${srdResult.imported} imported, ${srdResult.skipped} skipped`
  );

  console.log("\n✅ Setup complete\n");
console.log("\nImporting core DM rules...");
const coreRulesDir = path.join(DATA_DIR, "core-rules");
try {
  const files = await fs.readdir(coreRulesDir);
  for (const file of files) {
    const existing = await prisma.document.findFirst({
      where: { title: file, sourceType: "homebrew_external" },
    });
    if (existing) {
      console.log(`  ↷ Skipping (already imported): ${file}`);
      continue;
    }
    const content = await fs.readFile(path.join(coreRulesDir, file), "utf-8");
    const docId = crypto.randomUUID();
    const relativePath = path.join("global", `core_${docId}.md`);
    const absolutePath = path.join(DATA_DIR, "documents", relativePath);
    await fs.writeFile(absolutePath, content, "utf-8");
    await prisma.document.create({
      data: {
        id: docId,
        title: file.replace(/\.[^.]+$/, "").replace(/_/g, " "),
        path: relativePath,
        contentType: "markdown",
        sourceType: "homebrew_external",
        authorityLevel: "medium",
        version: "1.0",
        campaignId: null,
        isIndexed: false,
        chunkCount: 0,
      },
    });
    console.log(`  ✓ Imported: ${file}`);
  }
} catch {
  console.log("  ↷ No core-rules directory found, skipping");
}
  console.log("Next steps:");
  console.log("  1. Run: pnpm dev:backend");
  console.log("  2. Run: pnpm dev:frontend");
  console.log("  3. Go to Settings → configure your AI provider");
  console.log("  4. Go to Settings → Semantic Search → embed all chunks\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
