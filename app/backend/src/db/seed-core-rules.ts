/**
 * Core Rules Seed — imports DM homebrew_external rule documents on first run.
 *
 * Bundled alongside the SRD seed. Idempotent: uses AppSetting key to skip
 * if already imported. Only runs when --seed-dir is provided (Tauri desktop).
 */

import { copyFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { prisma } from "./prisma.js";

interface RuleMeta {
  filename: string;
  title: string;
  description: string;
}

const RULE_DOCS: RuleMeta[] = [
  {
    filename: "dm_encounter_rules.md",
    title: "reglas-dm-encuentros-y-mazmorras",
    description:
      "Diseño de combate y estructura de mazmorras: economía de acciones, ajuste por tamaño de grupo, evitar monstruos solitarios, presión sostenida vs picos de daño, anti-armadura, fases de jefe, estructura de mazmorras pequeñas, variedad de encuentros y narrativa de terreno. Complementa el SRD 5.2.1, no lo contradice.",
  },
  {
    filename: "gpt_reglas_dm.md",
    title: "reglas-dm-encuentros-y-sesion",
    description:
      "Filosofía y prácticas de diseño de encuentros, más preparación y conducción de sesión: ajuste por tamaño de grupo, economía de acciones con ejemplos, estructuras de encuentro preferidas, anti-armadura, grupos optimizados, modelo de preparación en una hora, estructura del encuentro en mesa, buenas prácticas e improvisación. Complementa el SRD 5.2.1, no lo contradice.",
  },
];

/**
 * Hash sha256 del contenido de los archivos de reglas presentes en seedRulesDir.
 * Se usa como marker de versión: si el contenido cambia, el hash cambia y el
 * seed vuelve a importar. Incluye el nombre de archivo para que reordenar o
 * renombrar también invalide el marker.
 */
async function computeRulesHash(seedRulesDir: string): Promise<string> {
  const hash = createHash("sha256");
  for (const meta of RULE_DOCS) {
    const src = join(seedRulesDir, meta.filename);
    if (existsSync(src)) {
      // Incluye title/description (viven en código, no en el .md) para que un
      // cambio de metadata también invalide el marker y dispare la reimportación.
      hash.update(meta.filename);
      hash.update(meta.title);
      hash.update(meta.description);
      hash.update(await readFile(src));
    }
  }
  return hash.digest("hex");
}

export async function seedCoreRulesIfNeeded(
  dataDir: string,
  seedDir: string | undefined
): Promise<void> {
  if (!seedDir) return;

  const seedRulesDir = join(seedDir, "core-rules");
  if (!existsSync(seedRulesDir)) {
    console.warn(`[seed] Core rules seed directory not found: ${seedRulesDir}`);
    return;
  }

  const currentHash = await computeRulesHash(seedRulesDir);

  const existing = await prisma.appSetting.findUnique({
    where: { key: "core_rules_version" },
  });

  if (existing?.value === currentHash) {
    console.log(`[seed] Core rules already seeded (hash ${currentHash.slice(0, 12)}…), skipping`);
    return;
  }

  // El contenido cambió (o es la primera vez): si ya había reglas importadas,
  // borrarlas para reimportar la versión nueva. Solo toca los documentos de
  // core-rules (homebrew_external con los títulos conocidos), nunca contenido del usuario.
  if (existing) {
    await prisma.document.deleteMany({
      where: {
        sourceType: "homebrew_external",
        title: { in: RULE_DOCS.map((r) => r.title) },
      },
    });
    console.log("[seed] Core rules hash changed — reimportando versión nueva");
  }

  console.log(`[seed] Seeding DM core rules (hash ${currentHash.slice(0, 12)}…)...`);

  const targetDir = join(dataDir, "documents", "global");
  await mkdir(targetDir, { recursive: true });

  let imported = 0;

  for (const meta of RULE_DOCS) {
    const src = join(seedRulesDir, meta.filename);
    if (!existsSync(src)) {
      console.warn(`[seed] Core rule file not found: ${src}`);
      continue;
    }

    // Skip if already imported by title
    const existing = await prisma.document.findFirst({ where: { title: meta.title } });
    if (existing) {
      console.log(`[seed] Core rule already exists: ${meta.title}`);
      continue;
    }

    const docId = randomUUID();
    const relativePath = join("global", `${docId}.md`);
    const destPath = join(targetDir, `${docId}.md`);

    await copyFile(src, destPath);

    await prisma.document.create({
      data: {
        id: docId,
        title: meta.title,
        description: meta.description,
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

    console.log(`[seed] Imported core rule: ${meta.title}`);
    imported++;
  }

  console.log(`[seed] Core rules seed complete: ${imported} imported`);

  await prisma.appSetting.upsert({
    where: { key: "core_rules_version" },
    update: { value: currentHash },
    create: { key: "core_rules_version", value: currentHash },
  });
}
