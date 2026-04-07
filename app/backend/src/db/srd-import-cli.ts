/**
 * CLI for re-importing the SRD independently of full setup.
 * Usage: npx tsx src/db/srd-import-cli.ts [--force]
 *
 * --force: reimport even if already imported (deletes existing SRD docs first)
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { importSrd } from "./srd-import.js";

const prisma = new PrismaClient();
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env["DATA_DIR"]
  ? path.resolve(process.env["DATA_DIR"])
  : path.resolve(__dirname, "../../../../data");
const force = process.argv.includes("--force");

async function main() {
  console.log("\n📚 SRD 5.2.1 Import\n");
  console.log(
    "  Attribution: SRD 5.2.1 by Wizards of the Coast LLC — https://www.dndbeyond.com/srd"
  );
  console.log("  License: CC-BY-4.0\n");

  if (force) {
    console.log("  --force: deleting existing SRD documents...");
    const deleted = await prisma.document.deleteMany({ where: { sourceType: "srd" } });
    console.log(`  Deleted ${deleted.count} existing SRD documents\n`);
  }

  const result = await importSrd(prisma, DATA_DIR, {
    skipIfExists: !force,
    verbose: true,
  });

  if (result.errors.length > 0) {
    console.log("\n⚠ Errors:");
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log(
    `\n✅ Done: ${result.imported} imported, ${result.skipped} skipped\n`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
