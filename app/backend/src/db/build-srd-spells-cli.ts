import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSpellsMarkdown } from "./srd-spells-builder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env["DATA_DIR"] ?? path.resolve(__dirname, "../../../../data");
const source = path.join(dataDir, "srd", "en", "06_Trasfondos_y_Equipo.txt");
const target = path.join(dataDir, "srd", "en", "09_Spells.md");

const raw = readFileSync(source, "utf-8");
const { markdown, count } = buildSpellsMarkdown(raw);

if (count < 290) {
  console.error(`[build-srd-spells] Only ${count} spells parsed (expected ~300+). Aborting.`);
  process.exit(1);
}

writeFileSync(target, markdown, "utf-8");
console.log(`[build-srd-spells] Wrote ${count} spells to ${target}`);
