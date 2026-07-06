/**
 * CLI para importar el PHB 2024 independientemente del setup completo.
 * Usage: npx tsx src/db/phb-import-cli.ts [--force]
 *
 * --force: reimporta aunque ya existan (borra y recrea los documentos PHB)
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importPhb2024 } from "./phb-import.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env["DATA_DIR"]
  ? path.resolve(process.env["DATA_DIR"])
  : path.resolve(__dirname, "../../../../data");

const force = process.argv.includes("--force") || process.env["PHB_FORCE_REIMPORT"] === "true";

async function main() {
  console.log("\n📚 PHB 2024 Import\n");

  // Standalone CLI: fail fast if the private content directory is missing.
  const phbDir = path.join(DATA_DIR, "private", "phb2024");
  if (!existsSync(phbDir)) {
    console.error(
      `[phb-import] Private content directory not found: ${phbDir}\n` +
        `Place your own PHB 2024 markdown files there. This content is personal and must never be committed.`
    );
    process.exit(1);
  }

  if (force) {
    console.log("  --force: eliminando documentos PHB existentes...");
    // Solo documentos PHB: excluye los del Monster Manual (title "MM 2024 …"),
    // que también usan sourceType "official" y no debe borrar un --force de PHB.
    const deleted = await prisma.document.deleteMany({
      where: { sourceType: "official", NOT: { title: { startsWith: "MM 2024" } } },
    });
    console.log(`  Eliminados ${deleted.count} documentos PHB existentes\n`);
  }

  const result = await importPhb2024(prisma, DATA_DIR, { verbose: true });

  if (result.errors.length > 0) {
    console.log("\n⚠ Errores:");
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log(`\n✅ Completado: ${result.imported} importados, ${result.skipped} omitidos`);
  console.log("\nPróximo paso: Settings → Semantic Search → Embed All\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
