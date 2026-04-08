/**
 * Parsers para localizaciones y facciones generadas por el modo Designer.
 * Reutiliza la misma lógica de limpieza que npc-parser.ts.
 */

function isNonNarrativeLine(line: string): boolean {
  const t = line.trim();
  if (t === "") return false;
  if (/^\[.+\]$/.test(t)) return true;               // [AI GENERATED...], [Potential conflicts...], etc.
  if (/^\*\*[^*\n]+:\*\*\s*$/.test(t)) return true;  // **Sección:** (cabecera standalone sin valor)
  if (/^#{1,3}\s/.test(t)) return true;               // ## Heading
  return false;
  // NOTA: Las líneas "**Campo:** Valor" con valor inline se conservan en la descripción.
}

function cleanDescription(content: string, headingLine: string): string {
  return content
    .split("\n")
    .filter((line) => {
      if (line.trim() === headingLine.trim()) return false;
      return !isNonNarrativeLine(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseEntityFromResponse(
  content: string,
  keywords: RegExp,
  minDescriptionLength: number
): { name: string; description: string } | null {
  if (!keywords.test(content)) return null;

  for (const line of content.split("\n")) {
    const t = line.trim();

    const headingMatch = t.match(/^#{1,3}\s+(.{2,80})$/);
    const headingName = headingMatch?.[1];
    if (headingName && keywords.test(headingName)) {
      const name = headingName.trim();
      const description = cleanDescription(content, line);
      if (description.length >= minDescriptionLength) return { name, description };
    }

    const boldMatch = t.match(/^\*\*([^*\n]{2,80})\*\*/);
    const boldName = boldMatch?.[1];
    if (boldName && keywords.test(boldName)) {
      const name = boldName.trim();
      const description = cleanDescription(content, line);
      if (description.length >= minDescriptionLength) return { name, description };
    }
  }

  return null;
}

const LOCATION_KEYWORDS = /Localización|Location|Lugar/i;
const FACTION_KEYWORDS = /Facción|Faction|Grupo|Organización/i;

export function parseLocationFromResponse(
  content: string
): { name: string; description: string } | null {
  return parseEntityFromResponse(content, LOCATION_KEYWORDS, 100);
}

export function parseFactionFromResponse(
  content: string
): { name: string; description: string } | null {
  return parseEntityFromResponse(content, FACTION_KEYWORDS, 100);
}

/**
 * Extrae nombre y descripción de cualquier entidad con heading ##,
 * sin requerir palabras clave específicas en el nombre.
 * Se usa cuando el tipo ya se conoce por contexto (entityHint).
 */
export function parseGenericEntityFromResponse(
  content: string
): { name: string; description: string } | null {
  const headingMatch = content.match(/^#{1,3}\s+(.{2,80})$/m);
  if (!headingMatch?.[1]) return null;
  const name = headingMatch[1].trim();
  const description = cleanDescription(content, headingMatch[0]);
  if (description.length < 50) return null;
  return { name, description };
}
