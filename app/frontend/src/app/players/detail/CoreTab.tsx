"use client";

import { Lock, LockOpen } from "lucide-react";
import {
  DND_SPECIES,
  DND_SPECIES_VARIANTS,
  DND_BACKGROUNDS,
  DND_ALIGNMENTS,
  SPELLCASTING_ABILITY_BY_CLASS,
  HIT_DIE_BY_CLASS,
  baseSpeedForSpecies,
  BACKGROUND_DATA,
  SAVING_THROWS_BY_CLASS,
  ARMOR_PROFICIENCIES_BY_CLASS,
  WEAPON_PROFICIENCIES_BY_CLASS,
  WEAPON_PROFICIENCIES_BY_SPECIES,
  LANGUAGES_BY_SPECIES,
  EXTRA_LANGUAGES_BY_SPECIES,
  STANDARD_LANGUAGES,
  EXOTIC_LANGUAGES,
  THIRD_CASTER_SUBCLASSES,
  isClassSpellcaster,
  SPECIES_WITH_ORIGIN_FEAT,
  FIXED_SKILL_PROFICIENCIES_BY_SPECIES,
} from "../../../lib/dnd-2024-data";
import {
  abilityModifier,
  proficiencyBonus,
  totalLevel,
  finalAbilityScore,
  calcHpMaxFromRolls,
  calcAC,
  calcInitiative,
  calcSpeed,
  calcPassivePerception,
  calcSpellSaveDC,
  calcSpellAttackBonus,
  initiativeBonusFromFeats,
  speedBonusFromClasses,
  speedBonusFromFeats,
  expertiseSlotsFromClasses,
  type PlayerClassEntry,
  type HpRollEntry,
  type FeatEntry,
} from "../../../lib/player-calcs";
import { type CharacterFormProps } from "./player-types";
import { SectionTitle, Field, Input, Select, NumberInput } from "./player-ui";
import { ClassesPanel } from "./ClassesPanel";
import { HpRollsPanel } from "./HpRollsPanel";
import { FeatsPanel } from "./FeatsPanel";

const ALL_PICK_LANGUAGES = [...STANDARD_LANGUAGES as readonly string[], ...EXOTIC_LANGUAGES as readonly string[]];

