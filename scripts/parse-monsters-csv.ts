import fs from "node:fs";
import path from "node:path";

// ── CSV Parsing ────────────────────────────────────────────────────────────

/**
 * Parse an entire CSV string into rows, handling:
 * - Quoted fields with commas inside
 * - Escaped quotes ("" inside quoted fields)
 * - Multiline values within quoted fields
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else if (ch === "\n" || ch === "\r") {
        // Skip \r in \r\n
        if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
          i++;
        }
        fields.push(current.trim());
        rows.push(fields);
        fields = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }

  // Handle last row (if file doesn't end with newline)
  if (current || fields.length > 0) {
    fields.push(current.trim());
    rows.push(fields);
  }

  return rows;
}

// ── Column indices (from actual CSV header row) ────────────────────────────

const COL = {
  NAME: 0,
  SOURCE: 1,
  SIZE: 2,
  TYPE: 3,
  ALIGNMENT: 4,
  AC: 9,
  HP: 10,
  WALK: 12,
  BURROW: 13,
  CLIMB: 14,
  FLY: 15,
  HOVER: 16,
  SWIM: 17,
  STR_MOD: 18,
  INT_MOD: 19,
  DEX_MOD: 20,
  WIS_MOD: 21,
  CON_MOD: 22,
  CHA_MOD: 23,
  STR_SAVE: 24,
  INT_SAVE: 25,
  DEX_SAVE: 26,
  WIS_SAVE: 27,
  CON_SAVE: 28,
  CHA_SAVE: 29,
  PROFICIENT: 30,
  EXPERTISE: 31,
  VULNERABILITIES: 32,
  RESISTANCES: 33,
  IMMUNITIES_CONDITIONS: 34,
  IMMUNITIES_DAMAGE: 35,
  BLINDSIGHT: 36,
  DARKVISION: 37,
  TRUESIGHT: 38,
  TREMORSENSE: 39,
  PASSIVE_PERCEPTION: 40,
  LANGUAGES: 41,
  CR: 42,
  XP: 43,
  PB: 44,
  TRAITS: 45,
  LEGENDARY_RESISTANCE_COUNT: 46,
  NUM_ATK: 47,
  // Attacks: 4 blocks of 7 columns starting at 48
  ATK_BASE: 48,
  SAVE_DC: 76,
  SAVING_THROW: 77,
  ACTION_NOTES: 78,
  ABILITY: 79,
  SPELL_SAVE_DC: 80,
  SPELL_SAVING_THROWS: 81,
  SPELL_ATTACK: 82,
  AT_WILL: 83,
  THREE_DAY: 84,
  TWO_DAY: 85,
  ONE_DAY: 86,
  BONUS_ACTION: 87,
  REACTION: 88,
  LEGENDARY_AMOUNT: 89,
  LEGENDARY_ACTION_SAVE_DC: 90,
  LEGENDARY_ACTION_SAVING_THROW: 91,
  LEGENDARY_ACTIONS: 92,
  LAIR: 93,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function num(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function feetToMeters(feet: number): number {
  return Math.round(feet * 0.3);
}

function modToScore(mod: number): number {
  return mod * 2 + 10;
}

function formatSign(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Convert CR string to a numeric value for sorting. */
function crToNumeric(cr: string): number {
  if (cr.includes("/")) {
    const [num, den] = cr.split("/");
    return Number(num) / Number(den);
  }
  return Number(cr) || 0;
}

// ── Speed formatting ───────────────────────────────────────────────────────

function formatSpeed(row: string[]): string {
  const parts: string[] = [];
  const walk = num(row[COL.WALK]);
  if (walk) parts.push(`${feetToMeters(walk)} m`);

  const burrow = num(row[COL.BURROW]);
  if (burrow) parts.push(`excavar ${feetToMeters(burrow)} m`);

  const climb = num(row[COL.CLIMB]);
  if (climb) parts.push(`trepar ${feetToMeters(climb)} m`);

  const fly = num(row[COL.FLY]);
  if (fly) {
    const hover = row[COL.HOVER]?.toLowerCase();
    const hoverSuffix = hover === "true" || hover === "yes" ? " (flotación)" : "";
    parts.push(`vuelo ${feetToMeters(fly)} m${hoverSuffix}`);
  }

  const swim = num(row[COL.SWIM]);
  if (swim) parts.push(`nadar ${feetToMeters(swim)} m`);

  return parts.join(", ") || "0 m";
}

// ── Saving Throws ──────────────────────────────────────────────────────────

