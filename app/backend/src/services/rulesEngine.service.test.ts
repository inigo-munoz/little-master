import { describe, it, expect } from "vitest";
import { parseCR } from "@dnd/domain";
import { rulesEngine } from "./rulesEngine.service.js";

// ─── parseCR ──────────────────────────────────────────────────────────────────

describe("parseCR", () => {
  it("convierte fracciones de cadena a decimal", () => {
    expect(parseCR("1/2")).toBe(0.5);
    expect(parseCR("1/4")).toBe(0.25);
    expect(parseCR("1/8")).toBe(0.125);
  });

  it("pasa números enteros sin modificar", () => {
    expect(parseCR(0)).toBe(0);
    expect(parseCR(1)).toBe(1);
    expect(parseCR(5)).toBe(5);
    expect(parseCR(20)).toBe(20);
  });

  it("parsea cadenas numéricas", () => {
    expect(parseCR("0")).toBe(0);
    expect(parseCR("10")).toBe(10);
  });

  it("devuelve 0 para cadenas no reconocidas", () => {
    expect(parseCR("unknown")).toBe(0);
    expect(parseCR("")).toBe(0);
  });
});

// ─── validateEncounter con CR en formato string ───────────────────────────────

describe("rulesEngine.validateEncounter — CR como string", () => {
  const party = { size: 4, averageLevel: 3 };

  it("calcula XP correctamente con CR '1/2' (= 100 XP)", () => {
    const result = rulesEngine.validateEncounter(party, [
      { name: "Goblin", cr: "1/2" },
    ]);
    expect(result.totalXp).toBe(100);
  });

  it("calcula XP correctamente con CR '1/4' (= 50 XP)", () => {
    const result = rulesEngine.validateEncounter(party, [
      { name: "Skeleton", cr: "1/4" },
    ]);
    expect(result.totalXp).toBe(50);
  });

  it("calcula XP correctamente con CR '1/8' (= 25 XP)", () => {
    const result = rulesEngine.validateEncounter(party, [
      { name: "Kobold", cr: "1/8" },
    ]);
    expect(result.totalXp).toBe(25);
  });

  it("es equivalente pasar CR como número o como string", () => {
    const withString = rulesEngine.validateEncounter(party, [
      { name: "Ogre", cr: "2" },
    ]);
    const withNumber = rulesEngine.validateEncounter(party, [
      { name: "Ogre", cr: 2 },
    ]);
    expect(withString.totalXp).toBe(withNumber.totalXp);
    expect(withString.difficulty).toBe(withNumber.difficulty);
  });

  it("emite warning para CR desconocido y asigna 0 XP", () => {
    const result = rulesEngine.validateEncounter(party, [
      { name: "TestMonster", cr: "99" },
    ]);
    expect(result.totalXp).toBe(0);
    expect(result.warnings.some((w) => w.includes("Unknown CR"))).toBe(true);
  });

  it("cuenta multiplicadores correctamente con varios monstruos", () => {
    const result = rulesEngine.validateEncounter(party, [
      { name: "Goblin", cr: "1/2", count: 4 },
    ]);
    // 4 goblins × 100 XP = 400 XP base; multiplicador ×2 para 4 monstruos
    expect(result.totalXp).toBe(400);
    expect(result.adjustedXp).toBe(800);
  });
});
