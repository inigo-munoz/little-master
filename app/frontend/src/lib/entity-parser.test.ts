import { describe, it, expect } from "vitest";
import { parseLocationFromResponse, parseFactionFromResponse } from "./entity-parser";

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
