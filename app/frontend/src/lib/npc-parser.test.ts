import { describe, it, expect } from "vitest";
import { parseNpcFromResponse } from "./npc-parser";

// Respuesta realista del modo Designer (formato que genera el LLM según el system prompt)
const RESPUESTA_DESIGNER = `[AI GENERATED — REVIEW REQUIRED]

**NPC: Aldric el Herrero**

**Raza:** Humano
**Clase:** Plebeyo
**Estado:** Vivo

Aldric es un herrero de mediana edad con manos curtidas por años de trabajo en la fragua. Su carácter hosco esconde una lealtad inquebrantable hacia los aventureros que le tratan con respeto.

**Historia:**
Llegó a la ciudad hace veinte años huyendo de una guerra en el norte. Perdió a su esposa durante el viaje y desde entonces se dedicó en cuerpo y alma al trabajo.

**Motivaciones:**
Quiere asegurarse de que su hija pueda estudiar en la academia de magos. Desconfía de la nobleza local.

**Relación con el grupo:**
Inicialmente receloso, pero puede convertirse en aliado si los personajes demuestran que se preocupan por la gente común.

[Potential conflicts: Ninguno detectado]
[Suggested tags: source_type: homebrew_user, authority_level: low]`;

const DESCRIPCION_NARRATIVA_ESPERADA =
  `Aldric es un herrero de mediana edad con manos curtidas por años de trabajo en la fragua. Su carácter hosco esconde una lealtad inquebrantable hacia los aventureros que le tratan con respeto.

Llegó a la ciudad hace veinte años huyendo de una guerra en el norte. Perdió a su esposa durante el viaje y desde entonces se dedicó en cuerpo y alma al trabajo.

Quiere asegurarse de que su hija pueda estudiar en la academia de magos. Desconfía de la nobleza local.

Inicialmente receloso, pero puede convertirse en aliado si los personajes demuestran que se preocupan por la gente común.`;

const DESCRIPCION_SIMPLE =
  "Es un herrero de mediana edad, con manos curtidas por años de trabajo en la fragua. " +
  "Su carácter hosco esconde una lealtad inquebrantable hacia los aventureros que le tratan con respeto. " +
  "Conoce rumores de la ciudad que ningún noble admitiría saber.";

describe("parseNpcFromResponse", () => {
  // ── Casos base ────────────────────────────────────────────────────────────

  it("detecta nombre en negrita seguido de descripción simple", () => {
    const content = `**Aldric el Herrero**\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Aldric el Herrero");
    // La descripción no incluye la línea del nombre
    expect(result?.description).toBe(DESCRIPCION_SIMPLE.trim());
    expect(result?.description).not.toContain("**Aldric el Herrero**");
  });

  it("detecta nombre en heading ## seguido de descripción simple", () => {
    const content = `## Mira la Exploradora\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Mira la Exploradora");
    expect(result?.description).toBe(DESCRIPCION_SIMPLE.trim());
    expect(result?.description).not.toContain("## Mira");
  });

  it("devuelve null cuando no hay nombre reconocible", () => {
    const content =
      "Aquí tienes algunas ideas para la próxima sesión. Podrías introducir un personaje misterioso " +
      "que aparezca en la taberna y ofrezca información sobre el castillo abandonado al norte.";
    expect(parseNpcFromResponse(content)).toBeNull();
  });

  it("devuelve null cuando hay negrita pero el texto total es menor de 100 caracteres", () => {
    const content = "**Gareth**\n\nGuardia de la ciudad.";
    expect(content.length).toBeLessThan(100);
    expect(parseNpcFromResponse(content)).toBeNull();
  });

  it("devuelve null con string vacío", () => {
    expect(parseNpcFromResponse("")).toBeNull();
  });

  // ── Limpieza del nombre ───────────────────────────────────────────────────

  it('elimina el prefijo "NPC:" del nombre', () => {
    const content = `**NPC: Aldric el Herrero**\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result?.name).toBe("Aldric el Herrero");
  });

  it('elimina el prefijo "NPC " (sin dos puntos) del nombre', () => {
    const content = `**NPC Aldric el Herrero**\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result?.name).toBe("Aldric el Herrero");
  });

  it('elimina el prefijo "Personaje:" del nombre', () => {
    const content = `**Personaje: Mira la Exploradora**\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result?.name).toBe("Mira la Exploradora");
  });

  it('elimina el prefijo "Character:" del nombre (insensible a mayúsculas)', () => {
    const content = `## character: Ser Valen\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result?.name).toBe("Ser Valen");
  });

  // ── Limpieza de la descripción ────────────────────────────────────────────

  it("elimina [AI GENERATED — REVIEW REQUIRED] de la descripción", () => {
    const content = `[AI GENERATED — REVIEW REQUIRED]\n\n**Aldric el Herrero**\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result?.description).not.toContain("[AI GENERATED");
  });

  it("elimina campos de metadatos inline (**Raza:**, **Estado:**, etc.)", () => {
    const content = `**Aldric el Herrero**\n\n**Raza:** Humano\n**Estado:** Vivo\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result?.description).not.toContain("**Raza:**");
    expect(result?.description).not.toContain("**Estado:**");
    expect(result?.description).toContain("Es un herrero");
  });

  it("elimina cabeceras de sección standalone (**Historia:**, **Motivaciones:**)", () => {
    const content = `**Aldric el Herrero**\n\n**Historia:**\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result?.description).not.toContain("**Historia:**");
    expect(result?.description).toContain("Es un herrero");
  });

  it("elimina los tags de pie [Potential conflicts:] y [Suggested tags:]", () => {
    const content = `**Aldric el Herrero**\n\n${DESCRIPCION_SIMPLE}\n\n[Potential conflicts: Ninguno]\n[Suggested tags: source_type: homebrew_user]`;
    const result = parseNpcFromResponse(content);
    expect(result?.description).not.toContain("[Potential conflicts");
    expect(result?.description).not.toContain("[Suggested tags");
  });

  // ── Patrones alternativos de nombre ──────────────────────────────────────

  it('detecta nombre en formato campo "Nombre: X"', () => {
    const content = `Nombre: Elara\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Elara");
    expect(result?.description).not.toContain("Nombre: Elara");
  });

  it('detecta nombre en formato campo "Nombre: X" con negrita', () => {
    const content = `**Nombre:** Elara\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Elara");
  });

  it('"**Elara**" como primera línea de la respuesta → extrae el nombre', () => {
    const content = `**Elara**\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Elara");
    expect(result?.description).not.toContain("**Elara**");
  });

  it('"Elara\\n\\nRol:" → extrae nombre de la primera línea no vacía', () => {
    const content = `Elara\n\nRol: Exploradora veterana de los Bosques del Norte\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Elara");
    expect(result?.description).not.toContain("Elara\n");
  });

  it('primera línea seguida de "Apariencia:" también detecta el nombre', () => {
    const content = `Kira la Sombra\n\nApariencia: Mujer delgada con capa oscura\n\n${DESCRIPCION_SIMPLE}`;
    const result = parseNpcFromResponse(content);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Kira la Sombra");
  });

  // ── Caso realista completo ────────────────────────────────────────────────

  it("procesa correctamente una respuesta realista del modo Designer", () => {
    const result = parseNpcFromResponse(RESPUESTA_DESIGNER);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Aldric el Herrero");
    expect(result?.description).toBe(DESCRIPCION_NARRATIVA_ESPERADA);
  });
});
