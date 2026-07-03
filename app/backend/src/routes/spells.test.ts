import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSpellDocument } from "./spells.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SPELLS_FILE = path.resolve(
  __dirname,
  "../../../../data/srd/en/09_Spells.md"
);

describe("parseSpellDocument with the generated English SRD file", () => {
  const content = readFileSync(SPELLS_FILE, "utf-8");
  const spells = parseSpellDocument(content);

  it("parses at least 290 spells", () => {
    expect(Object.keys(spells).length).toBeGreaterThanOrEqual(290);
  });

  it("parses Fireball completely", () => {
    const f = spells["Fireball"];
    expect(f).toBeDefined();
    expect(f!.level).toBe(3);
    expect(f!.school).toBe("Evocation");
    expect(f!.range).toBe("150 feet");
    expect(f!.components.material).toBe(true);
    expect(f!.higherLevels).toContain("1d6");
  });

  it("parses ritual and concentration flags", () => {
    const alarm = spells["Alarm"];
    expect(alarm!.ritual).toBe(true);
    const hold = spells["Hold Person"];
    expect(hold!.concentration).toBe(true);
  });

  it("parses cantrips as level 0", () => {
    const bolt = spells["Fire Bolt"];
    expect(bolt!.level).toBe(0);
  });
});
