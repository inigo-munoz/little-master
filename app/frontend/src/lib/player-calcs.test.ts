import { describe, it, expect } from "vitest";
import {
  abilityModifier,
  proficiencyBonus,
  calcPassivePerception,
  calcSpellSaveDC,
  calcSpellAttackBonus,
  calcHpMaxSuggestion,
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