const SAVE_LABELS: [string, number, number][] = [
  ["FUE", COL.STR_SAVE, COL.STR_MOD],
  ["DES", COL.DEX_SAVE, COL.DEX_MOD],
  ["CON", COL.CON_SAVE, COL.CON_MOD],
  ["INT", COL.INT_SAVE, COL.INT_MOD],
  ["SAB", COL.WIS_SAVE, COL.WIS_MOD],
  ["CAR", COL.CHA_SAVE, COL.CHA_MOD],
];

function formatSavingThrows(row: string[]): string {
  const proficient: string[] = [];
  for (const [label, saveIdx, modIdx] of SAVE_LABELS) {
    const saveVal = row[saveIdx];
    const modVal = row[modIdx];
    if (saveVal === "" || saveVal === undefined) continue;
    const save = num(saveVal);
    const mod = num(modVal);
    if (save !== mod) {
      proficient.push(`${label} ${formatSign(save)}`);
    }
  }
  return proficient.join(", ");
}

// ── Senses ─────────────────────────────────────────────────────────────────

const SENSE_MAP: [number, string][] = [
  [COL.BLINDSIGHT, "vista ciega"],
  [COL.DARKVISION, "visión en la oscuridad"],
  [COL.TRUESIGHT, "vista verdadera"],
  [COL.TREMORSENSE, "sentido del temblor"],
];

function formatSenses(row: string[]): string {
  const parts: string[] = [];
  for (const [idx, label] of SENSE_MAP) {
    const feet = num(row[idx]);
    if (feet > 0) {
      parts.push(`${label} ${feetToMeters(feet)} m`);
    }
  }
  return parts.join(", ");
}

// ── Actions ────────────────────────────────────────────────────────────────

interface Action {
  name: string;
  description: string;
}

function buildActions(row: string[]): Action[] {
  const actions: Action[] = [];
  const numAtk = num(row[COL.NUM_ATK]);

  // Multiattack
  if (numAtk > 1) {
    actions.push({
      name: "Multiataque",
      description: `El monstruo realiza ${numAtk} ataques.`,
    });
  }

  // Individual attacks (up to 4)
  for (let i = 0; i < 4; i++) {
    const base = COL.ATK_BASE + i * 7;
    const atkType = row[base] || "";
    const atkMod = row[base + 1] || "";
    const atkRange = row[base + 2] || "";
    const atkRangeShort = row[base + 3] || "";
    const atkRangeLong = row[base + 4] || "";
    const atkDam = row[base + 5] || "";
    const atkDamType = row[base + 6] || "";

    if (!atkType && !atkMod) continue;

    const typeLower = atkType.toLowerCase();
    const isMelee = typeLower === "melee";
    const isRanged = typeLower.includes("range");

    let desc: string;
    if (isMelee) {
      const reach = num(atkRange);
      desc = `Ataque cuerpo a cuerpo: ${formatSign(num(atkMod))}, alcance ${feetToMeters(reach)} m. Daño: ${atkDam} ${atkDamType}.`;
    } else if (isRanged) {
      const short = num(atkRangeShort || atkRange);
      const long = num(atkRangeLong);
      const rangePart =
        long > 0
          ? `${feetToMeters(short)}/${feetToMeters(long)} m`
          : `${feetToMeters(short)} m`;
      desc = `Ataque a distancia: ${formatSign(num(atkMod))}, alcance ${rangePart}. Daño: ${atkDam} ${atkDamType}.`;
    } else {
      // AOE or other special type
      const range = num(atkRangeShort || atkRange);
      desc = `${atkType}: ${formatSign(num(atkMod))}, ${feetToMeters(range)} m. Daño: ${atkDam} ${atkDamType}.`;
    }

    actions.push({
      name: `Ataque ${i + 1}`,
      description: desc,
    });
  }

  // Save-based action
  const saveDC = row[COL.SAVE_DC];
  const savingThrow = row[COL.SAVING_THROW];
  if (saveDC && num(saveDC) > 0) {
    const saveDesc = `CD ${saveDC} de ${savingThrow || "salvación"}.`;
    actions.push({ name: "Salvación", description: saveDesc });
  }

  // Action notes
  const actionNotes = row[COL.ACTION_NOTES];
  if (actionNotes) {
    actions.push({ name: "Notas", description: actionNotes });
  }

  return actions;
}

// ── Spellcasting ───────────────────────────────────────────────────────────

