import { describe, it, expect } from "vitest";
import {
  abilityModifier,
  proficiencyBonus,
  calcPassivePerception,
  calcSpellSaveDC,
  calcSpellAttackBonus,
  calcHpMaxSuggestion,
  totalLevel,
  finalAbilityScore,
  calcHpMaxFromRolls,
  calcAC,
  initiativeBonusFromFeats,
  calcInitiative,
  speedBonusFromClasses,
  speedBonusFromFeats,
  calcSpeed,
  expertiseSlotsFromClasses,
  expertiseSlotsFromFeats,
  calcSuggestedSpellSlots,
  skillProficiencySlots,
} from "./player-calcs";

describe("abilityModifier", () => {
  it("score 10 → 0",  () => expect(abilityModifier(10)).toBe(0));
  it("score 11 → 0",  () => expect(abilityModifier(11)).toBe(0));
  it("score 8  → -1", () => expect(abilityModifier(8)).toBe(-1));
  it("score 9  → -1", () => expect(abilityModifier(9)).toBe(-1));
  it("score 14 → +2", () => expect(abilityModifier(14)).toBe(2));
  it("score 15 → +2", () => expect(abilityModifier(15)).toBe(2));
  it("score 20 → +5", () => expect(abilityModifier(20)).toBe(5));
  it("score 1  → -5", () => expect(abilityModifier(1)).toBe(-5));
  it("score 30 → +10",() => expect(abilityModifier(30)).toBe(10));
});

describe("proficiencyBonus", () => {
  it.each([
    [1, 2], [4, 2],
    [5, 3], [8, 3],
    [9, 4], [12, 4],
    [13, 5], [16, 5],
    [17, 6], [20, 6],
  ])("nivel %i → +%i", (level, expected) =>
    expect(proficiencyBonus(level)).toBe(expected)
  );
});

describe("calcPassivePerception", () => {
  it("WIS 10, nivel 1, sin prof → 10", () =>
    expect(calcPassivePerception(10, 1, false, false)).toBe(10));

  it("WIS 14 (+2), nivel 1, sin prof → 12", () =>
    expect(calcPassivePerception(14, 1, false, false)).toBe(12));

  it("WIS 10, nivel 1, con prof (pb=2) → 12", () =>
    expect(calcPassivePerception(10, 1, true, false)).toBe(12));

  it("WIS 10, nivel 5, con expertise (pb=3, ×2=6) → 16", () =>
    expect(calcPassivePerception(10, 5, true, true)).toBe(16));

  it("WIS 8 (-1), nivel 1, sin prof → 9", () =>
    expect(calcPassivePerception(8, 1, false, false)).toBe(9));

  it("expertise prevalece — WIS 10, nivel 1, expertise → 14", () =>
    expect(calcPassivePerception(10, 1, true, true)).toBe(14)); // 10 + 2×2
});

describe("calcSpellSaveDC", () => {
  it("INT 16 (+3), nivel 5 (pb=3) → DC 14", () =>
    expect(calcSpellSaveDC(16, 5)).toBe(14)); // 8+3+3

  it("SAB 10 (+0), nivel 1 (pb=2) → DC 10", () =>
    expect(calcSpellSaveDC(10, 1)).toBe(10)); // 8+0+2

  it("CAR 20 (+5), nivel 17 (pb=6) → DC 19", () =>
    expect(calcSpellSaveDC(20, 17)).toBe(19)); // 8+5+6
});

describe("calcSpellAttackBonus", () => {
  it("INT 16 (+3), nivel 5 (pb=3) → +6", () =>
    expect(calcSpellAttackBonus(16, 5)).toBe(6));

  it("SAB 10 (+0), nivel 1 (pb=2) → +2", () =>
    expect(calcSpellAttackBonus(10, 1)).toBe(2));

  it("CAR 20 (+5), nivel 17 (pb=6) → +11", () =>
    expect(calcSpellAttackBonus(20, 17)).toBe(11));
});

