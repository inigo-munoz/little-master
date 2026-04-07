/**
 * Cleans NPC descriptions stored in the database.
 * Removes Obsidian-specific syntax: Mermaid code, dataviewjs blocks,
 * Meta-Bind inputs, template literals, and other non-narrative content.
 *
 * Usage: npx tsx src/db/clean-npc-descriptions.ts
 *        npx tsx src/db/clean-npc-descriptions.ts --dry-run
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

function cleanDescription(text: string | null): string | null {
  if (!text) return null;

  const skipPrefixes = [
    ">",
    "```",
    "INPUT[",
    "BUTTON[",
    "**Misiones",
    "**Grupos",
    "**Conexion",
    "# Statblock",
    "# Connections",
    "# Relationships",
    "# Inventory",
    "# Selling",
    "# Buying",
    "# Services",
    "# Rumours",
  ];

  const skipContains = [
    ":::internal-link",
    "mermaid",
    "flowchart LR",
    "dv.paragraph",
    "join('')}",
    "join(\"\")}",
    "map((a,i)",
    "map((e,i)",
    "map((_,i)",
    "internal-link;`",
    "Template_",
    "![[",
    "tabbed-box",
    "no-h clean",
    "div-m|no-title",
    "INPUT[select",
    "INPUT[inline",
    "INPUT[suggester",
    "INPUT[list",
    "INPUT[datePicker",
    "INPUT[inlineList",
    "class(tabbed)",
  ];

  const lines = text.split("\n");
  const cleaned: string[] = [];
  let skipUntilNextSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Reset skip on new top-level section we want to keep
    if (trimmed.match(/^# (General|GM Notes|Backstory|Planning|Quest Info|Quest Details|Goals|Overview|Session Overview|Notes)$/)) {
      skipUntilNextSection = false;
    }

    // Skip technical sections entirely
    if (trimmed.match(/^# (Statblock|Connections|Relationships|Inventory|Selling|Buying|Services|Rumours|Hierarchy|Enemies\/Allies|Membership|Ranks|People|Image)$/)) {
      skipUntilNextSection = true;
    }

    if (skipUntilNextSection) continue;

    // Skip empty lines at start
    if (!trimmed && cleaned.length === 0) continue;

    // Check skip prefixes
    let skip = false;
    for (const prefix of skipPrefixes) {
      if (trimmed.startsWith(prefix)) { skip = true; break; }
    }
    if (skip) continue;

    // Check skip contains
    for (const substr of skipContains) {
      if (trimmed.includes(substr)) { skip = true; break; }
    }
    if (skip) continue;

    // Remove bold markers **text** → text
    let cleaned_line = line;
    while (cleaned_line.includes("**")) {
      const a = cleaned_line.indexOf("**");
      const b = cleaned_line.indexOf("**", a + 2);
      if (b === -1) break;
      cleaned_line = cleaned_line.slice(0, a) + cleaned_line.slice(a + 2, b) + cleaned_line.slice(b + 2);
    }

    // Remove wiki links [[path|alias]] → alias or path
    while (cleaned_line.includes("[[")) {
      const a = cleaned_line.indexOf("[[");
      const b = cleaned_line.indexOf("]]", a);
      if (b === -1) break;
      const inner = cleaned_line.slice(a + 2, b);
      const parts = inner.split("|");
      const display = parts[parts.length - 1] ?? inner;
      cleaned_line = cleaned_line.slice(0, a) + display + cleaned_line.slice(b + 2);
    }

    // Remove heading markers (keep text)
    if (cleaned_line.match(/^#+\s/)) {
      cleaned_line = cleaned_line.replace(/^#+\s+/, "");
    }

    // Remove italic markers *text* → text (but not list bullets)
    if (!cleaned_line.trim().startsWith("- ") && !cleaned_line.trim().startsWith("* ")) {
      cleaned_line = cleaned_line.replace(/\*([^*]+)\*/g, "$1");
    }

    cleaned.push(cleaned_line);
  }

  // Collapse multiple blank lines
  const result = cleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result || null;
}

async function main() {
  console.log(`\n🧹 NPC Description Cleaner${dryRun ? " (DRY RUN)" : ""}\n`);

  const npcs = await prisma.npc.findMany({
    select: { id: true, name: true, description: true },
  });

  console.log(`Found ${npcs.length} NPCs\n`);

  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const npc of npcs) {
    const cleaned = cleanDescription(npc.description);

    if (cleaned === npc.description) {
      unchanged++;
      continue;
    }

    const before = npc.description?.length ?? 0;
    const after = cleaned?.length ?? 0;
    const reduction = before > 0 ? Math.round((1 - after / before) * 100) : 0;

    console.log(`  ${npc.name}: ${before} → ${after} chars (-${reduction}%)`);

    if (!dryRun) {
      await prisma.npc.update({
        where: { id: npc.id },
        data: { description: cleaned },
      });
    }

    updated++;
  }

  console.log(`\n✅ Done:`);
  console.log(`   ${updated} updated`);
  console.log(`   ${unchanged} unchanged`);
  console.log(`   ${skipped} skipped`);

  if (dryRun) {
    console.log("\n⚠ Dry run — no changes written. Remove --dry-run to apply.\n");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
