// Builds the SRD 5.2.1 English spell descriptions markdown from the raw
// PDF-extracted plaintext (06_Trasfondos_y_Equipo.txt). The output layout
// must match the English branch of parseSpellDocument in routes/spells.ts.

export interface ParsedSpell {
  name: string;
  level: number; // 0 = cantrip
  school: string;
  classes: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  higherLevel: string | null;
  cantripUpgrade: string | null;
}

const SECTION_START = "Spell Descriptions";
const SECTION_END = "Rules Glossary";
// PDF pagination noise: bare page numbers and the repeated document footer.
const NOISE_RE = /^(\d{1,4}|System Reference Document 5\.2\.1)$/;
// "Level 2 Evocation (Wizard)" | "Evocation Cantrip (Sorcerer, Wizard)"
const TYPE_RE =
  /^(?:Level (\d+) ([A-Za-z]+)|([A-Za-z]+) Cantrip)\s*\(([^)]+)\)$/;
const FIELD_RE = /^(Casting Time|Range|Components|Duration):\s*(.*)$/;
const HIGHER_MARKER = "Using a Higher-Level Spell Slot.";
const CANTRIP_MARKER = "Cantrip Upgrade.";

// Long class lists sometimes wrap the closing paren onto the next line,
// e.g. "Level 5 Abjuration (Bard, Cleric, Druid, Paladin," / "Ranger)".
// TYPE_RE never matches either fragment on its own, so the whole spell
// block would otherwise be silently skipped as "corrupted".
const TYPE_OPEN_RE = /^(?:Level \d+ [A-Za-z]+|[A-Za-z]+ Cantrip)\s*\([^)]*$/;

function mergeWrappedTypeLines(lines: string[]): string[] {
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (TYPE_OPEN_RE.test(line)) {
      let j = i + 1;
      while (j < lines.length && lines[j] === "") j++;
      const closing = lines[j];
      if (closing !== undefined && /^[^(]*\)$/.test(closing)) {
        const combined = `${line} ${closing}`;
        if (TYPE_RE.test(combined)) {
          merged.push(combined);
          i = j;
          continue;
        }
      }
    }
    merged.push(line);
  }
  return merged;
}

export function extractSpellSection(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const start = lines.indexOf(SECTION_START);
  const end = lines.indexOf(SECTION_END);
  const section = lines.slice(
    start + 1,
    end === -1 ? undefined : end
  );
  const withoutNoise = section.filter((l) => !NOISE_RE.test(l));
  return mergeWrappedTypeLines(withoutNoise);
}

export function parseSpells(lines: string[]): ParsedSpell[] {
  // Locate every type line; the spell name is the nearest non-empty line
  // above it, and each spell's body runs until the next spell's name line.
  const typeIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (TYPE_RE.test(lines[i]!)) typeIdx.push(i);
  }

  const nameIdx = typeIdx.map((t) => {
    for (let i = t - 1; i >= 0; i--) {
      if (lines[i] !== "") return i;
    }
    return -1;
  });

  const spells: ParsedSpell[] = [];
  for (let k = 0; k < typeIdx.length; k++) {
    const t = typeIdx[k]!;
    if (nameIdx[k]! < 0) continue;
    const name = lines[nameIdx[k]!]!;
    const m = lines[t]!.match(TYPE_RE)!;
    const level = m[1] ? Number(m[1]) : 0;
    const school = (m[2] ?? m[3])!;
    const classes = m[4]!;

    // Consume the four stat fields; non-field lines while fields are open
    // are wrapped continuations of the previous field's value.
    const fields: Record<string, string> = {};
    let current: string | null = null;
    let bodyStart = t + 1;
    for (let i = t + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line === "") {
        if (fields["Duration"] !== undefined) {
          bodyStart = i + 1;
          break;
        }
        continue;
      }
      const f = line.match(FIELD_RE);
      if (f) {
        current = f[1]!;
        fields[current] = f[2]!;
      } else if (current && fields["Duration"] === undefined) {
        fields[current] += ` ${line}`;
      } else {
        bodyStart = i;
        break;
      }
    }
    if (fields["Duration"] === undefined) continue; // corrupted block, skip

    const bodyEnd = k + 1 < typeIdx.length ? nameIdx[k + 1]! : lines.length;
    const body = lines
      .slice(bodyStart, bodyEnd)
      .filter((l) => l !== "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    let description = body;
    let higherLevel: string | null = null;
    let cantripUpgrade: string | null = null;
    const hi = body.indexOf(HIGHER_MARKER);
    if (hi !== -1) {
      description = body.slice(0, hi).trim();
      higherLevel = body.slice(hi + HIGHER_MARKER.length).trim();
    }
    const ci = body.indexOf(CANTRIP_MARKER);
    if (ci !== -1) {
      description = body.slice(0, ci).trim();
      cantripUpgrade = body.slice(ci + CANTRIP_MARKER.length).trim();
    }

    spells.push({
      name,
      level,
      school,
      classes,
      castingTime: fields["Casting Time"] ?? "",
      range: fields["Range"] ?? "",
      components: fields["Components"] ?? "",
      duration: fields["Duration"] ?? "",
      description,
      higherLevel,
      cantripUpgrade,
    });
  }
  return spells;
}

export function formatSpell(s: ParsedSpell): string {
  const concentration = /concentration/i.test(s.duration);
  const ritual = /ritual/i.test(s.castingTime);
  let tag = "";
  if (concentration && ritual) tag = " [C/Ritual]";
  else if (concentration) tag = " [C]";
  else if (ritual) tag = " [Ritual]";

  const typeLine =
    s.level === 0
      ? `Cantrip, ${s.school} (${s.classes})${tag}`
      : `Level ${s.level}, ${s.school} (${s.classes})${tag}`;
  const statsLine = `Casting Time: ${s.castingTime} | Range: ${s.range} | Components: ${s.components} | Duration: ${s.duration}`;

  const parts = [`## ${s.name}`, typeLine, statsLine, s.description];
  if (s.higherLevel) parts.push(`*Higher Level:* ${s.higherLevel}`);
  if (s.cantripUpgrade) parts.push(`*Cantrip Upgrade:* ${s.cantripUpgrade}`);
  return parts.join("\n");
}

const HEADER = `# SRD 5.2.1 — Spell Descriptions

Source: System Reference Document 5.2.1 (CC-BY-4.0), Wizards of the Coast LLC
Type: srd | Authority: high | Version: 5.2.1

---
`;

export function buildSpellsMarkdown(raw: string): {
  markdown: string;
  count: number;
} {
  const spells = parseSpells(extractSpellSection(raw));
  const markdown = `${HEADER}\n${spells.map(formatSpell).join("\n\n\n")}\n`;
  return { markdown, count: spells.length };
}
