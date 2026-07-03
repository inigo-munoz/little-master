import { describe, it, expect } from "vitest";
import {
  extractSpellSection,
  parseSpells,
  formatSpell,
  buildSpellsMarkdown,
} from "./srd-spells-builder.js";

// Verbatim excerpt shape from data/srd/en/06_Trasfondos_y_Equipo.txt,
// including PDF pagination noise (page number lines and SRD footer).
const FIXTURE = `Spell Descriptions
Acid Arrow

Level 2 Evocation (Wizard)
Casting Time: Action
Range: 90 feet
Components: V, S, M (powdered rhubarb leaf)
Duration: Instantaneous

A shimmering green arrow streaks toward a target
within range and bursts in a spray of acid.
Using a Higher-Level Spell Slot. The damage
(both initial and later) increases by 1d4 for each
spell slot level above 2.

Alarm

Level 1 Abjuration (Ranger, Wizard)

Casting Time: 1 minute or Ritual
Range: 30 feet
Components: V, S, M (a bell and silver wire)
Duration: 8 hours

You set an alarm against intrusion. Choose a door,
a window, or an area within range that is no larger
than a 20-foot Cube. Until the spell ends, an alarm

107

System Reference Document 5.2.1

alerts you whenever a creature touches or enters
the warded area.

Fire Bolt

Evocation Cantrip (Sorcerer, Wizard)
Casting Time: Action
Range: 120 feet
Components: V, S
Duration: Instantaneous

You hurl a mote of fire at a creature or an object
within range.
Cantrip Upgrade. The damage increases by 1d10
when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).

Hold Person

Level 2 Enchantment (Bard, Cleric, Druid, Sorcerer, Warlock, Wizard)
Casting Time: Action
Range: 60 feet
Components: V, S, M (a straight piece of iron)
Duration: Concentration, up to 1 minute

Choose a Humanoid that you can see within range.
Rules Glossary
`;

describe("extractSpellSection", () => {
  it("drops page-number lines and SRD footers and stops at Rules Glossary", () => {
    const lines = extractSpellSection(FIXTURE);
    expect(lines).not.toContain("107");
    expect(lines).not.toContain("System Reference Document 5.2.1");
    expect(lines).not.toContain("Rules Glossary");
    expect(lines).toContain("Acid Arrow");
  });
});

// Real SRD data wraps long class lists onto a second line, e.g.
// "Level 2 Abjuration (Bard, Cleric, Druid, Paladin," / "Ranger)".
// Without merging, TYPE_RE never matches either fragment and the whole
// spell block is silently skipped.
const WRAPPED_TYPE_FIXTURE = `Spell Descriptions
Aid

Level 2 Abjuration (Bard, Cleric, Druid, Paladin,
Ranger)
Casting Time: Action
Range: 30 feet
Components: V, S, M (a tiny strip of white cloth)
Duration: 8 hours

Your spell bolsters your allies with toughness and
resolve.

Rules Glossary
`;

describe("extractSpellSection with a wrapped class list", () => {
  it("merges the two-line type header into one line", () => {
    const lines = extractSpellSection(WRAPPED_TYPE_FIXTURE);
    expect(lines).toContain(
      "Level 2 Abjuration (Bard, Cleric, Druid, Paladin, Ranger)"
    );
    expect(lines).not.toContain("Ranger)");
  });
});

describe("parseSpells with a wrapped class list", () => {
  it("parses the spell instead of skipping it", () => {
    const spells = parseSpells(extractSpellSection(WRAPPED_TYPE_FIXTURE));
    expect(spells).toHaveLength(1);
    expect(spells[0]!.name).toBe("Aid");
    expect(spells[0]!.level).toBe(2);
    expect(spells[0]!.classes).toBe("Bard, Cleric, Druid, Paladin, Ranger");
    expect(spells[0]!.castingTime).toBe("Action");
  });
});

describe("parseSpells", () => {
  const spells = parseSpells(extractSpellSection(FIXTURE));

  it("finds the four spells in the fixture", () => {
    expect(spells.map((s) => s.name)).toEqual([
      "Acid Arrow",
      "Alarm",
      "Fire Bolt",
      "Hold Person",
    ]);
  });

  it("parses a leveled spell with higher-level upgrade", () => {
    const acid = spells[0]!;
    expect(acid.level).toBe(2);
    expect(acid.school).toBe("Evocation");
    expect(acid.classes).toBe("Wizard");
    expect(acid.castingTime).toBe("Action");
    expect(acid.range).toBe("90 feet");
    expect(acid.components).toBe("V, S, M (powdered rhubarb leaf)");
    expect(acid.duration).toBe("Instantaneous");
    expect(acid.higherLevel).toContain("increases by 1d4");
    expect(acid.description).toContain("shimmering green arrow");
  });

  it("parses a cantrip with cantrip upgrade", () => {
    const bolt = spells[2]!;
    expect(bolt.level).toBe(0);
    expect(bolt.school).toBe("Evocation");
    expect(bolt.cantripUpgrade).toContain("1d10");
  });

  it("joins description lines split across page breaks", () => {
    const alarm = spells[1]!;
    expect(alarm.description).toContain(
      "an alarm alerts you whenever a creature touches"
    );
  });
});

describe("formatSpell", () => {
  const spells = parseSpells(extractSpellSection(FIXTURE));

  it("formats a leveled spell in the exact English layout the API parser expects", () => {
    const md = formatSpell(spells[0]!);
    expect(md).toContain("## Acid Arrow\n");
    expect(md).toContain("Level 2, Evocation (Wizard)\n");
    expect(md).toContain(
      "Casting Time: Action | Range: 90 feet | Components: V, S, M (powdered rhubarb leaf) | Duration: Instantaneous"
    );
    expect(md).toContain("*Higher Level:*");
  });

  it("tags ritual and concentration spells", () => {
    const alarm = formatSpell(spells[1]!);
    expect(alarm).toContain("Level 1, Abjuration (Ranger, Wizard) [Ritual]");
    const hold = formatSpell(spells[3]!);
    expect(hold).toContain("[C]");
  });

  it("formats cantrips with the Cantrip prefix and upgrade marker", () => {
    const bolt = formatSpell(spells[2]!);
    expect(bolt).toContain("Cantrip, Evocation (Sorcerer, Wizard)");
    expect(bolt).toContain("*Cantrip Upgrade:*");
  });
});

describe("buildSpellsMarkdown", () => {
  it("produces a full document with CC-BY-4.0 header and spell count", () => {
    const { markdown, count } = buildSpellsMarkdown(FIXTURE);
    expect(count).toBe(4);
    expect(markdown).toContain("CC-BY-4.0");
    expect(markdown).not.toContain("PHB");
    expect(markdown.split("\n## ").length - 1).toBe(4);
  });
});