describe("calcHpMaxSuggestion", () => {
  it("clase desconocida → null", () =>
    expect(calcHpMaxSuggestion("Desconocido", 10, 1)).toBeNull());

  it("Mago nivel 1, CON 10 (+0) → 6", () =>
    expect(calcHpMaxSuggestion("Mago", 10, 1)).toBe(6));

  it("Bárbaro nivel 1, CON 16 (+3) → 15", () =>
    expect(calcHpMaxSuggestion("Bárbaro", 16, 1)).toBe(15)); // 12+3

  it("Bárbaro nivel 2, CON 16 (+3) → 25", () =>
    // nivel 1: 12+3=15; nivel 2: floor(12/2)+1+3=7+3=10 → 25
    expect(calcHpMaxSuggestion("Bárbaro", 16, 2)).toBe(25));

  it("Mago nivel 3, CON 10 (+0) → 14", () =>
    // nivel 1: 6; niveles 2-3: 2×(floor(6/2)+1+0)=2×4=8 → 14
    expect(calcHpMaxSuggestion("Mago", 10, 3)).toBe(14));

  it("HP mínimo 1 por nivel aunque CON sea muy negativa", () =>
    // CON 1 → mod=-5. Mago nivel 1: max(6-5,1)=1
    expect(calcHpMaxSuggestion("Mago", 1, 1)).toBe(1));
});

describe("totalLevel", () => {
  it("una sola clase → su nivel", () =>
    expect(totalLevel([{ class: "Guerrero", level: 5, subclass: "" }])).toBe(5));
  it("multiclase → suma", () =>
    expect(totalLevel([
      { class: "Guerrero", level: 5, subclass: "" },
      { class: "Pícaro", level: 3, subclass: "" },
    ])).toBe(8));
  it("vacío → 0", () =>
    expect(totalLevel([])).toBe(0));
});

describe("finalAbilityScore", () => {
  it("sin dotes → valor base", () =>
    expect(finalAbilityScore(15, "strength", [])).toBe(15));
  it("dote con +1 al stat correcto → base + 1", () =>
    expect(finalAbilityScore(15, "strength", [
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [{ stat: "strength", value: 1 }] },
    ])).toBe(16));
  it("dote con stat distinto → sin cambio", () =>
    expect(finalAbilityScore(15, "strength", [
      { name: "Tough", classIndex: 0, level: 4, statBonuses: [{ stat: "constitution", value: 1 }] },
    ])).toBe(15));
  it("dos dotes con mismo stat → suma", () =>
    expect(finalAbilityScore(14, "dexterity", [
      { name: "Feat A", classIndex: 0, level: 4, statBonuses: [{ stat: "dexterity", value: 1 }] },
      { name: "Feat B", classIndex: 0, level: 8, statBonuses: [{ stat: "dexterity", value: 1 }] },
    ])).toBe(16));
  it("no supera 30", () =>
    expect(finalAbilityScore(29, "strength", [
      { name: "ASI", classIndex: 0, level: 4, statBonuses: [{ stat: "strength", value: 2 }] },
    ])).toBe(30));
  it("no baja de 1", () =>
    expect(finalAbilityScore(1, "strength", [])).toBe(1));
});

