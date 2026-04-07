const NAME_PREFIXES = /^(NPC:|NPC\s+|Personaje:|Personaje\s+|Character:|Character\s+|Personaggio:)/i;

/**
 * Líneas que se eliminan al extraer la descripción narrativa:
 * - Tags entre corchetes del Designer: [AI GENERATED...], [Potential conflicts...], [Suggested tags...]
 * - Campos de metadatos inline: **Raza:** Humano
 * - Cabeceras de sección standalone: **Historia:** (sin valor a continuación)
 * - Headings markdown: ## Sección
 */
function isNonNarrativeLine(line: string): boolean {
  const t = line.trim();
  if (t === "") return false; // Las líneas vacías las gestiona el colapsado posterior
  if (/^\[.+\]$/.test(t)) return true;                  // [AI GENERATED...], [Potential conflicts...], etc.
  if (/^\*\*[^*\n]+:\*\*\s+\S/.test(t)) return true;   // **Raza:** Humano  (campo con valor inline)
  if (/^\*\*[^*\n]+:\*\*\s*$/.test(t)) return true;    // **Historia:**     (cabecera standalone)
  if (/^#{1,3}\s/.test(t)) return true;                 // ## Sección
  return false;
}

function cleanName(raw: string): string {
  return raw.replace(NAME_PREFIXES, "").trim();
}

function extractDescription(content: string, nameLine: string): string {
  return content
    .split("\n")
    .filter((line) => {
      if (line.trim() === nameLine.trim()) return false; // Elimina la línea del nombre
      return !isNonNarrativeLine(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // Colapsa más de dos líneas en blanco consecutivas
    .trim();
}

export function parseNpcFromResponse(content: string): { name: string; description: string } | null {
  const boldMatch = content.match(/^\*\*([^*\n]{2,80})\*\*/m);
  const headingMatch = content.match(/^#{1,3}\s+(.{2,80})$/m);
  const match = boldMatch ?? headingMatch;
  if (!match || content.length < 100) return null;

  const name = cleanName((match[1] ?? "").trim());
  const description = extractDescription(content, match[0]);

  return { name, description };
}
