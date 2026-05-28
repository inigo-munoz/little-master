export const ABILITIES = [
  { key: "strength", label: "FUE", full: "Fuerza" },
  { key: "dexterity", label: "DES", full: "Destreza" },
  { key: "constitution", label: "CON", full: "Constitución" },
  { key: "intelligence", label: "INT", full: "Inteligencia" },
  { key: "wisdom", label: "SAB", full: "Sabiduría" },
  { key: "charisma", label: "CAR", full: "Carisma" },
] as const;

export const SKILLS = [
  { key: "Acrobatics", label: "Acrobacias", ability: "dexterity" },
  { key: "AnimalHandling", label: "Trato con animales", ability: "wisdom" },
  { key: "Arcana", label: "Arcanos", ability: "intelligence" },
  { key: "Athletics", label: "Atletismo", ability: "strength" },
  { key: "Deception", label: "Engaño", ability: "charisma" },
  { key: "History", label: "Historia", ability: "intelligence" },
  { key: "Insight", label: "Perspicacia", ability: "wisdom" },
  { key: "Intimidation", label: "Intimidación", ability: "charisma" },
  { key: "Investigation", label: "Investigación", ability: "intelligence" },
  { key: "Medicine", label: "Medicina", ability: "wisdom" },
  { key: "Nature", label: "Naturaleza", ability: "intelligence" },
  { key: "Perception", label: "Percepción", ability: "wisdom" },
  { key: "Performance", label: "Actuación", ability: "charisma" },
  { key: "Persuasion", label: "Persuasión", ability: "charisma" },
  { key: "Religion", label: "Religión", ability: "intelligence" },
  { key: "SleightOfHand", label: "Juego de manos", ability: "dexterity" },
  { key: "Stealth", label: "Sigilo", ability: "dexterity" },
  { key: "Survival", label: "Supervivencia", ability: "wisdom" },
] as const;

export type SlotEntry = { max: number; used: number };

export function parseSlotData(raw: string): Record<string, SlotEntry> {
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(raw); } catch { /* ok */ }
  const result: Record<string, SlotEntry> = {};
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val === "number") {
      result[key] = { max: val, used: 0 };
    } else if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      result[key] = {
        max:  typeof obj.max  === "number" ? obj.max  : 0,
        used: typeof obj.used === "number" ? obj.used : 0,
      };
    }
  }
  return result;
}

export function weaponOptionLabel(d: { label: string; ability: string; properties?: string }): string {
  const tags: string[] = [];
  if (d.properties?.includes("Ligera")) tags.push("Ligera");
  if (d.ability === "finesse") tags.push("Sutil");
  return tags.length > 0 ? `${d.label}  ·  ${tags.join(" · ")}` : d.label;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CharacterForm = Record<string, any>;

export interface CharacterFormProps {
  form: CharacterForm;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (key: string, value: any) => void;
}