describe("calcHpMaxFromRolls", () => {
  it("una clase, nivel 1, CON 10 → máximo dado", () => {
    const classes = [{ class: "Guerrero", level: 1, subclass: "" }];
    const hpRolls = [{ level: 1, value: 10, rolled: false }];
    expect(calcHpMaxFromRolls(hpRolls, classes, 10, true)).toBe(10);
  });
  it("Guerrero nivel 2, CON 16 (+3), media → 22", () => {
    const classes = [{ class: "Guerrero", level: 2, subclass: "" }];
    const hpRolls = [{ level: 1, value: 10, rolled: false }];
    expect(calcHpMaxFromRolls(hpRolls, classes, 16, true)).toBe(22);
  });
  it("multiclase Fighter5/Rogue3, CON 10, media → 49", () => {
    const classes = [
      { class: "Guerrero", level: 5, subclass: "" },
      { class: "Pícaro", level: 3, subclass: "" },
    ];
    const hpRolls = [{ level: 1, value: 10, rolled: false }];
    expect(calcHpMaxFromRolls(hpRolls, classes, 10, true)).toBe(49);
  });
  it("useAverage=false usa rolls guardados", () => {
    const classes = [{ class: "Guerrero", level: 2, subclass: "" }];
    const hpRolls = [
      { level: 1, value: 10, rolled: false },
      { level: 2, value: 8, rolled: true },
    ];
    expect(calcHpMaxFromRolls(hpRolls, classes, 10, false)).toBe(18);
  });
  it("sin roll guardado y useAverage=false usa fallback de media", () => {
    const classes = [{ class: "Guerrero", level: 2, subclass: "" }];
    const hpRolls = [{ level: 1, value: 10, rolled: false }];
    expect(calcHpMaxFromRolls(hpRolls, classes, 10, false)).toBe(16);
  });
  it("HP mínimo 1 por nivel con CON muy negativa", () => {
    const classes = [{ class: "Mago", level: 1, subclass: "" }];
    const hpRolls = [{ level: 1, value: 6, rolled: false }];
    expect(calcHpMaxFromRolls(hpRolls, classes, 1, true)).toBe(1);
  });
  it("clases vacías → 0", () =>
    expect(calcHpMaxFromRolls([], [], 10, true)).toBe(0));
});

describe("calcAC", () => {
  it("sin armadura: 10 + mod DES", () =>
    expect(calcAC("none", 14, false)).toBe(12));
  it("sin armadura + escudo: +2", () =>
    expect(calcAC("none", 14, true)).toBe(14));
  it("armadura ligera: base + DES completo", () =>
    expect(calcAC("studdedLeather", 18, false)).toBe(16));
  it("armadura media: base + DES máx +2", () =>
    expect(calcAC("scaleMail", 18, false)).toBe(16));
  it("armadura media: DES menor que 2 → DES real", () =>
    expect(calcAC("scaleMail", 12, false)).toBe(15));
  it("armadura pesada: base sin DES", () =>
    expect(calcAC("plate", 20, false)).toBe(18));
  it("armadura pesada + escudo", () =>
    expect(calcAC("plate", 20, true)).toBe(20));
  it("Defensa bárbaro: 10 + DES + CON", () =>
    expect(calcAC("unarmoredBarbarian", 14, false, 16)).toBe(15));
  it("armorKey null → 10 + DES (igual que none)", () =>
    expect(calcAC(null, 12, false)).toBe(11));
});

// ─── initiativeBonusFromFeats ────────────────────────────────────────────────

