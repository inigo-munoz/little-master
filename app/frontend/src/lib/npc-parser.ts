const NAME_PREFIXES = /^(NPC:|NPC\s+|Personaje:|Personaje\s+|Character:|Character\s+|Personaggio:|Nombre:\s*)/i;

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

// Campos típicos de NPC que indican que la línea anterior es el nombre
const NPC_FIELD_RE = /^(\*\*)?(Rol|Role|Raza|Race|Clase|Class|Estado|Apariencia|Personalidad|Motivaci[oó]n|Secreto|Ganchos)/i;

export function parseNpcFromResponse(content: string): { name: string; description: string } | null {
  if (content.length < 100) return null;

  let rawName: string | null = null;
  let matchedLine: string | null = null;

  // 1. ## heading — formato preferido según el system prompt
  const headingMatch = content.match(/^#{1,3}\s+(.{2,80})$/m);
  if (headingMatch?.[1]) {
    rawName = headingMatch[1];
    matchedLine = headingMatch[0];
  }

  // 2. **Nombre:** X — campo nombre en negrita (ej. "**Nombre:** Elara")
  if (!rawName) {
    const boldNombreMatch = content.match(/^\*\*Nombre:\*\*\s+(.{2,80})$/im);
    if (boldNombreMatch?.[1]) {
      rawName = boldNombreMatch[1];
      matchedLine = boldNombreMatch[0];
    }
  }

  // 3. **bold name** al inicio de cualquier línea (nombre directo en negrita)
  if (!rawName) {
    const boldMatch = content.match(/^\*\*([^*\n]{2,80})\*\*/m);
    if (boldMatch?.[1]) {
      const candidate = cleanName(boldMatch[1].trim());
      if (candidate.length >= 2) {
        rawName = boldMatch[1];
        matchedLine = boldMatch[0];
      }
    }
  }

  // 4. "Nombre: X" — campo de nombre en texto plano
  if (!rawName) {
    const nombreMatch = content.match(/^Nombre:\s+(.{2,80})$/im);
    if (nombreMatch?.[1]) {
      rawName = nombreMatch[1];
      matchedLine = nombreMatch[0];
    }
  }

  // 5. Primera línea no vacía seguida de campos NPC estructurados (ej. "Elara\n\nRol: ...")
  if (!rawName) {
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] ?? "";
    const secondLine = lines[1] ?? "";
    if (
      firstLine.length >= 2 &&
      firstLine.length <= 80 &&
      !firstLine.startsWith("[") &&
      !firstLine.startsWith("#") &&
      NPC_FIELD_RE.test(secondLine)
    ) {
      rawName = firstLine;
      matchedLine = firstLine;
    }
  }

  if (!rawName || !matchedLine) return null;

  const name = cleanName(rawName.trim());
  const description = extractDescription(content, matchedLine);

  return { name, description };
}
