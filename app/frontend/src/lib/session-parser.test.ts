import { describe, it, expect } from "vitest";
import { parseSessionSummaryFromResponse } from "./session-parser";

const RESPUESTA_COMPLETA = `## Session Overview

El grupo llega a Phandalin después de semanas de viaje por el Bosque de Neverwinter.
Los jugadores deben investigar los rumores sobre un culto que opera en las catacumbas.

## Open Threads
- La desaparición del alcalde sigue sin resolverse
- El mapa encontrado en la cueva apunta a un templo oculto

## Key NPCs Present
- Sildar Hallwinter: aliado, conoce la historia del culto
- Glasstaff: enemigo, líder de los Telentáculos

## Potential Encounters
- Emboscada en la carretera principal (3 bandidos CR 1/8)
- Exploración del templo abandonado

## DM Notes [PRIVATE]
El culto trabaja para Vecna. No revelar todavía.`;

const RESPUESTA_ES = `## Resumen de sesión

La partida ha conseguido la llave del templo tras negociar con el dragón menor.
El maestro de mazmorras debe preparar las trampas del nivel inferior.

## Hilos abiertos
- Kalarel sigue libre y planea su venganza
- El rey aún no sabe que su consejero es un espía

## NPCs clave presentes
- Kalarel: antagonista principal

## Notas del DM [PRIVADO]
Kalarel atacará en la siguiente sesión.`;

describe("parseSessionSummaryFromResponse", () => {
  it("detecta ## Session Overview y devuelve título y resumen", () => {
    const result = parseSessionSummaryFromResponse(RESPUESTA_COMPLETA);
    expect(result).not.toBeNull();
    expect(result?.title).toBeTruthy();
    expect(result?.summary).toContain("## Session Overview");
    expect(result?.summary.length).toBeGreaterThan(200);
  });

  it("detecta ## Resumen de sesión y devuelve título y resumen", () => {
    const result = parseSessionSummaryFromResponse(RESPUESTA_ES);
    expect(result).not.toBeNull();
    expect(result?.title).toBeTruthy();
    expect(result?.summary).toContain("## Resumen de sesión");
  });

  it("devuelve null cuando no hay heading reconocible", () => {
    const content =
      "Esta sesión fue muy emocionante. Los jugadores entraron en la mazmorra y lucharon contra ".repeat(4) +
      "muchos monstruos y encontraron un tesoro enorme al final del dungeon.";
    expect(parseSessionSummaryFromResponse(content)).toBeNull();
  });

  it("devuelve null cuando el contenido es menor de 200 chars", () => {
    const short = "## Session Overview\n\nSesión corta sin apenas contenido.";
    expect(short.length).toBeLessThan(200);
    expect(parseSessionSummaryFromResponse(short)).toBeNull();
  });

  it("devuelve null con string vacío", () => {
    expect(parseSessionSummaryFromResponse("")).toBeNull();
  });
});
