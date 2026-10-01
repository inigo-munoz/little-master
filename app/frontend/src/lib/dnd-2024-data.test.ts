import { describe, it, expect } from "vitest";
import {
  splitClassSubclass,
  normalizeClassEntries,
  parseClassEntries,
  isClassSpellcaster,
  HIT_DIE_BY_CLASS,
} from "./dnd-2024-data";

describe("splitClassSubclass", () => {
  it("separa 'Mago (Escuela de Adivinación)'", () => {
    expect(splitClassSubclass("Mago (Escuela de Adivinación)")).toEqual({
      class: "Mago",
      subclass: "Escuela de Adivinación",
    });
  });
  it("separa 'Druida (Círculo de la Tierra)'", () => {
    expect(splitClassSubclass("Druida (Círculo de la Tierra)")).toEqual({
      class: "Druida",
      subclass: "Círculo de la Tierra",
    });
  });
  it("'Mago' sin paréntesis queda intacto y no inventa subclase", () => {
    expect(splitClassSubclass("Mago")).toEqual({ class: "Mago", subclass: "" });
  });
  it("'Mago (Homebrew)' queda intacto: no es subclase conocida", () => {
    expect(splitClassSubclass("Mago (Homebrew)")).toEqual({ class: "Mago (Homebrew)", subclass: "" });
  });
  it("'Artífice (Alquimista)' queda intacto: clase fuera del catálogo", () => {
    expect(splitClassSubclass("Artífice (Alquimista)")).toEqual({ class: "Artífice (Alquimista)", subclass: "" });
  });
  it("conserva una subclase ya informada", () => {
    expect(splitClassSubclass("Mago (Escuela de Adivinación)", "Escuela de Evocación")).toEqual({
      class: "Mago (Escuela de Adivinación)",
      subclass: "Escuela de Evocación",
    });
  });
  it("tolera espacios y mayúsculas distintas", () => {
    expect(splitClassSubclass("  mago   (  escuela DE adivinación )  ")).toEqual({
      class: "Mago",
      subclass: "Escuela de Adivinación",
    });
    expect(splitClassSubclass("Mago(Escuela de Adivinación)")).toEqual({
      class: "Mago",
      subclass: "Escuela de Adivinación",
    });
  });
});

describe("normalizeClassEntries / parseClassEntries", () => {
  it("normaliza conservando nivel y devuelve la misma referencia si no hay cambios", () => {
    const [e] = normalizeClassEntries([{ class: "Mago (Escuela de Adivinación)", level: 5, subclass: "" }]);
    expect(e).toEqual({ class: "Mago", level: 5, subclass: "Escuela de Adivinación" });
    const clean = { class: "Mago", level: 1, subclass: "" };
    expect(normalizeClassEntries([clean])[0]).toBe(clean);
  });
  it("parseClassEntries tolera JSON inválido o no-array", () => {
    expect(parseClassEntries("{no json")).toEqual([]);
    expect(parseClassEntries("{}")).toEqual([]);
    expect(parseClassEntries(undefined)).toEqual([]);
  });
  it("las tablas por clase resuelven tras normalizar (síntoma: pestaña Hechizos)", () => {
    const e = parseClassEntries<{ class: string; level: number; subclass: string }>(
      JSON.stringify([{ class: "Mago (Escuela de Adivinación)", level: 3, subclass: "" }])
    )[0]!;
    expect(isClassSpellcaster(e.class, e.subclass)).toBe(true);
    expect(HIT_DIE_BY_CLASS[e.class]).toBe(6);
  });
  it("sin normalizar, la cadena embebida no es lanzadora (comportamiento previo)", () => {
    expect(isClassSpellcaster("Mago (Escuela de Adivinación)", "")).toBe(false);
  });
});