function formatSpellcasting(row: string[]): string | null {
  const ability = row[COL.ABILITY];
  if (!ability) return null;

  const dc = row[COL.SPELL_SAVE_DC] || "";
  const atkMod = row[COL.SPELL_ATTACK] || "";
  const atWill = row[COL.AT_WILL] || "";
  const threeDay = row[COL.THREE_DAY] || "";
  const twoDay = row[COL.TWO_DAY] || "";
  const oneDay = row[COL.ONE_DAY] || "";

  const parts: string[] = [`Lanzamiento de conjuros (${ability})`];
  if (dc) parts.push(`CD ${dc}`);
  if (atkMod) parts.push(`ataque ${formatSign(num(atkMod))}`);

  let result = parts.join(". ") + ".";

  const tiers: [string, string][] = [
    ["A voluntad", atWill],
    ["3/día", threeDay],
    ["2/día", twoDay],
    ["1/día", oneDay],
  ];

  for (const [label, spells] of tiers) {
    if (spells) {
      result += ` ${label}: ${spells}.`;
    }
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────────────────

interface Monster {
  name: string;
  source: string;
  size: string;
  type: string;
  alignment: string;
  cr: string;
  xp: number;
  pb: number;
  ac: number;
  hp: number;
  speed: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  savingThrows: string;
  skills: string;
  vulnerabilities: string;
  resistances: string;
  conditionImmunities: string;
  damageImmunities: string;
  senses: string;
  passivePerception: number;
  languages: string;
  traits: string;
  legendaryResistances: number;
  actions: Action[];
  spellcasting: string | null;
  bonusAction: string;
  reaction: string;
  legendaryActions: string;
  lair: boolean;
}

const CSV_PATH = "/home/inigo/Downloads/Dungeon and Dragons 2024 Monster Stats - All.csv";
const OUT_PATH = path.resolve(
  __dirname,
  "../app/frontend/src/lib/monster-data.json"
);

const raw = fs.readFileSync(CSV_PATH, "utf-8");
const allRows = parseCsv(raw);

// Skip row 0 (category headers) and row 1 (column headers)
const dataRows = allRows.slice(2);

const monsters: Monster[] = [];

for (const row of dataRows) {
  const name = (row[COL.NAME] || "").trim();
  if (!name) continue;

  const strMod = num(row[COL.STR_MOD]);
  const dexMod = num(row[COL.DEX_MOD]);
  const conMod = num(row[COL.CON_MOD]);
  const intMod = num(row[COL.INT_MOD]);
  const wisMod = num(row[COL.WIS_MOD]);
  const chaMod = num(row[COL.CHA_MOD]);

  const monster: Monster = {
    name,
    source: row[COL.SOURCE] || "",
    size: row[COL.SIZE] || "",
    type: row[COL.TYPE] || "",
    alignment: row[COL.ALIGNMENT] || "",
    cr: row[COL.CR] || "0",
    xp: num(row[COL.XP]),
    pb: num(row[COL.PB]),
    ac: num(row[COL.AC]),
    hp: num(row[COL.HP]),
    speed: formatSpeed(row),
    str: modToScore(strMod),
    dex: modToScore(dexMod),
    con: modToScore(conMod),
    int: modToScore(intMod),
    wis: modToScore(wisMod),
    cha: modToScore(chaMod),
    savingThrows: formatSavingThrows(row),
    skills: row[COL.PROFICIENT] || "",
    vulnerabilities: row[COL.VULNERABILITIES] || "",
    resistances: row[COL.RESISTANCES] || "",
    conditionImmunities: row[COL.IMMUNITIES_CONDITIONS] || "",
    damageImmunities: row[COL.IMMUNITIES_DAMAGE] || "",
    senses: formatSenses(row),
    passivePerception: num(row[COL.PASSIVE_PERCEPTION]),
    languages: row[COL.LANGUAGES] || "",
    traits: row[COL.TRAITS] || "",
    legendaryResistances: num(row[COL.LEGENDARY_RESISTANCE_COUNT]),
    actions: buildActions(row),
    spellcasting: formatSpellcasting(row),
    bonusAction: row[COL.BONUS_ACTION] || "",
    reaction: row[COL.REACTION] || "",
    legendaryActions: row[COL.LEGENDARY_ACTIONS] || "",
    lair: (row[COL.LAIR] || "").toLowerCase() === "yes",
  };

  monsters.push(monster);
}

// Sort by CR (numerically), then by name alphabetically
monsters.sort((a, b) => {
  const crDiff = crToNumeric(a.cr) - crToNumeric(b.cr);
  if (crDiff !== 0) return crDiff;
  return a.name.localeCompare(b.name);
});

// Write output
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(monsters, null, 2), "utf-8");

const stat = fs.statSync(OUT_PATH);
console.log(`Monstruos parseados: ${monsters.length}`);
console.log(`Archivo generado: ${OUT_PATH}`);
console.log(`Tamaño: ${(stat.size / 1024).toFixed(1)} KB`);
