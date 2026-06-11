/**
 * PHB 2024 Import
 *
 * Imports the D&D 2024 Player's Handbook content into the document store.
 * Files must be present in data/phb2024/ relative to the project root.
 *
 * Usage: npx tsx src/db/phb-import.ts
 *        PHB_FORCE_REIMPORT=true npx tsx src/db/phb-import.ts
 *
 * Follows the same pattern as srd-import.ts:
 * - Writes content to data/documents/global/
 * - Creates Document + DocumentChunk records in the DB
 * - Does NOT generate embeddings (run embed-all from Settings after setup)
 */

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

interface PhbDocument {
  title: string;
  filename: string;
}

const PHB_DOCUMENTS: PhbDocument[] = [
  { title: "PHB 2024 — Clases y Subclases",            filename: "clases.md" },
  { title: "PHB 2024 — Especies",                      filename: "especies.md" },
  { title: "PHB 2024 — Trasfondos",                    filename: "trasfondos.md" },
  { title: "PHB 2024 — Listas de Hechizos por Clase",  filename: "hechizos-listas.md" },
  { title: "PHB 2024 — Dones (Feats)",                 filename: "dones.md" },
  { title: "PHB 2024 — Equipo y Armas",                filename: "equipo.md" },
  { title: "PHB 2024 — Reglas de Juego",               filename: "reglas.md" },
  { title: "PHB 2024 — El Multiverso",                 filename: "multiverso.md" },
  { title: "PHB 2024 — Criaturas (Apéndice B)",        filename: "criaturas.md" },
  { title: "PHB 2024 — Glosario de Reglas",            filename: "glosario.md" },
  { title: "PHB 2024 — Hechizos (Descripciones Completas A-Z)", filename: "hechizos-completos.md" },
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

export async function importPhb2024(
  prisma: PrismaClient,
  dataDir: string,
  opts: { forceReimport?: boolean; verbose?: boolean } = {}
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { forceReimport = false, verbose = true } = opts;
  const phbDir = path.join(dataDir, "phb2024");
  const documentsDir = path.join(dataDir, "documents", "global");

  const log = verbose ? console.log : () => {};
  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  if (!existsSync(phbDir)) {
    results.errors.push(`PHB directory not found: ${phbDir}`);
    log(`  ✗ Directorio PHB no encontrado: ${phbDir}`);
    return results;
  }

  await fs.mkdir(documentsDir, { recursive: true });

  for (const doc of PHB_DOCUMENTS) {
    // Verificar si ya está importado
    if (!forceReimport) {
      const existing = await prisma.document.findFirst({
        where: { title: doc.title, sourceType: "official" },
      });
      if (existing) {
        log(`  ↷ Ya existe: ${doc.title}`);
        results.skipped++;
        continue;
      }
    }

    const srcPath = path.join(phbDir, doc.filename);
    if (!existsSync(srcPath)) {
      const msg = `Archivo no encontrado: ${srcPath}`;
      results.errors.push(msg);
      log(`  ✗ ${msg}`);
      continue;
    }

    let content: string;
    try {
      content = await fs.readFile(srcPath, "utf-8");
    } catch (err: unknown) {
      const msg = `Error leyendo ${srcPath}: ${err}`;
      results.errors.push(msg);
      log(`  ✗ ${msg}`);
      continue;
    }

    try {
      // Guardar en data/documents/global/
      const docId = crypto.randomUUID();
      const relativePath = path.join("global", `phb_${docId}.md`);
      const absolutePath = path.join(dataDir, "documents", relativePath);
      await fs.writeFile(absolutePath, content, "utf-8");

      // Registro en la BD + chunks de forma atómica (sin embeddings — se generan después vía Settings)
      const chunks = chunkText(content);
      try {
        await prisma.$transaction(
        async (tx) => {
          const document = await tx.document.create({
            data: {
              id: docId,
              title: doc.title,
              path: relativePath,
              contentType: "markdown",
              sourceType: "official",
              authorityLevel: "high",
              version: "2024",
              campaignId: null,
              isIndexed: false,
              chunkCount: 0,
            },
          });

          await tx.documentChunk.createMany({
            data: chunks.map((chunkContent, i) => ({
              documentId: document.id,
              campaignId: null,
              content: chunkContent,
              chunkIndex: i,
              sourceType: "official",
              authorityLevel: "high",
              embeddingJson: null,
            })),
          });

          await tx.document.update({
            where: { id: document.id },
            data: { isIndexed: true, chunkCount: chunks.length },
          });
        },
        { timeout: 30000 } // los documentos grandes generan muchos chunks
        );
      } catch (txErr) {
        // Compensación: la BD hizo rollback — borrar el fichero recién escrito para no dejarlo huérfano
        await fs.unlink(absolutePath).catch((unlinkErr: unknown) => {
          console.warn(`[phb-import] No se pudo borrar el fichero huérfano ${absolutePath}:`, unlinkErr);
        });
        throw txErr;
      }

      log(`  ✓ Importado: ${doc.title} (${chunks.length} chunks)`);
      results.imported++;
    } catch (err: unknown) {
      const msg = `Error importando ${doc.title}: ${err}`;
      results.errors.push(msg);
      log(`  ✗ ${msg}`);
    }
  }

  return results;
}

