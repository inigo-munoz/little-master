import {
  HIT_DIE_BY_CLASS,
  ARMOR_LIST,
  INITIATIVE_BONUS_BY_FEAT,
  SPEED_BONUS_BY_FEAT,
  baseSpeedForSpecies,
  FULL_CASTER_CLASSES,
  HALF_CASTER_CLASSES,
  PACT_MAGIC_CLASS,
  THIRD_CASTER_SUBCLASSES,
  FULL_CASTER_SLOTS,
  CLASS_SKILL_SLOTS,
  MULTICLASS_SKILL_SLOTS,
  SPECIES_SKILL_CHOICE_SLOTS,
  type ArmorKey,
} from "./dnd-2024-data";
import { abilityModifier } from "@dnd/domain";

export { abilityModifier };

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

export interface WeaponEntry {
  id: string;
  weaponKey: string;         // clave en WEAPON_LIST, "" = personalizada
  customName: string;        // nombre propio opcional
  ability: "strength" | "dexterity";  // característica elegida (finesse → el jugador elige)
  magical: boolean;
  magicBonus: number;        // +0/+1/+2/+3
  extraDamage: boolean;
  extraDamageDesc: string;
}

export interface FeatEntry {
  name: string;
  classIndex: number;
  level: number;
  statBonuses: FeatStatBonus[];
}

// ─── Funciones existentes (sin cambios) ───────────────────────────────────────

/**
 * Formats an ability modifier for display: "+2", "-1", "+0".
 * Single source of truth for the "modStr"-style helpers scattered across
 * DetailModal, encounter page and npcs page.
 */
export function formatModifier(score: number): string {
  const m = abilityModifier(score);
  return m >= 0 ? `+${m}` : `${m}`;
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

// ─── Sprint B: iniciativa y velocidad calculadas ──────────────────────────────

export function initiativeBonusFromFeats(feats: FeatEntry[]): number {
  return feats.reduce((sum, feat) => sum + (INITIATIVE_BONUS_BY_FEAT[feat.name] ?? 0), 0);
}

export function calcInitiative(dexScore: number, feats: FeatEntry[]): number {
  return abilityModifier(dexScore) + initiativeBonusFromFeats(feats);
}

export function speedBonusFromClasses(classes: PlayerClassEntry[]): number {
  return classes.reduce((sum, cls) => {
    if (cls.class === "Monje"    && cls.level >= 2) return sum + 10;
    if (cls.class === "Bárbaro" && cls.level >= 5) return sum + 10;
    return sum;
  }, 0);
}

export function speedBonusFromFeats(feats: FeatEntry[]): number {
  return feats.reduce((sum, feat) => sum + (SPEED_BONUS_BY_FEAT[feat.name] ?? 0), 0);
}

export function calcSpeed(
  species: string,
  classes: PlayerClassEntry[],
  feats: FeatEntry[]
): number {
  return baseSpeedForSpecies(species) + speedBonusFromClasses(classes) + speedBonusFromFeats(feats);
}

// ─── Hechizos ─────────────────────────────────────────────────────────────────

export interface SpellEntry {
  id: string;
  name: string;
  level: number;          // 0 = truco
  concentration: boolean;
  ritual: boolean;
}

// Calcula los espacios de hechizo sugeridos para un personaje dado sus clases.
// Devuelve un Record<nivel_hechizo, número_de_espacios> para niveles 1–9.
// Los espacios de Magia de Pacto (Brujo) se calculan por separado con WARLOCK_PACT_MAGIC.
export function calcSuggestedSpellSlots(classes: PlayerClassEntry[]): Record<number, number> {
  let effectiveLevel = 0;
  for (const cls of classes) {
    if (cls.class === PACT_MAGIC_CLASS) continue;
    if (FULL_CASTER_CLASSES.has(cls.class)) {
      effectiveLevel += cls.level;
    } else if (HALF_CASTER_CLASSES.has(cls.class)) {
      effectiveLevel += Math.floor(cls.level / 2);
    } else {
      const thirdSub = THIRD_CASTER_SUBCLASSES[cls.class];
      if (thirdSub !== undefined && cls.subclass === thirdSub) {
        effectiveLevel += Math.floor(cls.level / 3);
      }
    }
  }
  effectiveLevel = Math.max(0, Math.min(20, effectiveLevel));
  if (effectiveLevel === 0) return {};
  const row = FULL_CASTER_SLOTS[effectiveLevel - 1];
  if (!row) return {};
  const result: Record<number, number> = {};
  row.forEach((count, idx) => { if (count > 0) result[idx + 1] = count; });
  return result;
}

// ─── Slots de maestría (expertise) según clases y niveles (PHB 2024) ──────────
// Bardo nv.2: +2 · Pícaro nv.1: +2 · Pícaro nv.6: +2 adicionales
export function expertiseSlotsFromClasses(classes: PlayerClassEntry[]): number {
  let slots = 0;
  for (const cls of classes) {
    if (cls.class === "Pícaro") {
      if (cls.level >= 1) slots += 2;
      if (cls.level >= 6) slots += 2;
    }
    if (cls.class === "Bardo") {
      if (cls.level >= 2) slots += 2;
    }
  }
  return slots;
}

// Slots de maestría otorgados por dotes (Skill Expert: +1 por dote)
export function expertiseSlotsFromFeats(feats: FeatEntry[]): number {
  return feats.filter(f => f.name === "Skill Expert").length;
}

// Slots de competencia en habilidades según clase, multiclase, nivel y dotes (PHB 2024)
export function skillProficiencySlots(
  classes: PlayerClassEntry[],
  feats: FeatEntry[],
  species: string,
): number {
  if (classes.length === 0) return 0;

  const firstClass = classes[0];
  let total = (firstClass ? CLASS_SKILL_SLOTS[firstClass.class] : undefined) ?? 2;

  for (let i = 1; i < classes.length; i++) {
    const cls = classes[i];
    if (cls) total += MULTICLASS_SKILL_SLOTS[cls.class] ?? 0;
  }

  // Bárbaro nv.3: Primal Knowledge (+1 habilidad)
  for (const cls of classes) {
    if (cls.class === "Bárbaro" && cls.level >= 3) total += 1;
  }

  // Dotes que otorgan competencias en habilidades
  total += feats.filter(f => f.name === "Skilled").length * 3;
  total += feats.filter(f => f.name === "Skill Expert").length;

  // Especie con slots de elección (Humano: 1)
  total += SPECIES_SKILL_CHOICE_SLOTS[species] ?? 0;

  return total;
}
