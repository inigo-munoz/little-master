import { HIT_DIE_BY_CLASS, ARMOR_LIST, type ArmorKey } from "./dnd-2024-data";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface PlayerClassEntry {
  class: string;
  level: number;
  subclass: string;
}

export interface HpRollEntry {
  level: number;
  value: number;
  rolled: boolean;
}

export interface FeatStatBonus {
  stat: "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
  value: number;
}

export interface FeatEntry {
  name: string;
  classIndex: number;
  level: number;
  statBonuses: FeatStatBonus[];
}

// ─── Funciones existentes (sin cambios) ───────────────────────────────────────

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export function calcPassivePerception(
  wisdomScore: number,
  level: number,
  hasProficiency: boolean,
  hasExpertise: boolean
): number {
  const wisMod = abilityModifier(wisdomScore);
  const pb = proficiencyBonus(level);
  const bonus = hasExpertise ? pb * 2 : hasProficiency ? pb : 0;
  return 10 + wisMod + bonus;
}

export function calcSpellSaveDC(abilityScore: number, level: number): number {
  return 8 + abilityModifier(abilityScore) + proficiencyBonus(level);
}

export function calcSpellAttackBonus(abilityScore: number, level: number): number {
  return abilityModifier(abilityScore) + proficiencyBonus(level);
}

export function calcHpMaxSuggestion(
  className: string,
  constitutionScore: number,
  level: number
): number | null {
  const hitDie = HIT_DIE_BY_CLASS[className];
  if (!hitDie) return null;
  const conMod = abilityModifier(constitutionScore);
  const level1Hp = Math.max(1, hitDie + conMod);
  const avgPerLevel = Math.floor(hitDie / 2) + 1;
  const additionalHp = (level - 1) * Math.max(1, avgPerLevel + conMod);
  return level1Hp + additionalHp;
}

// ─── Funciones nuevas Sprint A ────────────────────────────────────────────────

export function totalLevel(classes: PlayerClassEntry[]): number {
  return classes.reduce((sum, c) => sum + c.level, 0);
}

export function finalAbilityScore(
  baseStat: number,
  stat: string,
  feats: FeatEntry[],
): number {
  const bonus = feats.reduce((sum, feat) =>
    sum + feat.statBonuses
      .filter(b => b.stat === stat)
      .reduce((s, b) => s + b.value, 0),
    0
  );
  return Math.min(30, Math.max(1, baseStat + bonus));
}

export function calcHpMaxFromRolls(
  hpRolls: HpRollEntry[],
  classes: PlayerClassEntry[],
  conScore: number,
  useAverage: boolean
): number {
  if (classes.length === 0) return 0;

  const conMod = abilityModifier(conScore);

  const hitDicePerLevel: number[] = [];
  for (const cls of classes) {
    const hitDie = HIT_DIE_BY_CLASS[cls.class] ?? 8;
    for (let i = 0; i < cls.level; i++) hitDicePerLevel.push(hitDie);
  }

  let total = 0;

  for (let lvl = 1; lvl <= hitDicePerLevel.length; lvl++) {
    const hitDie = hitDicePerLevel[lvl - 1] ?? 8;

    if (lvl === 1) {
      total += Math.max(1, hitDie + conMod);
    } else if (useAverage) {
      const avg = Math.floor(hitDie / 2) + 1;
      total += Math.max(1, avg + conMod);
    } else {
      const roll = hpRolls.find(r => r.level === lvl);
      const rolledValue = roll?.value ?? (Math.floor(hitDie / 2) + 1);
      total += Math.max(1, rolledValue + conMod);
    }
  }

  return total;
}

export function calcAC(
  armorKey: string | null,
  dexScore: number,
  shieldEquipped: boolean,
  conScore?: number,
  wisScore?: number,
): number {
  const dexMod = abilityModifier(dexScore);
  const armor = armorKey ? ARMOR_LIST[armorKey as ArmorKey] : null;

  let base: number;

  if (!armor || armorKey === "none") {
    base = 10 + dexMod;
  } else if (armor.type === "light") {
    base = armor.baseAC + dexMod;
  } else if (armor.type === "medium") {
    const cap = armor.desMax ?? 2;
    base = armor.baseAC + Math.min(dexMod, cap);
  } else if (armor.type === "heavy") {
    base = armor.baseAC;
  } else if (armorKey === "unarmoredBarbarian" && conScore !== undefined) {
    base = 10 + dexMod + abilityModifier(conScore);
  } else if (armorKey === "unarmoredMonk" && wisScore !== undefined) {
    base = 10 + dexMod + abilityModifier(wisScore);
  } else {
    base = 10 + dexMod;
  }

  return base + (shieldEquipped ? 2 : 0);
}
