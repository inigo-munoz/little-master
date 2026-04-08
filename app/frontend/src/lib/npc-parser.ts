const NAME_PREFIXES = /^(NPC:|NPC\s+|Personaje:|Personaje\s+|Character:|Character\s+|Personaggio:|Nombre:\s*)/i;

// Palabras en el heading que indican claramente una localización (no un NPC)
const LOCATION_HEADING_RE =
  /\b(Santuario|Templo|Ciudad|Aldea|Mercado|Fortaleza|Torre|Bosque|Monta[ñn]a|R[íi]o|Mar|Puerto|Camino|Puente|Ruinas|Castillo|Taberna|Mazmorra|Dungeon|Castle|Inn|Forest|Mountain|Village|Town|City|Harbor)\b/i;

// Campos estructurados propios de localizaciones o facciones, nunca de NPCs
const NON_NPC_FIELD_RE = /^(?:\*\*)?(?:Tipo|Ambiente|Habitantes|Alineamiento|Disposici[oó]n)(?::\*\*|:)\s/im;

// Regex para la línea de rol (con o sin negrita)
const ROL_LINE_RE = /^(?:\*\*)?Rol(?:e)?(?::\*\*|:)\s+.+$/im;
const ROL_VALUE_RE = /^(?:\*\*)?Rol(?:e)?(?::\*\*|:)\s+(.+)$/im;

/**
 * Líneas que se eliminan al extraer la descripción narrativa:
 * - Tags entre corchetes del Designer: [AI GENERATED...], [Potential conflicts...], [Suggested tags...]
 * - Cabeceras de sección standalone: **Historia:** (sin valor a continuación)
 * - Headings markdown: ## Sección
 *
 * NOTA: Las líneas "**Campo:** Valor" con valor inline (Apariencia, Personalidad,
 * Motivación, etc.) NO se filtran — forman parte de la descripción del NPC.
 * Solo se excluye la línea de Rol, que se extrae por separado.
 */
function isNonNarrativeLine(line: string): boolean {
  const t = line.trim();
  if (t === "") return false; // Las líneas vacías las gestiona el colapsado posterior
  if (/^\[.+\]$/.test(t)) return true;               // [AI GENERATED...], [Potential conflicts...], etc.
  if (/^\*\*[^*\n]+:\*\*\s*$/.test(t)) return true;  // **Historia:**  (cabecera standalone sin valor)
  if (/^#{1,3}\s/.test(t)) return true;               // ## Sección
  return false;
}

function cleanName(raw: string): string {
  return raw.replace(NAME_PREFIXES, "").trim();
}

function extractRole(content: string): string {
  const match = content.match(ROL_VALUE_RE);
  return match?.[1]?.trim() ?? "";
}

function extractDescription(content: string, nameLine: string): string {
  const roleLine = content.match(ROL_LINE_RE)?.[0]?.trim() ?? null;

  return content
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (t === nameLine.trim()) return false;            // Elimina la línea del nombre
      if (roleLine && t === roleLine) return false;        // Elimina la línea del rol (se extrae por separado)
      return !isNonNarrativeLine(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // Colapsa más de dos líneas en blanco consecutivas
    .trim();
}

// Campos típicos de NPC que indican que la línea anterior es el nombre
const NPC_FIELD_RE = /^(\*\*)?(Rol|Role|Raza|Race|Clase|Class|Estado|Apariencia|Personalidad|Motivaci[oó]n|Secreto|Ganchos)/i;

// ─── Stat Block Parser ────────────────────────────────────────────────────────

export interface ParsedStatBlock {
  npcType?: "monster" | "player";
  armorClass?: number;
  hitPoints?: string;
  speed?: string;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  challengeRating?: string;
  savingThrows?: string;
  skills?: string;
  resistances?: string;
  immunities?: string;
  senses?: string;
  languages?: string;
  traits?: { name: string; description: string }[];
  actions?: { name: string; description: string }[];
  bonusActions?: { name: string; description: string }[];
  reactions?: { name: string; description: string }[];
  npcClass?: string;
  npcLevel?: number;
}

type RawEntry = string | { name: string; description?: string; type?: string; attackBonus?: number; damage?: string };

function normalizeStatEntry(entry: RawEntry): { name: string; description: string } {
  if (typeof entry === "string") return { name: entry, description: "" };
  let desc = entry.description ?? "";
  if (!desc && (entry.attackBonus != null || entry.damage != null)) {
    const parts: string[] = [];
    if (entry.damage) parts.push(`daño: ${entry.damage}`);
    if (entry.attackBonus != null) parts.push(`ataque: +${entry.attackBonus}`);
    desc = parts.join(", ");
  }
  return { name: entry.name, description: desc };
}

export function parseStatBlockFromResponse(content: string): ParsedStatBlock | null {
  const match = content.match(/STAT_BLOCK:\s*([\s\S]*?)\s*:END_STAT_BLOCK/);
  if (!match?.[1]) return null;
  try {
    const raw = JSON.parse(match[1].trim()) as any;
    return {
      ...raw,
      traits: (raw.traits as RawEntry[] | undefined)?.map(normalizeStatEntry),
      actions: (raw.actions as RawEntry[] | undefined)?.map(normalizeStatEntry),
      bonusActions: (raw.bonusActions as RawEntry[] | undefined)?.map(normalizeStatEntry),
      reactions: (raw.reactions as RawEntry[] | undefined)?.map(normalizeStatEntry),
    } as ParsedStatBlock;
  } catch {
    return null;
  }
}

export function parseNpcFromResponse(
  content: string
): { name: string; description: string; role: string } | null {
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

  // Rechaza headings que contienen palabras de localización conocidas
  if (LOCATION_HEADING_RE.test(name)) return null;
  // Rechaza contenido cuyo primer campo estructurado es de localización o facción
  if (NON_NPC_FIELD_RE.test(content)) return null;

  const role = extractRole(content);
  const description = extractDescription(content, matchedLine);

  return { name, description, role };
}
