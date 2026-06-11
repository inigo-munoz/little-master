/**
 * SRD Import Service
 *
 * Automatically imports the SRD 5.2.1 (CC-BY-4.0) into the system on first run.
 * The SRD files ship with the repository under /data/srd/.
 *
 * Attribution (required by CC-BY-4.0):
 * This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1")
 * by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.
 * Licensed under CC-BY-4.0: https://creativecommons.org/licenses/by/4.0/legalcode
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

interface SrdSection {
  filename: string;
  title: string;
  lang: "en" | "es";
}

const SRD_SECTIONS: SrdSection[] = [
  { filename: "01_Legal_y_Reglas_Basicas.txt",  title: "SRD 5.2.1 — Legal & Basic Rules",         lang: "en" },
  { filename: "02_Reglas_de_Juego.txt",          title: "SRD 5.2.1 — Playing the Game",            lang: "en" },
  { filename: "03_Clases.txt",                   title: "SRD 5.2.1 — Classes",                     lang: "en" },
  { filename: "04_Hechizos_A_L.txt",             title: "SRD 5.2.1 — Spells A-L",                  lang: "en" },
  { filename: "05_Hechizos_M_Z.txt",             title: "SRD 5.2.1 — Spells M-Z",                  lang: "en" },
  { filename: "06_Trasfondos_y_Equipo.txt",       title: "SRD 5.2.1 — Backgrounds & Equipment",     lang: "en" },
  { filename: "07_Caja_de_Herramientas.txt",      title: "SRD 5.2.1 — Gameplay Toolbox",            lang: "en" },
  { filename: "08_Monstruos.txt",                title: "SRD 5.2.1 — Monsters",                    lang: "en" },
  { filename: "09_Hechizos.md",                   title: "SRD 5.2.1 — Spells",                      lang: "en" },
];

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if ((current + para).length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(" ");
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 6));
      current = overlapWords.join(" ") + " " + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 0);
}

export async function importSrd(
  prisma: PrismaClient,
  dataDir: string,
  opts: { skipIfExists?: boolean; verbose?: boolean } = {}
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { skipIfExists = true, verbose = true } = opts;
  const srdDir = path.join(dataDir, "srd", "en");
  const documentsDir = path.join(dataDir, "documents", "global");

  const log = verbose ? console.log : () => {};
  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  // Check if SRD directory exists
  try {
    await fs.access(srdDir);
  } catch {
    results.errors.push(`SRD directory not found: ${srdDir}`);
    return results;
  }

  await fs.mkdir(documentsDir, { recursive: true });

  for (const section of SRD_SECTIONS) {
    const srcPath = path.join(srdDir, section.filename);

    // Check if already imported
    if (skipIfExists) {
      const existing = await prisma.document.findFirst({
        where: { title: section.title, sourceType: "srd" },
      });
      if (existing) {
        log(`  ↷ Skipping (already imported): ${section.title}`);
        results.skipped++;
        continue;
      }
    }

    // Read source file
    let content: string;
    try {
      content = await fs.readFile(srcPath, "utf-8");
    } catch {
      const msg = `File not found: ${srcPath}`;
      results.errors.push(msg);
      log(`  ✗ ${msg}`);
      continue;
    }

    // Save to documents directory
    const docId = crypto.randomUUID();
    const relativePath = path.join("global", `srd_${docId}.txt`);
    const absolutePath = path.join(dataDir, "documents", relativePath);
    await fs.writeFile(absolutePath, content, "utf-8");

    // Create document record + chunks atomically
    const chunks = chunkText(content);
    try {
      await prisma.$transaction(
      async (tx) => {
        const doc = await tx.document.create({
          data: {
            id: docId,
            title: section.title,
            path: relativePath,
            contentType: "plaintext",
            sourceType: "srd",
            authorityLevel: "high",
            version: "5.2.1",
            campaignId: null,
            isIndexed: false,
            chunkCount: 0,
          },
        });

        await tx.documentChunk.createMany({
          data: chunks.map((chunkContent, i) => ({
            documentId: doc.id,
            campaignId: null,
            content: chunkContent,
            chunkIndex: i,
            sourceType: "srd",
            authorityLevel: "high",
            embeddingJson: null,
          })),
        });

        await tx.document.update({
          where: { id: doc.id },
          data: { isIndexed: true, chunkCount: chunks.length },
        });
      },
      { timeout: 30000 } // los documentos grandes generan muchos chunks
      );
    } catch (err) {
      // Compensación: la BD hizo rollback — borrar el fichero recién escrito para no dejarlo huérfano
      await fs.unlink(absolutePath).catch((unlinkErr: unknown) => {
        console.warn(`[srd-import] No se pudo borrar el fichero huérfano ${absolutePath}:`, unlinkErr);
      });
      throw err;
    }

    log(`  ✓ Imported: ${section.title} (${chunks.length} chunks)`);
    results.imported++;
  }

  return results;
}