function LanguagePicker({
  fixedLanguages,
  extraCount,
  value,
  onChange,
}: {
  fixedLanguages: string[];
  extraCount: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const allLangSet = new Set(ALL_PICK_LANGUAGES);
  const stored = value.split(",").map(s => s.trim()).filter(Boolean);
  const extras = stored.filter(l => !fixedLanguages.includes(l) && allLangSet.has(l));
  const selections = Array.from({ length: extraCount }, (_, i) => extras[i] ?? "");
  const fixedSet = new Set(fixedLanguages);

  function handleChange(idx: number, picked: string) {
    const updated = selections.map((v, i) => i === idx ? picked : v);
    const all = [...fixedLanguages, ...updated.filter(Boolean)];
    onChange([...new Set(all)].join(", "));
  }

  return (
    <div className="space-y-2">
      {fixedLanguages.length > 0 && (
        <div className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-300 text-sm">
          {fixedLanguages.join(", ")}
        </div>
      )}
      {selections.map((sel, i) => {
        const otherPicked = new Set([...fixedSet, ...selections.filter((_, j) => j !== i).filter(Boolean)]);
        return (
          <select
            key={i}
            value={sel}
            onChange={e => handleChange(i, e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">— Elige idioma —</option>
            <optgroup label="Estándar">
              {(STANDARD_LANGUAGES as readonly string[]).filter(l => !otherPicked.has(l) || l === sel).map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </optgroup>
            <optgroup label="Exótico">
              {(EXOTIC_LANGUAGES as readonly string[]).filter(l => !otherPicked.has(l) || l === sel).map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </optgroup>
          </select>
        );
      })}
    </div>
  );
}

interface CoreTabProps extends CharacterFormProps {
  classes: PlayerClassEntry[];
  hpRolls: HpRollEntry[];
  feats: FeatEntry[];
  skillProfs: string[];
  skillExpert: string[];
  handleBgSelect: (newBg: string) => void;
  requestBgUnlock: () => void;
  setActiveTab: (tab: "core" | "abilities" | "skills" | "combat" | "spells" | "inventory" | "backstory") => void;
  setExpertiseModal: (v: { slots: number } | null) => void;
  setExpertisePick: (v: Set<string>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

export function CoreTab({
  form, set, classes, hpRolls, feats,
  skillProfs, skillExpert,
  handleBgSelect, requestBgUnlock,
  setActiveTab, setExpertiseModal, setExpertisePick, setForm,
}: CoreTabProps) {
  const bgLocked = form.backgroundLocked === true;
  const bgName = form.background as string | undefined;
  const bgData = bgName && bgName !== "Otro (homebrew)" ? (BACKGROUND_DATA[bgName] ?? null) : null;
  const bgSkills: string[] = bgData?.skillProficiencies ?? [];

  const level = totalLevel(classes) || 1;
  const pb = proficiencyBonus(level);

  const finalDex = finalAbilityScore(form.dexterity   ?? 10, "dexterity",    feats);
  const finalCon = finalAbilityScore(form.constitution ?? 10, "constitution", feats);
  const finalWis = finalAbilityScore(form.wisdom       ?? 10, "wisdom",       feats);
  const finalInt = finalAbilityScore(form.intelligence ?? 10, "intelligence", feats);
  const finalCha = finalAbilityScore(form.charisma     ?? 10, "charisma",     feats);

  const calcedHpMax = calcHpMaxFromRolls(hpRolls, classes, finalCon, form.hpUseAverage ?? true);
  const calcedAC_   = calcAC(form.equippedArmor ?? null, finalDex, form.shield ?? false, finalCon, finalWis);

  const initiativeBonus  = initiativeBonusFromFeats(feats);
  const calcedInitiative = calcInitiative(finalDex, feats);

  const raceStr: string = form.race ?? "";
  const raceMatch = raceStr.match(/^(.+?) \((.+)\)$/);
  const currentSpecies = raceMatch ? (raceMatch[1] ?? raceStr) : raceStr;
  const calcedSpeed = calcSpeed(currentSpecies, classes, feats);

  const fixedLanguages: string[] = LANGUAGES_BY_SPECIES[currentSpecies] ?? ["Común"];
  const totalExtraLangCount = (EXTRA_LANGUAGES_BY_SPECIES[currentSpecies] ?? 0) + (bgData?.languages ?? 0);

  const currentVariant = raceMatch ? raceMatch[2] : "";
  const speciesVariants = currentSpecies && Object.prototype.hasOwnProperty.call(DND_SPECIES_VARIANTS, currentSpecies)
    ? DND_SPECIES_VARIANTS[currentSpecies] ?? []
    : [];

  const spellcastingClasses = classes.filter(c => isClassSpellcaster(c.class, c.subclass));
  const hasSpellcasting     = spellcastingClasses.length > 0;
  const primarySpellClass   = hasSpellcasting
    ? spellcastingClasses.reduce((a, b) => a.level >= b.level ? a : b)
    : null;
  const detectedSpellAbility = primarySpellClass
    ? (SPELLCASTING_ABILITY_BY_CLASS[primarySpellClass.class]
       ?? (THIRD_CASTER_SUBCLASSES[primarySpellClass.class] === primarySpellClass.subclass
           ? (primarySpellClass.class === "Guerrero" ? "intelligence" : "charisma")
           : null))
    : null;

  const spellAbilityKey = ((form.spellcastingAbility || detectedSpellAbility) ?? null) as "wisdom" | "intelligence" | "charisma" | null;
  const spellAbilityScore =
    spellAbilityKey === "wisdom"       ? finalWis :
    spellAbilityKey === "intelligence" ? finalInt :
    spellAbilityKey === "charisma"     ? finalCha :
    null;
  const calcDC     = spellAbilityScore !== null ? calcSpellSaveDC(spellAbilityScore, level)     : null;
  const calcAttack = spellAbilityScore !== null ? calcSpellAttackBonus(spellAbilityScore, level) : null;

  const hasPerceptionProf = skillProfs.includes("Perception");
  const hasPerceptionExp  = skillExpert.includes("Perception");
  const calcPassivePerc   = calcPassivePerception(finalWis, level, hasPerceptionProf, hasPerceptionExp);

  const SPECIES_VARIANT_LABEL: Record<string, string> = {
    "Dracónido": "Ascendencia",
    "Elfo": "Linaje",
    "Gnomo": "Linaje",
    "Goliath": "Ascendencia",
    "Tiefling": "Legado",
  };

  function applySpecies(newSpecies: string) {
    setForm(prev => {
      const oldSpecies = (prev.race as string | undefined)?.replace(/ \(.+\)$/, "") ?? "";
      const featsArr: FeatEntry[] = (() => { try { return JSON.parse(prev.feats ?? "[]"); } catch { return []; } })();
      const classesArr: PlayerClassEntry[] = (() => { try { return JSON.parse(prev.classes ?? "[]"); } catch { return []; } })();

      const withoutSpeciesFeat = featsArr.filter(f => !(f.classIndex === -2 && f.level === 0));
      const newFeats = SPECIES_WITH_ORIGIN_FEAT.has(newSpecies) && !SPECIES_WITH_ORIGIN_FEAT.has(oldSpecies)
        ? [...withoutSpeciesFeat, { name: "", classIndex: -2, level: 0, statBonuses: [] }]
        : SPECIES_WITH_ORIGIN_FEAT.has(oldSpecies) && !SPECIES_WITH_ORIGIN_FEAT.has(newSpecies)
          ? withoutSpeciesFeat
          : featsArr;

      const classWeaponProfs = classesArr.flatMap(c => WEAPON_PROFICIENCIES_BY_CLASS[c.class] ?? []);
      const speciesWeaponProfsArr = WEAPON_PROFICIENCIES_BY_SPECIES[newSpecies] ?? [];
      const weaponProfs = [...new Set([...classWeaponProfs, ...speciesWeaponProfsArr])];

      const languages = (LANGUAGES_BY_SPECIES[newSpecies] ?? ["Común"]).join(", ");

      const oldSpeciesSkills = FIXED_SKILL_PROFICIENCIES_BY_SPECIES[oldSpecies] ?? [];
      const newSpeciesSkills = FIXED_SKILL_PROFICIENCIES_BY_SPECIES[newSpecies] ?? [];
      const curSkillProfs: string[] = (() => { try { return JSON.parse(prev.skillProficiencies ?? "[]"); } catch { return []; } })();
      const curSkillExpert: string[] = (() => { try { return JSON.parse(prev.skillExpertise ?? "[]"); } catch { return []; } })();
      const skillProfsUpdated = [...new Set([...curSkillProfs.filter(k => !oldSpeciesSkills.includes(k)), ...newSpeciesSkills])];
      const skillExpertUpdated = curSkillExpert.filter(k => skillProfsUpdated.includes(k));

      return {
        ...prev,
        race:                 newSpecies,
        feats:                JSON.stringify(newFeats),
        weaponProficiencies:  weaponProfs.join(", "),
        languages,
        skillProficiencies:   JSON.stringify(skillProfsUpdated),
        skillExpertise:       JSON.stringify(skillExpertUpdated),
      };
    });
  }

  function setVariant(variant: string) {
    set("race", variant ? `${currentSpecies} (${variant})` : currentSpecies);
  }

  function togglePerceptionProf(checked: boolean) {
    const next = checked
      ? [...skillProfs, "Perception"]
      : skillProfs.filter(k => k !== "Perception");
    set("skillProficiencies", JSON.stringify(next));
    if (!checked) {
      set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== "Perception")));
    }
  }

  function togglePerceptionExp(checked: boolean) {
    if (checked) {
      set("skillExpertise", JSON.stringify([...skillExpert, "Perception"]));
      if (!hasPerceptionProf) {
        set("skillProficiencies", JSON.stringify([...skillProfs, "Perception"]));
      }
    } else {
      set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== "Perception")));
    }
  }

  return (
          <div className="space-y-6">
            <SectionTitle>Clases</SectionTitle>
            <ClassesPanel
              classes={classes.length > 0 ? classes : [{ class: form.class ?? "Guerrero", level: form.level ?? 1, subclass: form.subclass ?? "" }]}
              onChange={updated => {
                set("classes", JSON.stringify(updated));

                const oldClassSavesSet = new Set(classes.flatMap(c => SAVING_THROWS_BY_CLASS[c.class] ?? []));
                const newClassSaves = [...new Set(updated.flatMap(c => SAVING_THROWS_BY_CLASS[c.class] ?? []))];
                const curSaves: string[] = (() => { try { return JSON.parse(form.savingThrows ?? "[]"); } catch { return []; } })();
                const manualSaves = curSaves.filter(s => !oldClassSavesSet.has(s));
                set("savingThrows", JSON.stringify([...new Set([...newClassSaves, ...manualSaves])]));

                const armorProfs = [...new Set(updated.flatMap(c => ARMOR_PROFICIENCIES_BY_CLASS[c.class] ?? []))];
                set("armorProficiencies", armorProfs.join(", "));

                const speciesForProf = (form.race as string ?? "").replace(/ \(.+\)$/, "");
                const classWeaponProfs = updated.flatMap(c => WEAPON_PROFICIENCIES_BY_CLASS[c.class] ?? []);
                const speciesWeaponProfsArr = WEAPON_PROFICIENCIES_BY_SPECIES[speciesForProf] ?? [];
                set("weaponProficiencies", [...new Set([...classWeaponProfs, ...speciesWeaponProfsArr])].join(", "));

                const spellClasses = updated.filter(c => SPELLCASTING_ABILITY_BY_CLASS[c.class] !== null);
                if (!form.spellcastingAbility && spellClasses.length > 0) {
                  const primary = spellClasses.reduce((a, b) => a.level >= b.level ? a : b);
                  const ability = SPELLCASTING_ABILITY_BY_CLASS[primary.class];
                  if (ability) set("spellcastingAbility", ability);
                }
                if (spellClasses.length === 0) {
                  set("spellcastingAbility", null);
                }

                const prevExpertiseSlots = expertiseSlotsFromClasses(classes);
                const nextExpertiseSlots = expertiseSlotsFromClasses(updated);
                const gained = nextExpertiseSlots - prevExpertiseSlots;
                if (gained > 0) {
                  setExpertisePick(new Set());
                  setExpertiseModal({ slots: gained });
                  setActiveTab("skills");
                }
              }}
            />

            <SectionTitle>Información básica</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre"><Input value={form.name} onChange={v => set("name", v)} /></Field>
              <Field label="Jugador"><Input value={form.playerName} onChange={v => set("playerName", v)} /></Field>
              <Field label="Especie">
                <Select value={currentSpecies} onChange={applySpecies} options={[...DND_SPECIES, "Otra (homebrew)"]} placeholder="Selecciona especie..." />
              </Field>
              {speciesVariants.length > 0 ? (
                <Field label={(currentSpecies ? SPECIES_VARIANT_LABEL[currentSpecies] : undefined) ?? "Linaje"}>
                  <Select value={currentVariant} onChange={setVariant} options={speciesVariants} placeholder={`Selecciona...`} />
                </Field>
              ) : (
                <Field label="Trasfondo">
                  {bgLocked ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{form.background}</span>
                      </div>
                      <button
                        onClick={requestBgUnlock}
                        className="px-2 py-1 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded text-xs text-stone-400 hover:text-stone-200 transition-colors flex items-center gap-1"
                        title="Cambiar trasfondo"
                      >
                        <LockOpen className="w-3 h-3" /> Cambiar
                      </button>
                    </div>
                  ) : (
                    <Select value={form.background} onChange={handleBgSelect} options={[...DND_BACKGROUNDS, "Otro (homebrew)"]} placeholder="Selecciona trasfondo..." />
                  )}
                  {bgData && (
                    <p className="text-xs text-stone-500 mt-1">
                      <span className="text-amber-400 font-semibold">Dote:</span> {bgData.feat}
                      <span className="ml-2 text-stone-600">·</span>
                      <span className="ml-2 text-stone-500">{bgSkills.join(", ")}</span>
                    </p>
                  )}
                </Field>
              )}
              {speciesVariants.length > 0 && (
                <Field label="Trasfondo">
                  {bgLocked ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{form.background}</span>
                      </div>
                      <button
                        onClick={requestBgUnlock}
                        className="px-2 py-1 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded text-xs text-stone-400 hover:text-stone-200 transition-colors flex items-center gap-1"
                        title="Cambiar trasfondo"
                      >
                        <LockOpen className="w-3 h-3" /> Cambiar
                      </button>
                    </div>
                  ) : (
                    <Select value={form.background} onChange={handleBgSelect} options={[...DND_BACKGROUNDS, "Otro (homebrew)"]} placeholder="Selecciona trasfondo..." />
                  )}
                  {bgData && (
                    <p className="text-xs text-stone-500 mt-1">
                      <span className="text-amber-400 font-semibold">Dote:</span> {bgData.feat}
                      <span className="ml-2 text-stone-600">·</span>
                      <span className="ml-2 text-stone-500">{bgSkills.join(", ")}</span>
                    </p>
                  )}
                </Field>
              )}
              <Field label="Alineamiento">
                <Select value={form.alignment} onChange={v => set("alignment", v)} options={DND_ALIGNMENTS} placeholder="Selecciona alineamiento..." />
              </Field>
              <Field label="Puntos de experiencia">
                <NumberInput value={form.experiencePoints} onChange={v => set("experiencePoints", v)} min={0} />
              </Field>
            </div>

            <SectionTitle>HP por nivel</SectionTitle>
            <HpRollsPanel
              hpRolls={hpRolls}
              classes={classes}
              conScore={form.constitution ?? 10}
              useAverage={form.hpUseAverage ?? true}
              onRollsChange={rolls => set("hpRolls", JSON.stringify(rolls))}
              onMethodChange={useAvg => set("hpUseAverage", useAvg)}
            />

            <SectionTitle>Clase de armadura</SectionTitle>
            <div className="space-y-3">
              <select
                value={form.equippedArmor ?? "none"}
                onChange={e => set("equippedArmor", e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              >
                <optgroup label="SIN ARMADURA">
                  <option value="none">Sin armadura (10 + DES)</option>
                  <option value="unarmoredBarbarian">Defensa sin armadura — Bárbaro (10+DES+CON)</option>
                  <option value="unarmoredMonk">Defensa sin armadura — Monje (10+DES+SAB)</option>
                </optgroup>
                <optgroup label="LIGERA">
                  <option value="leather">Cuero (CA 11 + DES)</option>
                  <option value="studdedLeather">Cuero tachonado (CA 12 + DES)</option>
                </optgroup>
                <optgroup label="MEDIA">
                  <option value="hide">Pieles (CA 12 + DES máx.+2)</option>
                  <option value="chainShirt">Cota de mallas ligera (CA 13 + DES máx.+2)</option>
                  <option value="scaleMail">Cota de escamas (CA 14 + DES máx.+2)</option>
                  <option value="breastplate">Coraza (CA 14 + DES máx.+2)</option>
                  <option value="halfPlate">Medio arnés (CA 15 + DES máx.+2)</option>
                </optgroup>
                <optgroup label="PESADA">
                  <option value="ringMail">Cota de anillas (CA 14)</option>
                  <option value="chainMail">Cota de mallas (CA 16)</option>
                  <option value="splint">Armadura de bandas (CA 17)</option>
                  <option value="plate">Armadura de placas (CA 18)</option>
                </optgroup>
              </select>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.shield ?? false}
                    onChange={e => set("shield", e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  Escudo equipado <span className="text-emerald-400 text-xs">(+2 CA)</span>
                </label>
                <div className="text-center bg-stone-900 border border-stone-800 rounded-lg px-5 py-2">
                  <p className="text-xs text-stone-500 mb-0.5">CA</p>
                  <p className="text-2xl font-bold text-amber-400">{calcedAC_}</p>
                </div>
              </div>
            </div>

            <SectionTitle>Combate</SectionTitle>
            <div className="grid grid-cols-4 gap-4">
              <Field label="HP máx (calculado)">
                <div className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-amber-400 font-bold text-center">
                  {calcedHpMax}
                </div>
              </Field>
              <Field label="HP actual"><NumberInput value={form.hp} onChange={v => set("hp", v)} /></Field>
              <Field label="HP temporal"><NumberInput value={form.hpTemp} onChange={v => set("hpTemp", v)} /></Field>
              <Field label="Velocidad">
                <div
                  className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                  title={`Base especie: ${baseSpeedForSpecies(currentSpecies)} ft · Clase: +${speedBonusFromClasses(classes)} ft · Dotes: +${speedBonusFromFeats(feats)} ft`}
                >
                  <span className="text-amber-400 font-bold text-base">
                    {form.speed != null ? form.speed : calcedSpeed} ft
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">Calculado: {calcedSpeed} ft</p>
                <input
                  type="number"
                  value={form.speed ?? ""}
                  onChange={e => set("speed", e.target.value === "" ? null : parseInt(e.target.value))}
                  placeholder="Override (ft)..."
                  min={0}
                  aria-label="Override de velocidad"
                  className="w-full mt-1 bg-stone-900 border border-stone-600 rounded px-2 py-0.5 text-stone-400 text-xs text-center focus:outline-none focus:border-amber-500"
                />
              </Field>
              <Field label="Iniciativa">
                <div
                  className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                  title={`DES ${abilityModifier(finalDex) >= 0 ? "+" : ""}${abilityModifier(finalDex)}${initiativeBonus !== 0 ? ` + dotes (${initiativeBonus >= 0 ? "+" : ""}${initiativeBonus})` : ""}`}
                >
                  <span className="text-amber-400 font-bold text-base">
                    {calcedInitiative >= 0 ? `+${calcedInitiative}` : calcedInitiative}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  DES {abilityModifier(finalDex) >= 0 ? "+" : ""}{abilityModifier(finalDex)}
                  {initiativeBonus !== 0 && ` + dotes ${initiativeBonus >= 0 ? "+" : ""}${initiativeBonus}`}
                </p>
              </Field>
              <Field label="Percepción pasiva">
                <div
                  className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                  title={`10 + SAB (${abilityModifier(finalWis) >= 0 ? "+" : ""}${abilityModifier(finalWis)})${hasPerceptionExp ? ` + maestría (+${pb * 2})` : hasPerceptionProf ? ` + competencia (+${pb})` : ""}`}
                >
                  <span className="text-amber-400 font-bold text-base">{calcPassivePerc}</span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  10 + SAB{hasPerceptionExp ? " + maestría" : hasPerceptionProf ? " + comp." : ""}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPerceptionProf || hasPerceptionExp}
                      onChange={e => togglePerceptionProf(e.target.checked)}
                      className="accent-amber-500 w-3 h-3"
                    />
                    <span className="text-xs text-stone-500">Comp.</span>
                  </label>
                  {hasPerceptionProf && (
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasPerceptionExp}
                        onChange={e => togglePerceptionExp(e.target.checked)}
                        className="accent-purple-500 w-3 h-3"
                      />
                      <span className="text-xs text-stone-500">Maestría</span>
                    </label>
                  )}
                </div>
              </Field>
              <Field label="Dados de vida (auto)">
                <div className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-400 text-sm text-center">
                  {classes.map(c => `${c.level}d${HIT_DIE_BY_CLASS[c.class] ?? 8}`).join(" + ") || "—"}
                </div>
              </Field>
            </div>

            <SectionTitle>Dotes y mejoras de característica</SectionTitle>
            <FeatsPanel
              feats={feats}
              classes={classes}
              onChange={updated => set("feats", JSON.stringify(updated))}
            />

            {hasSpellcasting && (
              <>
                <SectionTitle>Conjuros</SectionTitle>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Característica de conjuro">
                    <select
                      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-sm text-stone-100"
                      value={form.spellcastingAbility ?? ""}
                      onChange={e => set("spellcastingAbility", e.target.value || null)}
                    >
                      <option value="">
                        — Auto ({detectedSpellAbility === "wisdom" ? "SAB" : detectedSpellAbility === "intelligence" ? "INT" : detectedSpellAbility === "charisma" ? "CAR" : "—"}) —
                      </option>
                      <option value="wisdom">SAB (Sabiduría)</option>
                      <option value="intelligence">INT (Inteligencia)</option>
                      <option value="charisma">CAR (Carisma)</option>
                    </select>
                  </Field>
                  <Field label="CD de salvación">
                    <div
                      className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                      title={`8 + comp. (+${pb}) + mod (${abilityModifier(spellAbilityScore ?? 10) >= 0 ? "+" : ""}${abilityModifier(spellAbilityScore ?? 10)})`}
                    >
                      <span className="text-amber-400 font-bold text-base">{calcDC ?? "—"}</span>
                    </div>
                    {calcDC !== null && <p className="text-xs text-stone-500 mt-0.5">8 + comp. + mod = {calcDC}</p>}
                  </Field>
                  <Field label="Bonif. de ataque">
                    <div
                      className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-center"
                      title={`comp. (+${pb}) + mod (${abilityModifier(spellAbilityScore ?? 10) >= 0 ? "+" : ""}${abilityModifier(spellAbilityScore ?? 10)})`}
                    >
                      <span className="text-amber-400 font-bold text-base">
                        {calcAttack !== null ? (calcAttack >= 0 ? `+${calcAttack}` : calcAttack) : "—"}
                      </span>
                    </div>
                    {calcAttack !== null && <p className="text-xs text-stone-500 mt-0.5">comp. + mod = {calcAttack >= 0 ? `+${calcAttack}` : calcAttack}</p>}
                  </Field>
                </div>
              </>
            )}

            <SectionTitle>Competencias</SectionTitle>
            <div className="space-y-3">
              <Field label="Armaduras"><Input value={form.armorProficiencies} onChange={v => set("armorProficiencies", v)} placeholder="Armadura ligera, media..." /></Field>
              <Field label="Armas"><Input value={form.weaponProficiencies} onChange={v => set("weaponProficiencies", v)} /></Field>
              <Field label="Herramientas"><Input value={form.toolProficiencies} onChange={v => set("toolProficiencies", v)} /></Field>
              <Field label="Idiomas">
                <LanguagePicker
                  fixedLanguages={fixedLanguages}
                  extraCount={totalExtraLangCount}
                  value={form.languages ?? ""}
                  onChange={v => set("languages", v)}
                />
              </Field>
            </div>
          </div>
  );
}
