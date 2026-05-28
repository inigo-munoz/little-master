import type { FastifyPluginAsync, FastifyReply } from "fastify";
import PDFDocument from "pdfkit";
import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";
import {
  generatePdf,
  stripMarkdown,
  addSection,
  addSectionDivider,
  addDivider,
  addFooter,
  FONT_BOLD,
  FONT_NORMAL,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
} from "../services/pdf.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function sendPdf(reply: FastifyReply, buffer: Buffer, filename: string): void {
  reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(buffer);
}

// Detecta un bloque de "secreto del DM" en el texto de descripción.
// Reconoce líneas que empiezan con "> " o secciones marcadas como secreto/secret/GM.
function extractDmSecret(description: string): { cleanDesc: string; secret: string } {
  const lines = description.split("\n");
  const secretLines: string[] = [];
  const cleanLines: string[] = [];

  let inSecret = false;
  for (const line of lines) {
    if (/^#+\s*(secreto|secret|gm notes?|notas del dm)/i.test(line)) {
      inSecret = true;
      continue;
    }
    if (inSecret && /^#+\s/.test(line)) {
      inSecret = false;
    }
    if (inSecret || line.startsWith("> ")) {
      secretLines.push(line.startsWith("> ") ? line.slice(2) : line);
    } else {
      cleanLines.push(line);
    }
  }

  return {
    cleanDesc: cleanLines.join("\n").trim(),
    secret: secretLines.join("\n").trim(),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const pdfRoutes: FastifyPluginAsync = async (server) => {

  // ── NPC ────────────────────────────────────────────────────────────────────
  server.get<{ Params: { id: string } }>("/npc/:id", async (request, reply) => {
    const npc = await prisma.npc.findUnique({ where: { id: request.params.id } });
    if (!npc) throw AppError.notFound(ErrorCode.NPC_NOT_FOUND, "NPC not found");

    const tags = parseTags(npc.tags);
    const race = tags[0];
    const gender = tags[1];
    const age = tags[2];
    const chipTags = tags.slice(3);

    // Extraer aliados y enemigos de la descripción
    const allies: string[] = [];
    const enemies: string[] = [];
    if (npc.description) {
      for (const line of npc.description.split("\n")) {
        if (line.startsWith("Allies:")) {
          allies.push(...line.slice(7).split(",").map(s => s.trim()).filter(Boolean));
        }
        if (line.startsWith("Enemies:")) {
          enemies.push(...line.slice(8).split(",").map(s => s.trim()).filter(Boolean));
        }
      }
    }

    // Extraer secreto del DM
    const rawDesc = (npc.description ?? "")
      .split("\n")
      .filter(l => !l.startsWith("Allies:") && !l.startsWith("Enemies:"))
      .join("\n");

    const { cleanDesc, secret: descSecret } = extractDmSecret(rawDesc);

    // Secreto adicional desde rawContent
    let gmNotes = descSecret;
    if (npc.rawContent) {
      const gmIdx = npc.rawContent.indexOf("# GM Notes");
      if (gmIdx !== -1) {
        const rawNotes = stripMarkdown(npc.rawContent.slice(gmIdx + 10).trim());
        gmNotes = gmNotes ? `${gmNotes}\n\n${rawNotes}` : rawNotes;
      }
    }

    const subtitle = [
      npc.role ?? null,
      race ?? null,
      gender ?? null,
      age ?? null,
      `Estado: ${npc.status}`,
    ].filter(Boolean).join("  ·  ");

    return new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: MARGIN, bottom: MARGIN + 20, left: MARGIN, right: MARGIN },
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        sendPdf(reply, buffer, `npc-${npc.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
        resolve();
      });
      doc.on("error", reject);

      // ── Título ────────────────────────────────────────────────────────────
      doc.font(FONT_BOLD).fontSize(20).fillColor("#e8a820")
        .text(npc.name, { width: PAGE_WIDTH });
      doc.moveDown(0.3);
      doc.font(FONT_NORMAL).fontSize(14).fillColor("#888888")
        .text(subtitle, { width: PAGE_WIDTH });
      doc.moveDown(0.8);
      addDivider(doc);

      // ── Descripción ───────────────────────────────────────────────────────
      if (cleanDesc.trim()) {
        addSection(doc, "Descripción", stripMarkdown(cleanDesc));
      }

      // ── Aliados (verde oscuro) ─────────────────────────────────────────────
      if (allies.length > 0) {
        doc.font(FONT_BOLD).fontSize(12).fillColor("#c8a84b")
          .text("ALIADOS", { width: PAGE_WIDTH });
        doc.moveDown(0.3);
        doc.font(FONT_NORMAL).fontSize(11).fillColor("#4a7c5a")
          .text(allies.join(", "), { width: PAGE_WIDTH });
        doc.moveDown(1);
        addSectionDivider(doc);
      }

      // ── Enemigos (rojo oscuro) ─────────────────────────────────────────────
      if (enemies.length > 0) {
        doc.font(FONT_BOLD).fontSize(12).fillColor("#c8a84b")
          .text("ENEMIGOS", { width: PAGE_WIDTH });
        doc.moveDown(0.3);
        doc.font(FONT_NORMAL).fontSize(11).fillColor("#8b3a3a")
          .text(enemies.join(", "), { width: PAGE_WIDTH });
        doc.moveDown(1);
        addSectionDivider(doc);
      }

      // ── Tags como chips ───────────────────────────────────────────────────
      const displayTags = [...(race ? [race] : []), ...(gender ? [gender] : []), ...(age ? [age] : []), ...chipTags];
      if (displayTags.length > 0) {
        doc.font(FONT_BOLD).fontSize(12).fillColor("#c8a84b")
          .text("TAGS", { width: PAGE_WIDTH });
        doc.moveDown(0.4);
        let x = MARGIN;
        const y = doc.y;
        const tagPad = 8;
        const tagH = 18;
        for (const tag of displayTags) {
          const w = doc.widthOfString(tag) + tagPad * 2;
          if (x + w > MARGIN + PAGE_WIDTH) { x = MARGIN; doc.y += tagH + 4; }
          doc
            .rect(x, doc.y, w, tagH)
            .lineWidth(0.5).strokeColor("#666666").stroke();
          doc.font(FONT_NORMAL).fontSize(9).fillColor("#aaaaaa")
            .text(tag, x + tagPad, doc.y + 4, { lineBreak: false });
          x += w + 6;
        }
        doc.y = doc.y + tagH + 8;
        doc.moveDown(0.5);
        addSectionDivider(doc);
      }

      // ── Secreto del DM (caja destacada) ──────────────────────────────────
      if (gmNotes.trim()) {
        const secretText = stripMarkdown(gmNotes);
        const boxH = Math.max(60, doc.heightOfString(secretText, { width: PAGE_WIDTH - 24 }) + 24);
        const boxY = doc.y;

        doc.rect(MARGIN, boxY, PAGE_WIDTH, boxH)
          .fillAndStroke("#2a1a1a", "#7a3030");

        doc.font(FONT_BOLD).fontSize(10).fillColor("#cc5555")
          .text("SECRETO DEL DM", MARGIN + 12, boxY + 8, { width: PAGE_WIDTH - 24 });
        doc.font(FONT_NORMAL).fontSize(10).fillColor("#d4c0c0")
          .text(secretText, MARGIN + 12, boxY + 22, { width: PAGE_WIDTH - 24 });

        doc.y = boxY + boxH + 12;
      }

      // ── Pie de página con numeración en todas las páginas ─────────────────
      const npcTotal = doc.bufferedPageRange().count;
      for (let p = 0; p < npcTotal; p++) {
        doc.switchToPage(p);
        addFooter(doc, npc.name, p + 1, npcTotal);
      }
      doc.flushPages();
      doc.end();
    });
  });

  // ── Sesión ─────────────────────────────────────────────────────────────────
  server.get<{ Params: { id: string } }>("/session/:id", async (request, reply) => {
    const session = await prisma.session.findUnique({ where: { id: request.params.id } });
    if (!session) throw AppError.notFound(ErrorCode.SESSION_NOT_FOUND, "Session not found");

    const dateStr = session.playedAt
      ? new Date(session.playedAt).toLocaleDateString("es-ES", {
          year: "numeric", month: "long", day: "numeric",
        })
      : null;

    const subtitle = [`Sesión #${session.sessionNumber}`, dateStr].filter(Boolean).join("  ·  ");

    const sections = [];
    if (session.summary) sections.push({ heading: "Resumen", body: stripMarkdown(session.summary) });
    if (session.notes) sections.push({ heading: "Notas", body: stripMarkdown(session.notes) });

    const buffer = await generatePdf({ title: session.title, subtitle, sections });
    sendPdf(reply, buffer, `session-${session.sessionNumber}.pdf`);
  });

  // ── Localización ───────────────────────────────────────────────────────────
  server.get<{ Params: { id: string } }>("/location/:id", async (request, reply) => {
    const location = await prisma.location.findUnique({ where: { id: request.params.id } });
    if (!location) throw AppError.notFound(ErrorCode.NOT_FOUND, "Location not found");

    const tags = parseTags(location.tags);

    const sections = [];
    if (location.description) {
      sections.push({ heading: "Descripción", body: stripMarkdown(location.description) });
    }
    if (tags.length) sections.push({ heading: "Tags", body: tags.join(", ") });

    const buffer = await generatePdf({ title: location.name, sections });
    sendPdf(reply, buffer, `location-${location.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  });

  // ── Facción ────────────────────────────────────────────────────────────────
  server.get<{ Params: { id: string } }>("/faction/:id", async (request, reply) => {
    const faction = await prisma.faction.findUnique({ where: { id: request.params.id } });
    if (!faction) throw AppError.notFound(ErrorCode.NOT_FOUND, "Faction not found");

    const tags = parseTags(faction.tags);
    const subtitle = [faction.alignment, faction.disposition !== "unknown" ? faction.disposition : null]
      .filter(Boolean).join("  ·  ");

    const sections = [];
    if (faction.description) {
      sections.push({ heading: "Descripción", body: stripMarkdown(faction.description) });
    }
    if (tags.length) sections.push({ heading: "Tags", body: tags.join(", ") });

    const buffer = await generatePdf({ title: faction.name, subtitle, sections });
    sendPdf(reply, buffer, `faction-${faction.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  });

  // ── Campaña (resumen completo) ─────────────────────────────────────────────
  server.get<{ Params: { id: string } }>("/campaign/:id", async (request, reply) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: request.params.id } });
    if (!campaign) throw AppError.notFound(ErrorCode.CAMPAIGN_NOT_FOUND, "Campaign not found");

    // Datos relacionados en paralelo
    const [players, allNpcs, sessions, locations, factions, issues] = await Promise.all([
      prisma.player.findMany({ where: { campaignId: campaign.id }, orderBy: { name: "asc" } }),
      prisma.npc.findMany({ where: { campaignId: campaign.id }, orderBy: { name: "asc" } }),
      prisma.session.findMany({ where: { campaignId: campaign.id }, orderBy: { sessionNumber: "asc" } }),
      prisma.location.findMany({ where: { campaignId: campaign.id }, orderBy: { name: "asc" } }),
      prisma.faction.findMany({ where: { campaignId: campaign.id }, orderBy: { name: "asc" } }),
      prisma.issue.findMany({ where: { campaignId: campaign.id, status: "open" }, orderBy: { createdAt: "desc" } }),
    ]);

    // NPCs agrupados: vivos primero, muertos al final
    const npcsAlive = allNpcs.filter(n => n.status !== "dead");
    const npcsDead = allNpcs.filter(n => n.status === "dead");

    // Issues ordenados por severidad
    const SEVERITY_ORDER: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };
    const sortedIssues = [...issues].sort((a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
    );

    const dateStr = new Date().toLocaleDateString("es-ES", {
      year: "numeric", month: "long", day: "numeric",
    });

    return new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: MARGIN, bottom: MARGIN + 20, left: MARGIN, right: MARGIN },
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="campaign-${campaign.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.pdf"`)
          .send(buffer);
        resolve();
      });
      doc.on("error", reject);

      // ── Portada ──────────────────────────────────────────────────────────
      doc
        .font(FONT_BOLD).fontSize(28).fillColor("#e8a820")
        .text(campaign.title, { width: PAGE_WIDTH, align: "center" });
      doc.moveDown(0.4);
      doc
        .font(FONT_NORMAL).fontSize(14).fillColor("#888888")
        .text(campaign.system, { width: PAGE_WIDTH, align: "center" });
      doc.moveDown(0.3);
      doc
        .font(FONT_NORMAL).fontSize(10).fillColor("#555555")
        .text(`Generado el ${dateStr}`, { width: PAGE_WIDTH, align: "center" });
      doc.moveDown(1.5);
      addDivider(doc);

      if (campaign.description) {
        doc.font(FONT_NORMAL).fontSize(11).fillColor("#d4d0c8")
          .text(stripMarkdown(campaign.description), { width: PAGE_WIDTH, lineGap: 3 });
        doc.moveDown(1);
        addDivider(doc);
      }

      // ── Jugadores (tabla con columnas alineadas) ──────────────────────────
      if (players.length > 0) {
        doc.font(FONT_BOLD).fontSize(12).fillColor("#c8a84b")
          .text("JUGADORES", { width: PAGE_WIDTH });
        doc.moveDown(0.4);

        // Cabecera de tabla
        const colW: [number, number, number, number, number] = [PAGE_WIDTH * 0.35, PAGE_WIDTH * 0.30, PAGE_WIDTH * 0.15, PAGE_WIDTH * 0.10, PAGE_WIDTH * 0.10];
        const colX: [number, number, number, number, number] = [
          MARGIN,
          MARGIN + colW[0],
          MARGIN + colW[0] + colW[1],
          MARGIN + colW[0] + colW[1] + colW[2],
          MARGIN + colW[0] + colW[1] + colW[2] + colW[3],
        ];

        doc.font(FONT_BOLD).fontSize(9).fillColor("#888888");
        const headerY = doc.y;
        const headers = ["Personaje", "Clase / Raza", "Nivel", "HP", "CA"];
        headers.forEach((h, i) => {
          doc.text(h, colX[i], headerY, { width: colW[i], lineBreak: false });
        });
        // Avanzar manualmente y restablecer x tras los lineBreak:false
        doc.y = headerY + 14;
        doc.x = MARGIN;

        // Línea separadora de cabecera
        const lineY = doc.y;
        doc.moveTo(MARGIN, lineY).lineTo(MARGIN + PAGE_WIDTH, lineY)
          .lineWidth(0.3).strokeColor("#555555").stroke();
        doc.moveDown(0.3);

        // Filas
        for (const p of players) {
          const rowY = doc.y;
          const classRace = [p.class, p.race].filter(Boolean).join(" / ");
          doc.font(FONT_NORMAL).fontSize(10).fillColor("#d4d0c8");
          doc.text(p.name, colX[0], rowY, { width: colW[0], lineBreak: false });
          doc.text(classRace || "—", colX[1], rowY, { width: colW[1], lineBreak: false });
          doc.text(String(p.level ?? "—"), colX[2], rowY, { width: colW[2], lineBreak: false });
          doc.text(p.hp != null ? String(p.hp) : "—", colX[3], rowY, { width: colW[3], lineBreak: false });
          doc.text(p.ac != null ? String(p.ac) : "—", colX[4], rowY, { width: colW[4], lineBreak: false });
          // Calcular altura real de la fila (la celda más alta puede envolver texto)
          const rowHeight = Math.max(
            doc.heightOfString(p.name, { width: colW[0] }),
            doc.heightOfString(classRace || "—", { width: colW[1] })
          );
          doc.y = rowY + rowHeight + 6;
          doc.x = MARGIN;
        }

        doc.moveDown(0.5);
        addSectionDivider(doc);
      }

      // ── NPCs activos ──────────────────────────────────────────────────────
      if (npcsAlive.length > 0) {
        addSection(doc, `NPCs activos (${npcsAlive.length})`, npcsAlive.map(n =>
          `${n.name}${n.role ? ` — ${n.role}` : ""}${n.status !== "alive" ? ` [${n.status}]` : ""}`
        ).join("\n"));
      }

      // ── NPCs fallecidos ───────────────────────────────────────────────────
      if (npcsDead.length > 0) {
        doc.font(FONT_BOLD).fontSize(12).fillColor("#c8a84b")
          .text(`NPCS FALLECIDOS (${npcsDead.length})`, { width: PAGE_WIDTH });
        doc.moveDown(0.3);
        doc.font(FONT_NORMAL).fontSize(11).fillColor("#8b6060")
          .text(npcsDead.map(n => `${n.name}${n.role ? ` — ${n.role}` : ""}`).join("\n"), { width: PAGE_WIDTH });
        doc.moveDown(1);
        addSectionDivider(doc);
      }

      // ── Sesiones ──────────────────────────────────────────────────────────
      if (sessions.length > 0) {
        addSection(doc, `Sesiones jugadas (${sessions.length})`, sessions.map(s => {
          const datePart = s.playedAt
            ? `  (${new Date(s.playedAt).toLocaleDateString("es-ES")})`
            : "";
          const summary = s.summary ? `\n   ${s.summary.slice(0, 200)}${s.summary.length > 200 ? "..." : ""}` : "";
          return `#${s.sessionNumber} ${s.title}${datePart}${summary}`;
        }).join("\n\n"));
      }

      // ── Localizaciones ────────────────────────────────────────────────────
      if (locations.length > 0) {
        addSection(doc, "Localizaciones", locations.map(l =>
          `${l.name}${l.description ? `\n   ${stripMarkdown(l.description).slice(0, 150)}` : ""}`
        ).join("\n\n"));
      }

      // ── Facciones ─────────────────────────────────────────────────────────
      if (factions.length > 0) {
        addSection(doc, "Facciones", factions.map(f =>
          `${f.name}${f.alignment ? ` (${f.alignment})` : ""}` +
          (f.description ? `\n   ${stripMarkdown(f.description).slice(0, 150)}` : "")
        ).join("\n\n"));
      }

      // ── Issues abiertos (ordenados por severidad) ─────────────────────────
      if (sortedIssues.length > 0) {
        addSection(doc, "Issues abiertos", sortedIssues.map(i =>
          `[${i.severity.toUpperCase()}] ${i.description}`
        ).join("\n"));
      }

      // ── Pie de página con numeración en todas las páginas ─────────────────
      const campTotal = doc.bufferedPageRange().count;
      for (let p = 0; p < campTotal; p++) {
        doc.switchToPage(p);
        addFooter(doc, campaign.title, p + 1, campTotal);
      }
      doc.flushPages();
      doc.end();
    });
  });

  // ── Encuentro (placeholder) ───────────────────────────────────────────────
  server.get<{ Params: { id: string } }>("/encounter/:id", async (request, reply) => {
    const issue = await prisma.issue.findUnique({ where: { id: request.params.id } });
    if (!issue) throw AppError.notFound(ErrorCode.NOT_FOUND, "Encounter not found");

    const buffer = await generatePdf({
      title: `Encuentro — ${issue.type.replace(/_/g, " ")}`,
      subtitle: `Severidad: ${issue.severity}`,
      sections: [
        { heading: "Descripción", body: issue.description },
        ...(issue.resolution ? [{ heading: "Resolución", body: issue.resolution }] : []),
      ],
    });
    sendPdf(reply, buffer, `encounter-${issue.id}.pdf`);
  });
};
