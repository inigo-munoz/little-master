/**
 * SRD Seed — Seeds the database with SRD content on first run.
 *
 * Called during bootstrap when --seed-dir is provided (Tauri desktop app).
 * Copies SRD files from the bundle's read-only resource directory into the
 * user's data directory, then imports them via the existing importSrd pipeline.
 *
 * Idempotent: uses AppSetting "srd_seed_version" to skip if already seeded.
 */

import { copyFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "./prisma.js";
import { importSrd } from "./srd-import.js";

const CURRENT_SRD_VERSION = "5.2.1";

export async function seedSrdIfNeeded(
  dataDir: string,
  seedDir: string | undefined
): Promise<void> {
  if (!seedDir) return;

  const seedSrdDir = join(seedDir, "srd", "en");
  if (!existsSync(seedSrdDir)) {
    console.warn(`[seed] SRD seed directory not found: ${seedSrdDir}`);
    return;
  }

  const existing = await prisma.appSetting.findUnique({
    where: { key: "srd_seed_version" },
  });

  if (existing?.value === CURRENT_SRD_VERSION) {
    console.log(`[seed] SRD already seeded (v${CURRENT_SRD_VERSION}), skipping`);
    return;
  }

  console.log(`[seed] Seeding SRD v${CURRENT_SRD_VERSION}...`);

  const targetSrdDir = join(dataDir, "srd", "en");
  await mkdir(targetSrdDir, { recursive: true });

  const files = await readdir(seedSrdDir);
  let copied = 0;
  for (const file of files) {
    const src = join(seedSrdDir, file);
    const dest = join(targetSrdDir, file);
    if (!existsSync(dest)) {
      await copyFile(src, dest);
      copied++;
    }
  }
  if (copied > 0) {
    console.log(`[seed] Copied ${copied} SRD files to ${targetSrdDir}`);
  }

  const result = await importSrd(prisma, dataDir, {
    skipIfExists: true,
    verbose: true,
  });

  console.log(
    `[seed] SRD import complete: ${result.imported} imported, ${result.skipped} skipped`
  );

  if (result.errors.length > 0) {
    console.error(`[seed] SRD import errors:`, result.errors);
  }

  await prisma.appSetting.upsert({
    where: { key: "srd_seed_version" },
    update: { value: CURRENT_SRD_VERSION },
    create: { key: "srd_seed_version", value: CURRENT_SRD_VERSION },
  });

  console.log(`[seed] SRD v${CURRENT_SRD_VERSION} seeded successfully`);
}
