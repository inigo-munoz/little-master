import PDFDocument from "pdfkit";

export interface PdfSection {
  heading: string;
  body: string;
}

export interface PdfContent {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
}

const FONT_NORMAL = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const MARGIN = 50;
const PAGE_WIDTH = 595 - MARGIN * 2; // A4
const PAGE_HEIGHT = 842; // A4

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")       // **bold**
    .replace(/\*([^*]+)\*/g, "$1")            // *italic*
    .replace(/^#+\s+/gm, "")                 // headings
    .replace(/^\s*[-*]\s+/gm, "• ")          // list items
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^>\s+/gm, "")                  // blockquotes
    .trim();
}

function addSection(doc: PDFKit.PDFDocument, heading: string, body: string): void {
  const cleanBody = stripMarkdown(body);
  if (!cleanBody.trim()) return;

  doc
    .font(FONT_BOLD)
    .fontSize(12)
    .fillColor("#c8a84b")
    .text(heading.toUpperCase(), { width: PAGE_WIDTH });

  doc.moveDown(0.3);

  doc
    .font(FONT_NORMAL)
    .fontSize(11)
    .fillColor("#d4d0c8")
    .text(cleanBody, { width: PAGE_WIDTH, lineGap: 3 });

  doc.moveDown(1);
  addSectionDivider(doc);
}

function addSectionDivider(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + PAGE_WIDTH, y)
    .lineWidth(0.3)
    .strokeColor("#333333")
    .stroke();
  doc.moveDown(0.6);
}

function addDivider(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + PAGE_WIDTH, y)
    .lineWidth(0.8)
    .strokeColor("#555555")
    .stroke();
  doc.moveDown(0.8);
}

function addFooter(
  doc: PDFKit.PDFDocument,
  docTitle: string,
  pageNum?: number,
  totalPages?: number
): void {
  const dateStr = new Date().toLocaleDateString("es-ES", {
    year: "numeric", month: "long", day: "numeric",
  });
  const footerY = PAGE_HEIGHT - MARGIN + 5;
  doc
    .moveTo(MARGIN, footerY - 8)
    .lineTo(MARGIN + PAGE_WIDTH, footerY - 8)
    .lineWidth(0.3)
    .strokeColor("#444444")
    .stroke();

  doc
    .font(FONT_NORMAL)
    .fontSize(8)
    .fillColor("#555555")
    .text(docTitle, MARGIN, footerY, { width: PAGE_WIDTH / 2, lineBreak: false });

  const rightText = pageNum !== undefined && totalPages !== undefined
    ? `Página ${pageNum} de ${totalPages}  ·  ${dateStr}`
    : dateStr;

  doc
    .font(FONT_NORMAL)
    .fontSize(8)
    .fillColor("#555555")
    .text(rightText, MARGIN + PAGE_WIDTH / 2, footerY, {
      width: PAGE_WIDTH / 2,
      align: "right",
      lineBreak: false,
    });
}

export function generatePdf(content: PdfContent): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: MARGIN + 20, left: MARGIN, right: MARGIN },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Título ────────────────────────────────────────────────────────────────
    doc
      .font(FONT_BOLD)
      .fontSize(20)
      .fillColor("#e8a820")
      .text(content.title, { width: PAGE_WIDTH });

    if (content.subtitle) {
      doc.moveDown(0.3);
      doc
        .font(FONT_NORMAL)
        .fontSize(14)
        .fillColor("#888888")
        .text(content.subtitle, { width: PAGE_WIDTH });
    }

    doc.moveDown(0.8);
    addDivider(doc);

    // ── Secciones ─────────────────────────────────────────────────────────────
    for (const section of content.sections) {
      addSection(doc, section.heading, section.body);
    }

    // ── Pie de página con numeración en todas las páginas ─────────────────────
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      addFooter(doc, content.title, i + 1, totalPages);
    }

    doc.flushPages();
    doc.end();
  });
}

// Re-exportamos utilidades para rutas que construyen PDFs más complejos
export {
  addSection,
  addSectionDivider,
  addDivider,
  addFooter,
  stripMarkdown,
  FONT_BOLD,
  FONT_NORMAL,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
};
