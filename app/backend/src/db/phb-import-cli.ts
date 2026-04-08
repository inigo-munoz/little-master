/**
 * CLI para importar el PHB 2024 independientemente del setup completo.
 * Usage: npx tsx src/db/phb-import-cli.ts [--force]
 *
 * --force: reimporta aunque ya existan (borra y recrea los documentos PHB)
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
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

  if (force) {
    console.log("  --force: eliminando documentos PHB existentes...");
    const deleted = await prisma.document.deleteMany({ where: { sourceType: "official" } });
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
