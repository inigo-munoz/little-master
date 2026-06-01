/**
 * CLI para importar el Monster Manual 2024 independientemente del setup completo.
 * Usage: npx tsx src/db/monster-import-cli.ts [--force]
 *
 * --force: reimporta aunque ya existan (borra y recrea los documentos MM)
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importMonsters } from "./monster-import.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env["DATA_DIR"]
  ? path.resolve(process.env["DATA_DIR"])
  : path.resolve(__dirname, "../../../../data");

const MONSTER_JSON = path.resolve(
  __dirname,
  "../../../frontend/src/lib/monster-data.json"
);

const force = process.argv.includes("--force");

async function main() {
  console.log("\n🐉 Monster Manual 2024 Import\n");

  if (force) {
    console.log("  --force: eliminando documentos MM existentes...");
    const deleted = await prisma.document.deleteMany({
      where: { title: { startsWith: "MM 2024" }, sourceType: "official" },
    });
    console.log(`  Eliminados ${deleted.count} documentos MM existentes\n`);
  }

  const result = await importMonsters(prisma, DATA_DIR, MONSTER_JSON, {
    verbose: true,
  });

  if (result.errors.length > 0) {
    console.log("\n⚠ Errores:");
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log(
    `\n✅ Completado: ${result.totalMonsters} monstruos → ${result.imported} documentos importados, ${result.skipped} omitidos`
  );
  console.log("\nPróximo paso: Settings → Semantic Search → Embed All\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
