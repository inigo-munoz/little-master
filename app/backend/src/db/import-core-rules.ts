/**
 * Import DM core rule documents into the document system.
 *
 * These are user-owned homebrew_external documents with medium authority.
 * They complement (not override) the SRD 5.2.1.
 * Run once per installation: npx tsx src/db/import-core-rules.ts
 *
 * Idempotent: skips documents that already exist by title.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { config as loadDotenv } from "dotenv";

loadDotenv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { values: args } = parseArgs({
  options: {
    "data-dir": { type: "string" },
    force: { type: "boolean", default: false },
  },
  strict: false,
});

const dataDir = (typeof args["data-dir"] === "string" ? args["data-dir"] : undefined)
  ?? process.env["DATA_DIR"]
  ?? path.resolve(__dirname, "../../../../data");
const documentsDir = process.env["DOCUMENTS_DIR"] ?? path.join(dataDir, "documents");
const dbUrl = process.env["DATABASE_URL"] ?? `file:${path.join(dataDir, "dnd-assistant.db")}`;

process.env["DATA_DIR"] = dataDir;
process.env["DOCUMENTS_DIR"] = documentsDir;
process.env["DATABASE_URL"] = dbUrl.replaceAll("\\", "/");

if (!process.env["ENCRYPTION_KEY"]) {
  const keyFile = path.join(dataDir, ".encryption-key");
  try {
    process.env["ENCRYPTION_KEY"] = (await fs.readFile(keyFile, "utf-8")).trim();
  } catch {
    // If no key file, set a dummy value so Zod validation passes (not needed for this script)
    process.env["ENCRYPTION_KEY"] = "0".repeat(64);
  }
}

const { documentService } = await import("../services/document.service.js");

// __dirname = app/backend/src/db → root = ../../../../
const CORE_RULES_DIR = path.resolve(__dirname, "../../../../data/core-rules");

const DOCUMENTS = [
  {
    filename: "dm_encounter_rules.md",
    title: "reglas-dm-encuentros-y-mazmorras",
    description:
      "Diseño de combate y estructura de mazmorras: economía de acciones, ajuste por tamaño de grupo, evitar monstruos solitarios, presión sostenida vs picos de daño, anti-armadura, fases de jefe, estructura de mazmorras pequeñas, variedad de encuentros y narrativa de terreno. Complementa el SRD 5.2.1, no lo contradice.",
    sourceType: "homebrew_external" as const,
    authorityLevel: "medium" as const,
  },
  {
    filename: "gpt_reglas_dm.md",
    title: "reglas-dm-encuentros-y-sesion",
    description:
      "Filosofía y prácticas de diseño de encuentros, más preparación y conducción de sesión: ajuste por tamaño de grupo, economía de acciones con ejemplos, estructuras de encuentro preferidas, anti-armadura, grupos optimizados, modelo de preparación en una hora, estructura del encuentro en mesa, buenas prácticas e improvisación. Complementa el SRD 5.2.1, no lo contradice.",
    sourceType: "homebrew_external" as const,
    authorityLevel: "medium" as const,
  },
];

const { prisma } = await import("../db/prisma.js");

let imported = 0;
let skipped = 0;

for (const doc of DOCUMENTS) {
  const existing = await prisma.document.findFirst({ where: { title: doc.title } });
  if (existing && !args.force) {
    console.log(`  ↷ Skipping (already exists): ${doc.title}`);
    skipped++;
    continue;
  }

  const srcPath = path.join(CORE_RULES_DIR, doc.filename);
  let content: string;
  try {
    content = await fs.readFile(srcPath, "utf-8");
  } catch {
    console.error(`  ✗ File not found: ${srcPath}`);
    continue;
  }

  if (existing && args.force) {
    await prisma.documentChunk.deleteMany({ where: { documentId: existing.id } });
    await prisma.document.delete({ where: { id: existing.id } });
    console.log(`  ⟳ Replacing: ${doc.title}`);
  }

  // campaignId = null → global document, not tied to any campaign
  const created = await documentService.create({
    title: doc.title,
    description: doc.description,
    content,
    contentType: "markdown",
    sourceType: doc.sourceType,
    authorityLevel: doc.authorityLevel,
    version: "1.0",
  });

  console.log(`  ✓ Imported: ${created.title}`);
  imported++;
}

console.log(`\nDone: ${imported} imported, ${skipped} skipped`);
if (imported > 0) {
  console.log("Indexing and embedding runs in background — check document status in Settings.");
}

await prisma.$disconnect();