describe("initiativeBonusFromFeats", () => {
  it("sin dotes → 0", () =>
    expect(initiativeBonusFromFeats([])).toBe(0));

  it("dote Alert → +5", () =>
    expect(initiativeBonusFromFeats([
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(5));

  it("dote sin bonus de iniciativa → 0", () =>
    expect(initiativeBonusFromFeats([
      { name: "Tough", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(0));

  it("dos dotes Alert → suma", () =>
    expect(initiativeBonusFromFeats([
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [] },
      { name: "Alert", classIndex: 0, level: 8, statBonuses: [] },
    ])).toBe(10));
});

// ─── calcInitiative ──────────────────────────────────────────────────────────

describe("calcInitiative", () => {
  it("DES 10, sin dotes → 0", () =>
    expect(calcInitiative(10, [])).toBe(0));

  it("DES 14 (+2), sin dotes → 2", () =>
    expect(calcInitiative(14, [])).toBe(2));

  it("DES 8 (-1), sin dotes → -1", () =>
    expect(calcInitiative(8, [])).toBe(-1));

  it("DES 14 (+2), Alert (+5) → 7", () =>
    expect(calcInitiative(14, [
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(7));
});

// ─── speedBonusFromClasses ───────────────────────────────────────────────────

describe("speedBonusFromClasses", () => {
  it("sin clases → 0", () =>
    expect(speedBonusFromClasses([])).toBe(0));

  it("Guerrero nivel 10 → 0 (sin bonus de velocidad)", () =>
    expect(speedBonusFromClasses([{ class: "Guerrero", level: 10, subclass: "" }])).toBe(0));

  it("Bárbaro nivel 4 → 0 (necesita nv.5)", () =>
    expect(speedBonusFromClasses([{ class: "Bárbaro", level: 4, subclass: "" }])).toBe(0));

  it("Bárbaro nivel 5 → +10", () =>
    expect(speedBonusFromClasses([{ class: "Bárbaro", level: 5, subclass: "" }])).toBe(10));

  it("Monje nivel 1 → 0 (necesita nv.2)", () =>
    expect(speedBonusFromClasses([{ class: "Monje", level: 1, subclass: "" }])).toBe(0));

  it("Monje nivel 2 → +10", () =>
    expect(speedBonusFromClasses([{ class: "Monje", level: 2, subclass: "" }])).toBe(10));

  it("Bárbaro nv.5 + Monje nv.2 → +20 (se acumulan)", () =>
    expect(speedBonusFromClasses([
      { class: "Bárbaro", level: 5, subclass: "" },
      { class: "Monje",   level: 2, subclass: "" },
    ])).toBe(20));
});

// ─── speedBonusFromFeats ─────────────────────────────────────────────────────

describe("speedBonusFromFeats", () => {
  it("sin dotes → 0", () =>
    expect(speedBonusFromFeats([])).toBe(0));

  it("dote Mobile → +10", () =>
    expect(speedBonusFromFeats([
      { name: "Mobile", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(10));

  it("dote Alert (no da velocidad) → 0", () =>
    expect(speedBonusFromFeats([
      { name: "Alert", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(0));
});

// ─── calcSpeed ───────────────────────────────────────────────────────────────

describe("calcSpeed", () => {
  it("Humano sin bonificaciones → 30", () =>
    expect(calcSpeed("Humano", [], [])).toBe(30));

  it("Enano sin bonificaciones → 25", () =>
    expect(calcSpeed("Enano", [], [])).toBe(25));

  it("Goliath sin bonificaciones → 35", () =>
    expect(calcSpeed("Goliath", [], [])).toBe(35));

  it("especie desconocida → 30 (default)", () =>
    expect(calcSpeed("Otra", [], [])).toBe(30));

  it("Humano con Monje nv.2 → 40", () =>
    expect(calcSpeed("Humano", [{ class: "Monje", level: 2, subclass: "" }], [])).toBe(40));

  it("Enano con Mobile → 35", () =>
    expect(calcSpeed("Enano", [], [
      { name: "Mobile", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(35));

  it("Enano, Bárbaro nv.5, Mobile → 45", () =>
    expect(calcSpeed("Enano", [{ class: "Bárbaro", level: 5, subclass: "" }], [
      { name: "Mobile", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(45));
});

// ─── expertiseSlotsFromClasses ────────────────────────────────────────────────

describe("expertiseSlotsFromClasses", () => {
  it("Pícaro nv.1 → 2", () =>
    expect(expertiseSlotsFromClasses([{ class: "Pícaro", level: 1, subclass: "" }])).toBe(2));

  it("Pícaro nv.6 → 4", () =>
    expect(expertiseSlotsFromClasses([{ class: "Pícaro", level: 6, subclass: "" }])).toBe(4));

  it("Bardo nv.2 → 2", () =>
    expect(expertiseSlotsFromClasses([{ class: "Bardo", level: 2, subclass: "" }])).toBe(2));

  it("Bardo nv.1 → 0", () =>
    expect(expertiseSlotsFromClasses([{ class: "Bardo", level: 1, subclass: "" }])).toBe(0));

  it("Guerrero nv.10 → 0", () =>
    expect(expertiseSlotsFromClasses([{ class: "Guerrero", level: 10, subclass: "" }])).toBe(0));

  it("multiclase Pícaro 6 + Bardo 2 → 6", () =>
    expect(expertiseSlotsFromClasses([
      { class: "Pícaro", level: 6, subclass: "" },
      { class: "Bardo", level: 2, subclass: "" },
    ])).toBe(6));
});

// ─── expertiseSlotsFromFeats ──────────────────────────────────────────────────

describe("expertiseSlotsFromFeats", () => {
  it("sin dotes → 0", () =>
    expect(expertiseSlotsFromFeats([])).toBe(0));

  it("1× Skill Expert → 1", () =>
    expect(expertiseSlotsFromFeats([
      { name: "Skill Expert", classIndex: 0, level: 4, statBonuses: [] },
    ])).toBe(1));

  it("2× Skill Expert → 2", () =>
    expect(expertiseSlotsFromFeats([
      { name: "Skill Expert", classIndex: 0, level: 4, statBonuses: [] },
      { name: "Skill Expert", classIndex: 0, level: 8, statBonuses: [] },
    ])).toBe(2));

  it("dotes sin Skill Expert → 0", () =>
    expect(expertiseSlotsFromFeats([
      { name: "Mobile", classIndex: 0, level: 4, statBonuses: [] },
      { name: "Alert", classIndex: 0, level: 8, statBonuses: [] },
    ])).toBe(0));
});

// ─── calcSuggestedSpellSlots ──────────────────────────────────────────────────

describe("calcSuggestedSpellSlots", () => {
  it("Mago nv.1 → 2 slots nv.1", () =>
    expect(calcSuggestedSpellSlots([{ class: "Mago", level: 1, subclass: "" }]))
      .toEqual({ 1: 2 }));

  it("Mago nv.5 → slots nv.1-3", () =>
    expect(calcSuggestedSpellSlots([{ class: "Mago", level: 5, subclass: "" }]))
      .toEqual({ 1: 4, 2: 3, 3: 2 }));

  it("Paladín nv.5 (half caster) → effective level 2", () =>
    expect(calcSuggestedSpellSlots([{ class: "Paladín", level: 5, subclass: "" }]))
      .toEqual({ 1: 3 }));

  it("Bárbaro → sin slots", () =>
    expect(calcSuggestedSpellSlots([{ class: "Bárbaro", level: 10, subclass: "" }]))
      .toEqual({}));

  it("Brujo (Pact Magic) → excluido de calcSuggestedSpellSlots", () =>
    expect(calcSuggestedSpellSlots([{ class: "Brujo", level: 5, subclass: "" }]))
      .toEqual({}));

  it("Caballero Arcano nv.3 (1/3 caster) → effective level 1", () =>
    expect(calcSuggestedSpellSlots([{ class: "Guerrero", level: 3, subclass: "Caballero Arcano" }]))
      .toEqual({ 1: 2 }));

  it("Guerrero sin subclase mágica → sin slots", () =>
    expect(calcSuggestedSpellSlots([{ class: "Guerrero", level: 10, subclass: "" }]))
      .toEqual({}));
});

// ─── calcAC — Monje ──────────────────────────────────────────────────────────

describe("calcAC — Monje Unarmored Defense", () => {
  it("unarmoredMonk: 10 + DES(16→+3) + SAB(14→+2) = 15", () =>
    expect(calcAC("unarmoredMonk", 16, false, undefined, 14)).toBe(15));

  it("unarmoredMonk con escudo: 15 + 2 = 17", () =>
    expect(calcAC("unarmoredMonk", 16, true, undefined, 14)).toBe(17));

  it("Monje con armadura (leather): AC normal 11 + DES(16→+3) = 14", () =>
    expect(calcAC("leather", 16, false)).toBe(14));

  it("sin armadura (no monk): 10 + DES(14→+2) = 12", () =>
    expect(calcAC(null, 14, false)).toBe(12));

  it("unarmoredBarbarian: 10 + DES(14→+2) + CON(16→+3) = 15", () =>
    expect(calcAC("unarmoredBarbarian", 14, false, 16)).toBe(15));
});

// ─── skillProficiencySlots ──────────────────────────────────────────────────

describe("skillProficiencySlots", () => {
  const noFeats: { name: string; classIndex: number; level: number; statBonuses: { stat: "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma"; value: number }[] }[] = [];

  it("sin clases → 0", () =>
    expect(skillProficiencySlots([], noFeats, "Humano")).toBe(0));

  it("Guerrero nv.1 → 2", () =>
    expect(skillProficiencySlots(
      [{ class: "Guerrero", level: 1, subclass: "" }], noFeats, "Elfo"
    )).toBe(2));

  it("Bardo nv.1 → 3", () =>
    expect(skillProficiencySlots(
      [{ class: "Bardo", level: 1, subclass: "" }], noFeats, "Elfo"
    )).toBe(3));

  it("Explorador nv.1 → 3", () =>
    expect(skillProficiencySlots(
      [{ class: "Explorador", level: 1, subclass: "" }], noFeats, "Elfo"
    )).toBe(3));

  it("Pícaro nv.1 → 4", () =>
    expect(skillProficiencySlots(
      [{ class: "Pícaro", level: 1, subclass: "" }], noFeats, "Elfo"
    )).toBe(4));

  it("Bárbaro nv.2 → 2 (sin Primal Knowledge)", () =>
    expect(skillProficiencySlots(
      [{ class: "Bárbaro", level: 2, subclass: "" }], noFeats, "Elfo"
    )).toBe(2));

  it("Bárbaro nv.3 → 3 (Primal Knowledge +1)", () =>
    expect(skillProficiencySlots(
      [{ class: "Bárbaro", level: 3, subclass: "" }], noFeats, "Elfo"
    )).toBe(3));

  it("Humano Guerrero nv.1 → 3 (2 clase + 1 especie)", () =>
    expect(skillProficiencySlots(
      [{ class: "Guerrero", level: 1, subclass: "" }], noFeats, "Humano"
    )).toBe(3));

  it("multiclase Guerrero/Bardo → 2 + 1 = 3", () =>
    expect(skillProficiencySlots(
      [{ class: "Guerrero", level: 5, subclass: "" }, { class: "Bardo", level: 1, subclass: "" }],
      noFeats, "Elfo"
    )).toBe(3));

  it("multiclase Guerrero/Pícaro → 2 + 1 = 3", () =>
    expect(skillProficiencySlots(
      [{ class: "Guerrero", level: 5, subclass: "" }, { class: "Pícaro", level: 1, subclass: "" }],
      noFeats, "Elfo"
    )).toBe(3));

  it("multiclase Guerrero/Mago → 2 + 0 = 2 (Mago no da skills en MC)", () =>
    expect(skillProficiencySlots(
      [{ class: "Guerrero", level: 5, subclass: "" }, { class: "Mago", level: 1, subclass: "" }],
      noFeats, "Elfo"
    )).toBe(2));

  it("multiclase Guerrero/Explorador → 2 + 1 = 3", () =>
    expect(skillProficiencySlots(
      [{ class: "Guerrero", level: 5, subclass: "" }, { class: "Explorador", level: 1, subclass: "" }],
      noFeats, "Elfo"
    )).toBe(3));

  it("dote Skilled → +3", () =>
    expect(skillProficiencySlots(
      [{ class: "Guerrero", level: 1, subclass: "" }],
      [{ name: "Skilled", classIndex: -1, level: 0, statBonuses: [] }],
      "Elfo"
    )).toBe(5));

  it("dote Skill Expert → +1 competencia", () =>
    expect(skillProficiencySlots(
      [{ class: "Guerrero", level: 4, subclass: "" }],
      [{ name: "Skill Expert", classIndex: 0, level: 4, statBonuses: [] }],
      "Elfo"
    )).toBe(3));

  it("combinado: Pícaro + Bárbaro nv.3 MC + Skilled + Humano", () =>
    expect(skillProficiencySlots(
      [{ class: "Pícaro", level: 5, subclass: "" }, { class: "Bárbaro", level: 3, subclass: "" }],
      [{ name: "Skilled", classIndex: -1, level: 0, statBonuses: [] }],
      "Humano"
    )).toBe(4 + 0 + 1 + 3 + 1));
});
