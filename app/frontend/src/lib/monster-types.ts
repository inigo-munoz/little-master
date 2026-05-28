export interface MonsterEntry {
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
  actions: { name: string; description: string }[];
  spellcasting: string | null;
  bonusAction: string;
  reaction: string;
  legendaryActions: string;
  lair: boolean;
}

export function crToNumber(cr: string): number {
  if (cr === "1/8") return 0.125;
  if (cr === "1/4") return 0.25;
  if (cr === "1/2") return 0.5;
  return parseFloat(cr) || 0;
}

export function formatCR(cr: string, xp: number): string {
  return `${cr} (${xp.toLocaleString("es-ES")} XP)`;
}
