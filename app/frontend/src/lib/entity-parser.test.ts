import { describe, it, expect } from "vitest";
import { parseLocationFromResponse, parseFactionFromResponse, parseGenericEntityFromResponse } from "./entity-parser";

const DESCRIPCION_LARGA =
  "Un lugar imponente con muros de piedra negra que se alzan sobre el horizonte. " +
  "Sus pasillos ocultan siglos de historia y secretos que pocos han logrado descubrir. " +
  "Los lugareños hablan de este lugar en voz baja, temerosos de atraer su maldición.";

const DESCRIPCION_CORTA = "Un lugar misterioso.";

// ─── parseLocationFromResponse ───────────────────────────────────────────────

describe("parseLocationFromResponse", () => {
  it("detecta heading con palabra clave 'Location' y contenido largo → devuelve objeto", () => {
    const content = `## The Dark Location\n\n${DESCRIPCION_LARGA}`;
    const result = parseLocationFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("The Dark Location");
    expect(result?.description).toContain("imponente");
  });

  it("detecta heading con palabra clave 'Localización' y contenido largo → devuelve objeto", () => {
    const content = `## Localización: Castillo Ravenloft\n\n${DESCRIPCION_LARGA}`;
    const result = parseLocationFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.description.length).toBeGreaterThanOrEqual(100);
  });

  it("detecta heading con 'Lugar' pero contenido corto → null", () => {
    const content = `## Lugar Abandonado\n\n${DESCRIPCION_CORTA}`;
    const result = parseLocationFromResponse(content);
    expect(result).toBeNull();
  });

  it("sin heading reconocible → null", () => {
    const content = `**Aldric el Herrero**\n\n${DESCRIPCION_LARGA}`;
    expect(parseLocationFromResponse(content)).toBeNull();
  });

  it("string vacío → null", () => {
    expect(parseLocationFromResponse("")).toBeNull();
  });
});

// ─── parseFactionFromResponse ────────────────────────────────────────────────

describe("parseFactionFromResponse", () => {
  it("detecta heading con palabra clave 'Faction' y contenido largo → devuelve objeto", () => {
    const content = `## The Shadow Faction\n\n${DESCRIPCION_LARGA}`;
    const result = parseFactionFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("The Shadow Faction");
    expect(result?.description).toContain("imponente");
  });

  it("detecta heading con 'Facción' y contenido largo → devuelve objeto", () => {
    const content = `## Facción: Los Telentáculos\n\n${DESCRIPCION_LARGA}`;
    const result = parseFactionFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.description.length).toBeGreaterThanOrEqual(100);
  });

  it("detecta heading con 'Organización' pero contenido corto → null", () => {
    const content = `## Organización Secreta\n\n${DESCRIPCION_CORTA}`;
    const result = parseFactionFromResponse(content);
    expect(result).toBeNull();
  });

  it("sin heading reconocible → null", () => {
    const content = `## Session Overview\n\n${DESCRIPCION_LARGA}`;
    expect(parseFactionFromResponse(content)).toBeNull();
  });

  it("string vacío → null", () => {
    expect(parseFactionFromResponse("")).toBeNull();
  });
});

// ─── parseGenericEntityFromResponse ──────────────────────────────────────────

const RESPUESTA_LOCALIZACION_COMPLETA = `[AI GENERATED — REVIEW REQUIRED]

## Santuario de los Portales

**Tipo:** Lugar sagrado y punto de convergencia dimensional
**Ambiente:** Antiguo y místico, con ecos de magia ancestral

Este santuario fue erigido hace mil años por los Custodios del Umbral para sellar una fisura entre planos. Sus columnas de mármol blanco están cubiertas de runas que brillan tenuemente en la oscuridad. El suelo conserva el calor de las llamas dimensionales que lo forjaron.

**Historia:**
Construido durante la Gran Convergencia, cuando tres planos se superpusieron durante una semana completa. Docenas de magos sacrificaron sus memorias para estabilizar el portal.

**Secretos del DM:**
El portal aún está activo. Una facción sabe cómo reactivarlo y planea hacerlo en la próxima luna llena.

**Ganchos de trama:**
Los personajes pueden encontrar fragmentos del diario de los Custodios originales, que revelan el verdadero propósito del sello.

[Potential conflicts: El sello está debilitándose]
[Suggested tags: source_type: homebrew_user]`;

describe("parseGenericEntityFromResponse", () => {
  it("extrae nombre y descripción completa de localización sin keywords en el heading", () => {
    const result = parseGenericEntityFromResponse(RESPUESTA_LOCALIZACION_COMPLETA);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Santuario de los Portales");
    // La descripción debe ser sustancial
    expect(result!.description.length).toBeGreaterThan(200);
  });

  it("la descripción incluye los campos descriptivos (Tipo:, Ambiente:)", () => {
    const result = parseGenericEntityFromResponse(RESPUESTA_LOCALIZACION_COMPLETA);
    expect(result?.description).toContain("Lugar sagrado");
    expect(result?.description).toContain("Antiguo y místico");
  });

  it("la descripción incluye los párrafos narrativos", () => {
    const result = parseGenericEntityFromResponse(RESPUESTA_LOCALIZACION_COMPLETA);
    expect(result?.description).toContain("columnas de mármol blanco");
    expect(result?.description).toContain("Gran Convergencia");
  });

  it("la descripción incluye secretos del DM y ganchos de trama", () => {
    const result = parseGenericEntityFromResponse(RESPUESTA_LOCALIZACION_COMPLETA);
    expect(result?.description).toContain("portal aún está activo");
    expect(result?.description).toContain("diario de los Custodios");
  });

  it("la descripción NO incluye el heading ni las etiquetas [...]", () => {
    const result = parseGenericEntityFromResponse(RESPUESTA_LOCALIZACION_COMPLETA);
    expect(result?.description).not.toContain("## Santuario");
    expect(result?.description).not.toContain("[AI GENERATED");
    expect(result?.description).not.toContain("[Potential conflicts");
    expect(result?.description).not.toContain("[Suggested tags");
  });

  it("string vacío → null", () => {
    expect(parseGenericEntityFromResponse("")).toBeNull();
  });
});

