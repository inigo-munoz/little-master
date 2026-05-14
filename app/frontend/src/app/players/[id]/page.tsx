"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Shield, Heart, Star, Zap, ChevronLeft, Save, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { AppShell } from "../../../components/layout/AppShell";
import { api } from "../../../lib/api";
import {
  DND_CLASSES,
  DND_SPECIES,
  DND_SPECIES_VARIANTS,
  DND_BACKGROUNDS,
  DND_ALIGNMENTS,
  SPELLCASTING_ABILITY_BY_CLASS,
  HIT_DIE_BY_CLASS,
  baseSpeedForSpecies,
  BACKGROUND_DATA,
  CLASS_SKILLS_OPTIONS,
  SPECIES_WITH_ORIGIN_FEAT,
  SAVING_THROWS_BY_CLASS,
  WEAPON_LIST,
  WEAPON_MASTERIES,
  ARMOR_PROFICIENCIES_BY_CLASS,
  WEAPON_PROFICIENCIES_BY_CLASS,
  WEAPON_PROFICIENCIES_BY_SPECIES,
  FIXED_SKILL_PROFICIENCIES_BY_SPECIES,
  LANGUAGES_BY_SPECIES,
  EXTRA_LANGUAGES_BY_SPECIES,
  STANDARD_LANGUAGES,
  EXOTIC_LANGUAGES,
  PACT_MAGIC_CLASS,
  WARLOCK_PACT_MAGIC,
  SPELL_LISTS_BY_CLASS,
  THIRD_CASTER_SUBCLASSES,
  isClassSpellcaster,
  type SpellListEntry,
} from "../../../lib/dnd-2024-data";
import {
  abilityModifier,
  proficiencyBonus,
  calcPassivePerception,
  calcSpellSaveDC,
  calcSpellAttackBonus,
  totalLevel,
  finalAbilityScore,
  calcHpMaxFromRolls,
  calcAC,
  initiativeBonusFromFeats,
  calcInitiative,
  speedBonusFromClasses,
  speedBonusFromFeats,
  calcSpeed,
  expertiseSlotsFromClasses,
  expertiseSlotsFromFeats,
  calcSuggestedSpellSlots,
  type PlayerClassEntry,
  type HpRollEntry,
  type FeatEntry,
  type WeaponEntry,
  type SpellEntry,
} from "../../../lib/player-calcs";
import { type SpellFullData } from "../../../lib/api";
import { ClassesPanel } from "./ClassesPanel";
import { HpRollsPanel } from "./HpRollsPanel";
import { FeatsPanel } from "./FeatsPanel";


const ABILITIES = [
  { key: "strength", label: "FUE", full: "Fuerza" },
  { key: "dexterity", label: "DES", full: "Destreza" },
  { key: "constitution", label: "CON", full: "Constitución" },
  { key: "intelligence", label: "INT", full: "Inteligencia" },
  { key: "wisdom", label: "SAB", full: "Sabiduría" },
  { key: "charisma", label: "CAR", full: "Carisma" },
] as const;

const SKILLS = [
  { key: "Acrobatics", label: "Acrobacias", ability: "dexterity" },
  { key: "AnimalHandling", label: "Trato con animales", ability: "wisdom" },
  { key: "Arcana", label: "Arcanos", ability: "intelligence" },
  { key: "Athletics", label: "Atletismo", ability: "strength" },
  { key: "Deception", label: "Engaño", ability: "charisma" },
  { key: "History", label: "Historia", ability: "intelligence" },
  { key: "Insight", label: "Perspicacia", ability: "wisdom" },
  { key: "Intimidation", label: "Intimidación", ability: "charisma" },
  { key: "Investigation", label: "Investigación", ability: "intelligence" },
  { key: "Medicine", label: "Medicina", ability: "wisdom" },
  { key: "Nature", label: "Naturaleza", ability: "intelligence" },
  { key: "Perception", label: "Percepción", ability: "wisdom" },
  { key: "Performance", label: "Actuación", ability: "charisma" },
  { key: "Persuasion", label: "Persuasión", ability: "charisma" },
  { key: "Religion", label: "Religión", ability: "intelligence" },
  { key: "SleightOfHand", label: "Juego de manos", ability: "dexterity" },
  { key: "Stealth", label: "Sigilo", ability: "dexterity" },
  { key: "Survival", label: "Supervivencia", ability: "wisdom" },
] as const;

type SlotEntry = { max: number; used: number };

function parseSlotData(raw: string): Record<string, SlotEntry> {
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(raw); } catch { /* ok */ }
  const result: Record<string, SlotEntry> = {};
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val === "number") {
      result[key] = { max: val, used: 0 };
    } else if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      result[key] = {
        max:  typeof obj.max  === "number" ? obj.max  : 0,
        used: typeof obj.used === "number" ? obj.used : 0,
      };
    }
  }
  return result;
}

function weaponOptionLabel(d: { label: string; ability: string; properties?: string }): string {
  const tags: string[] = [];
  if (d.properties?.includes("Ligera")) tags.push("Ligera");
  if (d.ability === "finesse") tags.push("Sutil");
  return tags.length > 0 ? `${d.label}  ·  ${tags.join(" · ")}` : d.label;
}


function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 border-b border-stone-800 pb-1">
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-stone-500 mb-0.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder = "" }: {
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
    />
  );
}

function Select({ value, onChange, options, placeholder, disabled }: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: readonly string[] | string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <option value="">{placeholder ?? "—"}</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function NumberInput({ value, onChange, min, max }: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      onChange={e => onChange(e.target.value === "" ? null : parseInt(e.target.value))}
      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-sm focus:outline-none focus:border-amber-500 text-center"
    />
  );
}

function AbilityBox({
  ability, value, featBonus = 0, onChange,
  saveFromClass, hasSave, saveTotal, saveSourceClass, onSaveToggle,
}: {
  ability: typeof ABILITIES[number];
  value: number | null | undefined;
  featBonus?: number;
  onChange: (v: number | null) => void;
  saveFromClass?: boolean;
  hasSave?: boolean;
  saveTotal?: number;
  saveSourceClass?: string;
  onSaveToggle?: (checked: boolean) => void;
}) {
  const baseScore = value ?? 10;
  const finalScore = Math.min(30, Math.max(1, baseScore + featBonus));
  const m = abilityModifier(finalScore);
  const modStr = m >= 0 ? `+${m}` : `${m}`;
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 text-center">
      <p className="text-xs text-amber-500 font-bold uppercase mb-1">{ability.label}</p>
      <p className="text-2xl font-bold text-stone-100 mb-1">{modStr}</p>
      <input
        type="number"
        value={value ?? ""}
        min={1} max={30}
        onChange={e => onChange(e.target.value === "" ? null : parseInt(e.target.value))}
        className="w-full bg-stone-900 border border-stone-600 rounded px-1 py-0.5 text-stone-300 text-sm text-center focus:outline-none focus:border-amber-500"
        placeholder="—"
      />
      {featBonus !== 0 && (
        <p className="text-xs text-stone-500 mt-0.5">{baseScore} + {featBonus} = {finalScore}</p>
      )}
      {onSaveToggle !== undefined && (
        <div className="mt-2 pt-2 border-t border-stone-700 flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={hasSave ?? false}
            disabled={saveFromClass}
            onChange={e => onSaveToggle(e.target.checked)}
            className={`${saveFromClass ? "accent-sky-500" : "accent-amber-500"} disabled:cursor-default`}
            title={saveSourceClass ? `Competencia de clase: ${saveSourceClass}` : "Tirada de salvación"}
          />
          <span className="text-[10px] text-stone-400 flex-1 text-left">Salvación</span>
          {saveFromClass && (
            <span className="text-[10px] font-bold bg-sky-900/60 text-sky-300 px-1 rounded" title={`Clase: ${saveSourceClass}`}>C</span>
          )}
          <span className={`text-xs font-mono font-bold ${hasSave ? "text-amber-400" : "text-stone-500"}`}>
            {(saveTotal ?? 0) >= 0 ? `+${saveTotal}` : saveTotal}
          </span>
        </div>
      )}
    </div>
  );
}

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

function CharacterSheetContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveError, setSaveError]             = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"core" | "abilities" | "skills" | "combat" | "spells" | "inventory" | "backstory">("core");
  const [expertiseModal, setExpertiseModal] = useState<{ slots: number } | null>(null);
  const [expertisePick, setExpertisePick] = useState<Set<string>>(new Set());
  const [spellModalOpen, setSpellModalOpen] = useState(false);
  const [spellModalClass, setSpellModalClass] = useState("");
  const [spellModalLevel, setSpellModalLevel] = useState(0);
  const [spellSearch, setSpellSearch] = useState("");
  const [expandedSpellId, setExpandedSpellId] = useState<string | null>(null);
  const [spellDetailCache, setSpellDetailCache] = useState<Record<string, SpellFullData | null>>({});

  const { data: player, mutate } = useSWR(
    params.id ? `/player/${params.id}` : null,
    () => api.players.get(params.id)
  );

  const [form, setForm] = useState<Record<string, any>>({});
  const formInitialized = useRef(false);

  // Cálculo temprano de isSpellcaster (necesario antes del useEffect)
  const isSpellcasterEarly = (() => {
    let cls: PlayerClassEntry[] = [];
    try { cls = JSON.parse((form.classes as string | undefined) ?? "[]"); } catch { /* ok */ }
    return cls.some(c => isClassSpellcaster(c.class, c.subclass));
  })();

  // Popula el formulario con los datos del jugador al montar
  useEffect(() => {
    if (player && !formInitialized.current) {
      setForm(player);
      formInitialized.current = true;
    }
  }, [player]);

  // Oculta la pestaña Hechizos si el personaje pierde toda capacidad mágica
  useEffect(() => {
    if (!isSpellcasterEarly && activeTab === "spells") setActiveTab("core");
  }, [isSpellcasterEarly, activeTab]);

  function set(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function parseJson(v: string, fallback: any) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function applyBackground(newBg: string) {
    const newData  = newBg && newBg !== "Otro (homebrew)" ? (BACKGROUND_DATA[newBg] ?? null) : null;
    setForm(prev => {
      const oldBgName = prev.background as string | undefined;
      const oldData   = oldBgName && oldBgName !== "Otro (homebrew)" ? (BACKGROUND_DATA[oldBgName] ?? null) : null;

      const skills: string[] = (() => { try { return JSON.parse(prev.skillProficiencies ?? "[]"); } catch { return []; } })();
      const feats: FeatEntry[] = (() => { try { return JSON.parse(prev.feats ?? "[]"); } catch { return []; } })();

      // Quitar habilidades del trasfondo anterior, añadir las del nuevo
      const withoutOld = oldData ? skills.filter(s => !oldData.skillProficiencies.includes(s)) : skills;
      const newSkills   = newData ? [...new Set([...withoutOld, ...newData.skillProficiencies])] : withoutOld;

      // Quitar dote del trasfondo anterior (classIndex -1, level 0), añadir la nueva
      const withoutBgFeat = feats.filter(f => !(f.classIndex === -1 && f.level === 0));
      const newFeats = newData?.feat
        ? [...withoutBgFeat, { name: newData.feat, classIndex: -1, level: 0, statBonuses: [] }]
        : withoutBgFeat;

      // Idiomas: reiniciar a idiomas fijos de la especie (extras se eligen con selectores)
      const speciesName = (prev.race as string | undefined)?.replace(/ \(.+\)$/, "") ?? "";
      const languages   = (LANGUAGES_BY_SPECIES[speciesName] ?? ["Común"]).join(", ");

      return {
        ...prev,
        background:          newBg,
        skillProficiencies:  JSON.stringify(newSkills),
        feats:               JSON.stringify(newFeats),
        languages,
        ...(newData ? { toolProficiencies: newData.toolProficiencies } : {}),
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      // Recalcular valores derivados antes de guardar
      const cls: PlayerClassEntry[] = parseJson(form.classes ?? "[]", []);
      const rolls: HpRollEntry[]    = parseJson(form.hpRolls ?? "[]", []);
      const fts: FeatEntry[]        = parseJson(form.feats ?? "[]", []);

      const fDex = finalAbilityScore(form.dexterity    ?? 10, "dexterity",    fts);
      const fCon = finalAbilityScore(form.constitution ?? 10, "constitution", fts);
      const fWis = finalAbilityScore(form.wisdom        ?? 10, "wisdom",       fts);

      const ac    = calcAC(form.equippedArmor ?? null, fDex, form.shield ?? false, fCon, fWis);
      const hpMax = calcHpMaxFromRolls(rolls, cls, fCon, form.hpUseAverage ?? true);
      const lvl   = totalLevel(cls) || 1;
      const pb    = proficiencyBonus(lvl);
      const hitDice = cls.map(c => `${c.level}d${HIT_DIE_BY_CLASS[c.class] ?? 8}`).join(" + ");
      const initiative      = calcInitiative(fDex, fts);
      const calcedSpeedSave = calcSpeed(currentSpecies, cls, fts);
      const speed = form.speed != null ? (form.speed as number) : calcedSpeedSave;

      const fInt = finalAbilityScore(form.intelligence ?? 10, "intelligence", fts);
      const fCha = finalAbilityScore(form.charisma     ?? 10, "charisma",     fts);
      const spellClsSave     = cls.filter(c => isClassSpellcaster(c.class, c.subclass));
      const primarySpellSave = spellClsSave.length > 0
        ? spellClsSave.reduce((a, b) => a.level >= b.level ? a : b)
        : null;
      const detectedAbilitySave = primarySpellSave
        ? (SPELLCASTING_ABILITY_BY_CLASS[primarySpellSave.class]
           ?? (THIRD_CASTER_SUBCLASSES[primarySpellSave.class] === primarySpellSave.subclass
               ? (primarySpellSave.class === "Guerrero" ? "intelligence" : "charisma")
               : null))
        : null;
      const resolvedAbilitySave = ((form.spellcastingAbility || detectedAbilitySave) ?? null) as "wisdom" | "intelligence" | "charisma" | null;
      const spellScoreSave =
        resolvedAbilitySave === "wisdom"       ? fWis :
        resolvedAbilitySave === "intelligence" ? fInt :
        resolvedAbilitySave === "charisma"     ? fCha : null;
      const spellSaveDC      = spellScoreSave !== null ? calcSpellSaveDC(spellScoreSave, lvl)      : undefined;
      const spellAttackBonus = spellScoreSave !== null ? calcSpellAttackBonus(spellScoreSave, lvl) : undefined;

      const skillProfsForSave: string[]  = parseJson(form.skillProficiencies ?? "[]", []);
      const skillExpertForSave: string[] = parseJson(form.skillExpertise     ?? "[]", []);
      const passivePerception = calcPassivePerception(
        fWis,
        lvl,
        skillProfsForSave.includes("Perception"),
        skillExpertForSave.includes("Perception"),
      );

      // Mantener class/level/subclass legacy sincronizados con la primera clase
      const firstClass = cls[0];

      await api.players.update(params.id, {
        ...form,
        ac,
        hpMax,
        initiative,
        speed,
        passivePerception,
        spellSaveDC,
        spellAttackBonus,
        level:            lvl,
        proficiencyBonus: pb,
        hitDice:          hitDice || undefined,
        class:            firstClass?.class   ?? undefined,
        subclass:         firstClass?.subclass ?? undefined,
      });
      await mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("Error al guardar la ficha. Inténtalo de nuevo.");
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaving(false);
    }
  }

  // ── Parsear campos JSON ──────────────────────────────────────────────────────
  const classes: PlayerClassEntry[] = parseJson(form.classes ?? "[]", []);
  const hpRolls: HpRollEntry[]      = parseJson(form.hpRolls ?? "[]", []);
  const feats: FeatEntry[]          = parseJson(form.feats ?? "[]", []);

  // isSpellcaster derivado de `classes` (versión definitiva — isSpellcasterEarly ya se usó en useEffect)
  const isSpellcaster = classes.some(c => isClassSpellcaster(c.class, c.subclass));

  // Datos del trasfondo seleccionado (null si homebrew o sin trasfondo)
  const bgName = form.background as string | undefined;
  const bgData = bgName && bgName !== "Otro (homebrew)" ? (BACKGROUND_DATA[bgName] ?? null) : null;
  const bgSkills: string[] = bgData?.skillProficiencies ?? [];

  // Habilidades disponibles desde las clases del personaje
  const classSkillOptions = new Set<string>(
    classes.flatMap(c => CLASS_SKILLS_OPTIONS[c.class] ?? [])
  );

  // Nivel total y proficiency bonus desde clases
  const level = totalLevel(classes) || 1;
  const pb = proficiencyBonus(level);

  // Puntuaciones finales de característica (base + bonos de dotes)
  const finalStr = finalAbilityScore(form.strength    ?? 10, "strength",     feats);
  const finalDex = finalAbilityScore(form.dexterity   ?? 10, "dexterity",    feats);
  const finalCon = finalAbilityScore(form.constitution ?? 10, "constitution", feats);
  const finalInt = finalAbilityScore(form.intelligence ?? 10, "intelligence", feats);
  const finalWis = finalAbilityScore(form.wisdom       ?? 10, "wisdom",       feats);
  const finalCha = finalAbilityScore(form.charisma     ?? 10, "charisma",     feats);

  // Feat bonuses por stat (para pasarlos a AbilityBox)
  const featBonuses: Record<string, number> = {
    strength:     finalStr - (form.strength     ?? 10),
    dexterity:    finalDex - (form.dexterity    ?? 10),
    constitution: finalCon - (form.constitution ?? 10),
    intelligence: finalInt - (form.intelligence ?? 10),
    wisdom:       finalWis - (form.wisdom        ?? 10),
    charisma:     finalCha - (form.charisma      ?? 10),
  };

  // CA automática
  const calcedAC = calcAC(
    form.equippedArmor ?? null,
    finalDex,
    form.shield ?? false,
    finalCon,
    finalWis,
  );

  // HP Máx automático
  const calcedHpMax = calcHpMaxFromRolls(hpRolls, classes, finalCon, form.hpUseAverage ?? true);

  const skillProfs: string[] = parseJson(form.skillProficiencies ?? "[]", []);
  const skillExpert: string[] = parseJson(form.skillExpertise ?? "[]", []);
  const saveProfs: string[] = parseJson(form.savingThrows ?? "[]", []);
  // Salvaciones otorgadas por las clases actuales (para bloqueo visual y cálculo)
  const classSaves: string[] = [...new Set(classes.flatMap(c => SAVING_THROWS_BY_CLASS[c.class] ?? []))];

  const hasPerceptionProf = skillProfs.includes("Perception");
  const hasPerceptionExp  = skillExpert.includes("Perception");
  const calcPassivePerc = calcPassivePerception(finalWis, level, hasPerceptionProf, hasPerceptionExp);

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

  const initiativeBonus  = initiativeBonusFromFeats(feats);
  const calcedInitiative = calcInitiative(finalDex, feats);

  // Especie + linaje
  const raceStr: string = form.race ?? "";
  const raceMatch = raceStr.match(/^(.+?) \((.+)\)$/);
  const currentSpecies = raceMatch ? (raceMatch[1] ?? raceStr) : raceStr;
  const calcedSpeed      = calcSpeed(currentSpecies, classes, feats);

  // Idiomas fijos (especie) y número de idiomas adicionales a elegir
  const fixedLanguages: string[] = LANGUAGES_BY_SPECIES[currentSpecies] ?? ["Común"];
  const totalExtraLangCount = (EXTRA_LANGUAGES_BY_SPECIES[currentSpecies] ?? 0) + (bgData?.languages ?? 0);

  // Habilidades otorgadas automáticamente por especie y slots de maestría disponibles
  const speciesSkills: string[] = FIXED_SKILL_PROFICIENCIES_BY_SPECIES[currentSpecies] ?? [];
  const expertiseSlots = expertiseSlotsFromClasses(classes) + expertiseSlotsFromFeats(feats);
  const currentVariant = raceMatch ? raceMatch[2] : "";
  const speciesVariants = currentSpecies && Object.prototype.hasOwnProperty.call(DND_SPECIES_VARIANTS, currentSpecies)
    ? DND_SPECIES_VARIANTS[currentSpecies] ?? []
    : [];

  function applySpecies(newSpecies: string) {
    setForm(prev => {
      const oldSpecies = (prev.race as string | undefined)?.replace(/ \(.+\)$/, "") ?? "";
      const featsArr: FeatEntry[] = (() => { try { return JSON.parse(prev.feats ?? "[]"); } catch { return []; } })();
      const classesArr: PlayerClassEntry[] = (() => { try { return JSON.parse(prev.classes ?? "[]"); } catch { return []; } })();

      // Feat de especie (Humano)
      const withoutSpeciesFeat = featsArr.filter(f => !(f.classIndex === -2 && f.level === 0));
      const newFeats = SPECIES_WITH_ORIGIN_FEAT.has(newSpecies) && !SPECIES_WITH_ORIGIN_FEAT.has(oldSpecies)
        ? [...withoutSpeciesFeat, { name: "", classIndex: -2, level: 0, statBonuses: [] }]
        : SPECIES_WITH_ORIGIN_FEAT.has(oldSpecies) && !SPECIES_WITH_ORIGIN_FEAT.has(newSpecies)
          ? withoutSpeciesFeat
          : featsArr;

      // Competencias de armas: clases actuales + nueva especie
      const classWeaponProfs = classesArr.flatMap(c => WEAPON_PROFICIENCIES_BY_CLASS[c.class] ?? []);
      const speciesWeaponProfs = WEAPON_PROFICIENCIES_BY_SPECIES[newSpecies] ?? [];
      const weaponProfs = [...new Set([...classWeaponProfs, ...speciesWeaponProfs])];

      // Idiomas: reiniciar a idiomas fijos de la nueva especie (extras se eligen con selectores)
      const languages = (LANGUAGES_BY_SPECIES[newSpecies] ?? ["Común"]).join(", ");

      // Habilidades de especie: quitar las de la especie anterior, añadir las nuevas
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

  // Label del subtipo varía según la especie
  const SPECIES_VARIANT_LABEL: Record<string, string> = {
    "Dracónido": "Ascendencia",
    "Elfo": "Linaje",
    "Gnomo": "Linaje",
    "Goliath": "Ascendencia",
    "Tiefling": "Legado",
  };
  // Armas
  const weapons: WeaponEntry[] = parseJson(form.weapons ?? "[]", []);

  function addWeapon() {
    const newWeapon: WeaponEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      weaponKey: "", customName: "", ability: "strength",
      magical: false, magicBonus: 0, extraDamage: false, extraDamageDesc: "",
    };
    set("weapons", JSON.stringify([...weapons, newWeapon]));
  }

  function removeWeapon(idx: number) {
    set("weapons", JSON.stringify(weapons.filter((_, i) => i !== idx)));
  }

  function updateWeapon(idx: number, patch: Partial<WeaponEntry>) {
    set("weapons", JSON.stringify(weapons.map((w, i) => i === idx ? { ...w, ...patch } : w)));
  }

  function handleWeaponSelect(idx: number, key: string) {
    const wData = key ? WEAPON_LIST[key] : null;
    const ability: "strength" | "dexterity" =
      wData?.ability === "dexterity" ? "dexterity"
      : wData?.ability === "finesse"  ? (weapons[idx]?.ability ?? "strength")
      : "strength";
    updateWeapon(idx, { weaponKey: key, ability });
  }

  // ── Hechizos ──────────────────────────────────────────────────────────────────
  const HALF_CASTER_CLASSES_SET = new Set(["Paladín", "Explorador"]);
  const spells: SpellEntry[] = parseJson(form.spells ?? "[]", []);
  const slotData = parseSlotData(form.spellSlots ?? "{}");

  const warlockEntry  = classes.find(c => c.class === PACT_MAGIC_CLASS);
  const pactMagic     = warlockEntry ? (WARLOCK_PACT_MAGIC[warlockEntry.level] ?? null) : null;

  const mainSpellClass = (() => {
    const fc = classes.find(c => SPELL_LISTS_BY_CLASS[c.class]?.[1] !== undefined && !HALF_CASTER_CLASSES_SET.has(c.class));
    if (fc) return fc.class;
    const hc = classes.find(c => HALF_CASTER_CLASSES_SET.has(c.class));
    if (hc) return hc.class;
    if (warlockEntry) return PACT_MAGIC_CLASS;
    return classes.find(c => isClassSpellcaster(c.class, c.subclass))?.class ?? "";
  })();

  async function toggleSpellExpand(spell: SpellEntry) {
    if (expandedSpellId === spell.id) {
      setExpandedSpellId(null);
      return;
    }
    setExpandedSpellId(spell.id);
    if (!(spell.name in spellDetailCache)) {
      const data = await api.spells.lookup(spell.name);
      setSpellDetailCache(prev => ({ ...prev, [spell.name]: data }));
    }
  }

  function addSpell(entry: SpellListEntry, level: number) {
    if (spells.some(s => s.name === entry.name && s.level === level)) return;
    const newSpell: SpellEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: entry.name,
      level,
      concentration: entry.concentration,
      ritual: entry.ritual,
    };
    set("spells", JSON.stringify([...spells, newSpell]));
  }

  function removeSpell(id: string) {
    set("spells", JSON.stringify(spells.filter(s => s.id !== id)));
  }

  function getSlot(key: string): SlotEntry {
    return slotData[key] ?? { max: 0, used: 0 };
  }

  function setSlot(key: string, used: number, max?: number) {
    const current = getSlot(key);
    const newMax  = max !== undefined ? max : current.max;
    const newUsed = Math.max(0, Math.min(newMax, used));
    const next = { ...slotData, [key]: { max: newMax, used: newUsed } };
    set("spellSlots", JSON.stringify(next));
  }

  function toggleBubble(key: string, bubbleIdx: number) {
    const current = getSlot(key);
    const newUsed = bubbleIdx < current.used ? bubbleIdx : bubbleIdx + 1;
    setSlot(key, newUsed);
  }

  function syncRegularSlots() {
    const suggested = calcSuggestedSpellSlots(classes);
    const next: Record<string, SlotEntry> = { ...slotData };
    for (const [lvl, max] of Object.entries(suggested)) {
      next[lvl] = { max, used: Math.min(slotData[lvl]?.used ?? 0, max) };
    }
    set("spellSlots", JSON.stringify(next));
  }

  function syncPactSlots() {
    if (!pactMagic) return;
    const next = { ...slotData, pact: { max: pactMagic.slots, used: Math.min(slotData["pact"]?.used ?? 0, pactMagic.slots) } };
    set("spellSlots", JSON.stringify(next));
  }

  function getSpellsForModal(): SpellListEntry[] {
    const classesToSearch = spellModalClass
      ? [spellModalClass]
      : Object.keys(SPELL_LISTS_BY_CLASS);
    const seen = new Set<string>();
    const all: SpellListEntry[] = [];
    for (const cls of classesToSearch) {
      for (const entry of (SPELL_LISTS_BY_CLASS[cls]?.[spellModalLevel] ?? [])) {
        if (!seen.has(entry.name)) { seen.add(entry.name); all.push(entry); }
      }
    }
    const q = spellSearch.trim().toLowerCase();
    const filtered = q ? all.filter(e => e.name.toLowerCase().includes(q)) : all;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  const TABS = [
    { id: "core", label: "Básico" },
    { id: "abilities", label: "Estadísticas" },
    { id: "skills", label: "Habilidades" },
    { id: "combat", label: "Combate" },
    { id: "spells", label: "Hechizos" },
    { id: "inventory", label: "Inventario" },
    { id: "backstory", label: "Trasfondo" },
  ] as const;
  const filteredTabs = TABS.filter(t => t.id !== "spells" || isSpellcaster);

  if (!player || Object.keys(form).length === 0) return (
    <AppShell>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-stone-600" />
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-stone-500 hover:text-stone-300 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-stone-100">{form.name}</h1>
              <p className="text-xs text-stone-500">
                {classes.length > 0
                  ? classes.map(c => `${c.class} ${c.level}`).join(" / ")
                  : (form.class ?? "Sin clase")} · Nivel {level} · {form.race}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSaveConfirm(true)}
            disabled={saving}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              saved
                ? "bg-emerald-700 text-white"
                : "bg-amber-600 hover:bg-amber-500 text-stone-950"
            )}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? "Guardado" : "Guardar"}
          </button>
        </div>

        {/* Quick stats bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: <Heart size={14} className="text-red-400" />, label: "HP", value: `${form.hp ?? "—"}/${calcedHpMax}`, sub: form.hpTemp ? `+${form.hpTemp} temp` : null },
            { icon: <Shield size={14} className="text-blue-400" />, label: "CA", value: calcedAC },
            { icon: <Zap size={14} className="text-yellow-400" />, label: "Iniciativa", value: calcedInitiative >= 0 ? `+${calcedInitiative}` : `${calcedInitiative}` },
            { icon: <Star size={14} className="text-amber-400" />, label: "Prof. Bonus", value: `+${pb}` },
          ].map(s => (
            <div key={s.label} className="bg-stone-900 border border-stone-800 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">{s.icon}<span className="text-xs text-stone-500">{s.label}</span></div>
              <p className="text-xl font-bold text-stone-100">{s.value}</p>
              {s.sub && <p className="text-xs text-stone-600">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-stone-800">
          {filteredTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                "px-3 py-2 text-sm transition-colors",
                activeTab === t.id
                  ? "text-amber-400 border-b-2 border-amber-400"
                  : "text-stone-500 hover:text-stone-300"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "core" && (
          <div className="space-y-6">
            <SectionTitle>Clases</SectionTitle>
            <ClassesPanel
              classes={classes.length > 0 ? classes : [{ class: form.class ?? "Guerrero", level: form.level ?? 1, subclass: form.subclass ?? "" }]}
              onChange={updated => {
                set("classes", JSON.stringify(updated));

                // Tiradas de salvación: quitar las de clases anteriores, añadir las nuevas
                const oldClassSavesSet = new Set(classes.flatMap(c => SAVING_THROWS_BY_CLASS[c.class] ?? []));
                const newClassSaves = [...new Set(updated.flatMap(c => SAVING_THROWS_BY_CLASS[c.class] ?? []))];
                const curSaves: string[] = (() => { try { return JSON.parse(form.savingThrows ?? "[]"); } catch { return []; } })();
                const manualSaves = curSaves.filter(s => !oldClassSavesSet.has(s));
                set("savingThrows", JSON.stringify([...new Set([...newClassSaves, ...manualSaves])]));

                // Competencias de armadura: unión de todas las clases
                const armorProfs = [...new Set(updated.flatMap(c => ARMOR_PROFICIENCIES_BY_CLASS[c.class] ?? []))];
                set("armorProficiencies", armorProfs.join(", "));

                // Competencias de armas: clase + especie actual
                const speciesForProf = (form.race as string ?? "").replace(/ \(.+\)$/, "");
                const classWeaponProfs = updated.flatMap(c => WEAPON_PROFICIENCIES_BY_CLASS[c.class] ?? []);
                const speciesWeaponProfs = WEAPON_PROFICIENCIES_BY_SPECIES[speciesForProf] ?? [];
                set("weaponProficiencies", [...new Set([...classWeaponProfs, ...speciesWeaponProfs])].join(", "));

                // Característica de conjuración
                const spellClasses = updated.filter(c => SPELLCASTING_ABILITY_BY_CLASS[c.class] !== null);
                if (!form.spellcastingAbility && spellClasses.length > 0) {
                  const primary = spellClasses.reduce((a, b) => a.level >= b.level ? a : b);
                  const ability = SPELLCASTING_ABILITY_BY_CLASS[primary.class];
                  if (ability) set("spellcastingAbility", ability);
                }
                if (spellClasses.length === 0) {
                  set("spellcastingAbility", null);
                }

                // Detectar nuevos slots de maestría y abrir modal si los hay
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
                  <Select value={form.background} onChange={applyBackground} options={[...DND_BACKGROUNDS, "Otro (homebrew)"]} placeholder="Selecciona trasfondo..." />
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
                  <Select value={form.background} onChange={applyBackground} options={[...DND_BACKGROUNDS, "Otro (homebrew)"]} placeholder="Selecciona trasfondo..." />
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
                  <p className="text-2xl font-bold text-amber-400">{calcedAC}</p>
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
        )}

        {activeTab === "abilities" && (() => {
          const finalScoreMap: Record<string, number> = {
            strength: finalStr, dexterity: finalDex, constitution: finalCon,
            intelligence: finalInt, wisdom: finalWis, charisma: finalCha,
          };
          return (
            <div className="space-y-4">
              <SectionTitle>Puntuaciones de característica</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                {ABILITIES.map(ability => {
                  const fromClass   = classSaves.includes(ability.key);
                  const hasSave     = fromClass || saveProfs.includes(ability.key);
                  const finalScore  = finalScoreMap[ability.key] ?? 10;
                  const saveTotal   = abilityModifier(finalScore) + (hasSave ? pb : 0);
                  const sourceClass = fromClass
                    ? classes.find(c => (SAVING_THROWS_BY_CLASS[c.class] ?? []).includes(ability.key))?.class
                    : undefined;
                  return (
                    <AbilityBox
                      key={ability.key}
                      ability={ability}
                      value={form[ability.key]}
                      featBonus={featBonuses[ability.key] ?? 0}
                      onChange={v => set(ability.key, v)}
                      saveFromClass={fromClass}
                      hasSave={hasSave}
                      saveTotal={saveTotal}
                      saveSourceClass={sourceClass}
                      onSaveToggle={checked => {
                        const next = checked
                          ? [...saveProfs, ability.key]
                          : saveProfs.filter(s => s !== ability.key);
                        set("savingThrows", JSON.stringify(next));
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })()}

        {activeTab === "skills" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <SectionTitle>Habilidades</SectionTitle>
              <span className="text-xs text-stone-500">Bono prof. +{pb}</span>
            </div>
            {expertiseSlots > 0 && (
              <p className="text-xs text-stone-500">
                Maestría: {skillExpert.length}/{expertiseSlots} slots usados
              </p>
            )}
            <div className="space-y-1">
              {SKILLS.map(s => {
                const fromBg      = bgSkills.includes(s.key);
                const fromSpecies = speciesSkills.includes(s.key);
                const isLocked    = fromBg || fromSpecies;
                const hasPro      = isLocked || skillProfs.includes(s.key);
                const hasExp      = skillExpert.includes(s.key);
                const usedSlots   = skillExpert.length;
                const canAddExp   = hasPro && (hasExp || usedSlots < expertiseSlots);

                const finalScoreMap: Record<string, number> = {
                  strength: finalStr, dexterity: finalDex, constitution: finalCon,
                  intelligence: finalInt, wisdom: finalWis, charisma: finalCha,
                };
                const abilScore = finalScoreMap[s.ability] ?? 10;
                const abilMod   = abilityModifier(abilScore);
                const bonus     = hasExp ? pb * 2 : hasPro ? pb : 0;
                const total     = abilMod + bonus;
                const foundAbil = ABILITIES.find(a => a.key === s.ability);

                const proAccent = fromBg      ? "accent-amber-500"
                                : fromSpecies ? "accent-emerald-500"
                                : hasPro      ? "accent-sky-400"
                                : "accent-stone-500";

                const rowBg = hasExp  ? "bg-amber-950/40 border border-amber-800/50"
                            : hasPro  ? "bg-stone-800/60"
                            : "hover:bg-stone-800/40";

                const nameColor = hasExp  ? "text-amber-300 font-medium"
                                : hasPro  ? "text-stone-200"
                                : "text-stone-400";

                const bonusColor = hasExp ? "text-amber-300" : hasPro ? "text-amber-400" : "text-stone-500";

                return (
                  <div key={s.key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${rowBg}`}>
                    {/* Checkbox de competencia */}
                    <input
                      type="checkbox"
                      checked={hasPro}
                      disabled={isLocked}
                      onChange={e => {
                        if (e.target.checked) {
                          set("skillProficiencies", JSON.stringify([...skillProfs, s.key]));
                        } else {
                          set("skillProficiencies", JSON.stringify(skillProfs.filter(k => k !== s.key)));
                          set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== s.key)));
                        }
                      }}
                      className={`${proAccent} disabled:opacity-70 cursor-pointer disabled:cursor-default`}
                      title={fromBg ? "Trasfondo" : fromSpecies ? "Especie" : "Competencia"}
                    />

                    {/* Checkbox de maestría — siempre visible, deshabilitado si no corresponde */}
                    <input
                      type="checkbox"
                      checked={hasExp}
                      disabled={!canAddExp}
                      onChange={e => {
                        if (e.target.checked) {
                          set("skillExpertise", JSON.stringify([...skillExpert, s.key]));
                          if (!hasPro) set("skillProficiencies", JSON.stringify([...skillProfs, s.key]));
                        } else {
                          set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== s.key)));
                        }
                      }}
                      className="accent-amber-400 disabled:opacity-20 cursor-pointer disabled:cursor-default"
                      title={
                        !hasPro             ? "Requiere competencia en esta habilidad primero"
                        : expertiseSlots === 0  ? "Requiere Pícaro nv.1, Bardo nv.3 o dote Skill Expert"
                        : !hasExp && usedSlots >= expertiseSlots ? `Sin slots disponibles (${usedSlots}/${expertiseSlots} usados)`
                        : "Maestría (bonif. competencia × 2)"
                      }
                    />

                    {/* Nombre de la habilidad */}
                    <span className={`text-sm flex-1 ${nameColor}`}>{s.label}</span>

                    {/* Badges de origen */}
                    <div className="flex items-center gap-1">
                      {fromBg && (
                        <span className="text-[10px] font-bold bg-amber-900/60 text-amber-300 px-1 rounded" title="Trasfondo">T</span>
                      )}
                      {fromSpecies && (
                        <span className="text-[10px] font-bold bg-emerald-900/60 text-emerald-300 px-1 rounded" title="Especie">E</span>
                      )}
                      {classSkillOptions.has(s.key) && (
                        <span className="text-[10px] font-bold bg-sky-900/60 text-sky-300 px-1 rounded" title="Opción de clase">C</span>
                      )}
                    </div>

                    <span className="text-xs text-stone-600 w-7 text-right">{foundAbil?.label}</span>
                    <span className={`text-sm font-mono font-bold w-8 text-right ${bonusColor}`}>
                      {total >= 0 ? `+${total}` : total}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-stone-600 pt-1 border-t border-stone-800">
              <span><span className="text-amber-300 font-bold">T</span> = trasfondo</span>
              <span><span className="text-emerald-300 font-bold">E</span> = especie</span>
              <span><span className="text-sky-300 font-bold">C</span> = opción de clase</span>
              {expertiseSlots > 0 && <span>★ = maestría ({skillExpert.length}/{expertiseSlots})</span>}
            </div>
          </div>
        )}

        {activeTab === "combat" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <SectionTitle>Armas</SectionTitle>
              <button
                onClick={addWeapon}
                className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-xs text-stone-300 transition-colors"
              >
                + Añadir arma
              </button>
            </div>

            {weapons.length === 0 && (
              <p className="text-stone-500 text-sm italic text-center py-10">
                Sin armas. Pulsa «Añadir arma» para registrar la primera.
              </p>
            )}

            {weapons.map((weapon, wi) => {
              const wData  = weapon.weaponKey ? WEAPON_LIST[weapon.weaponKey] : null;
              const isFinesse = wData?.ability === "finesse";
              const strMod = abilityModifier(finalStr);
              const dexMod = abilityModifier(finalDex);
              const abilMod   = weapon.ability === "dexterity" ? dexMod : strMod;
              const magBonus  = weapon.magical ? weapon.magicBonus : 0;
              const atkBonus  = pb + abilMod + magBonus;
              const dmgMod    = abilMod + magBonus;
              const damageDice = wData?.damageDice ?? "1d6";
              const dmgStr = damageDice === "—"
                ? "—"
                : `${damageDice}${dmgMod > 0 ? "+" + dmgMod : dmgMod < 0 ? dmgMod : ""}`;
              const displayName = weapon.customName || wData?.label || "Arma personalizada";

              return (
                <div key={weapon.id} className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3">
                  {/* Cabecera: nombre y eliminar */}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-200 text-sm flex-1">{displayName}</span>
                    {wData?.properties && (
                      <span className="text-[10px] text-stone-600 italic">{wData.properties}</span>
                    )}
                    <button
                      onClick={() => removeWeapon(wi)}
                      className="text-stone-600 hover:text-red-400 text-xs transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Fila 1: selector de arma + nombre personalizado */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-stone-500 mb-1">Arma base</p>
                      <select
                        value={weapon.weaponKey}
                        onChange={e => handleWeaponSelect(wi, e.target.value)}
                        className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                      >
                        <option value="">— Personalizada —</option>
                        <optgroup label="Simples cuerpo a cuerpo">
                          {Object.entries(WEAPON_LIST).filter(([, d]) => d.category === "simple-melee").map(([k, d]) => (
                            <option key={k} value={k}>{weaponOptionLabel(d)}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Simples a distancia">
                          {Object.entries(WEAPON_LIST).filter(([, d]) => d.category === "simple-ranged").map(([k, d]) => (
                            <option key={k} value={k}>{weaponOptionLabel(d)}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Marciales cuerpo a cuerpo">
                          {Object.entries(WEAPON_LIST).filter(([, d]) => d.category === "martial-melee").map(([k, d]) => (
                            <option key={k} value={k}>{weaponOptionLabel(d)}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Marciales a distancia">
                          {Object.entries(WEAPON_LIST).filter(([, d]) => d.category === "martial-ranged").map(([k, d]) => (
                            <option key={k} value={k}>{weaponOptionLabel(d)}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-1">Nombre personalizado</p>
                      <input
                        type="text"
                        value={weapon.customName}
                        onChange={e => updateWeapon(wi, { customName: e.target.value })}
                        placeholder={wData?.label ?? "Ej. Espada de los Dioses"}
                        className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Fila 2: característica + stats calculados */}
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <p className="text-xs text-stone-500 mb-1">Característica</p>
                      <select
                        value={weapon.ability}
                        disabled={!isFinesse && !!weapon.weaponKey}
                        onChange={e => updateWeapon(wi, { ability: e.target.value as "strength" | "dexterity" })}
                        className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-60 disabled:cursor-default"
                        title={isFinesse ? "Finesse: elige FUE o DES" : undefined}
                      >
                        <option value="strength">FUE ({strMod >= 0 ? "+" : ""}{strMod})</option>
                        <option value="dexterity">DES ({dexMod >= 0 ? "+" : ""}{dexMod})</option>
                      </select>
                    </div>
                    <div className="flex-1 flex gap-4 justify-end">
                      <div className="text-center">
                        <p className="text-xs text-stone-500 mb-0.5">Ataque</p>
                        <p className="text-2xl font-bold text-amber-400">{atkBonus >= 0 ? "+" : ""}{atkBonus}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-stone-500 mb-0.5">Daño</p>
                        <p className="text-lg font-bold text-stone-200">{dmgStr}</p>
                        {wData?.damageType && wData.damageType !== "—" && (
                          <p className="text-[10px] text-stone-600">{wData.damageType}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modificador mágico */}
                  <div className="pt-2 border-t border-stone-800 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={weapon.magical}
                        onChange={e => updateWeapon(wi, { magical: e.target.checked, magicBonus: e.target.checked ? (weapon.magicBonus || 1) : 0 })}
                        className="accent-amber-500"
                      />
                      <span className="text-xs text-stone-400">¿Es mágica?</span>
                    </label>

                    {weapon.magical && (
                      <div className="pl-5 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-stone-500 w-24">Bonif. mágico</span>
                          <select
                            value={weapon.magicBonus}
                            onChange={e => updateWeapon(wi, { magicBonus: parseInt(e.target.value) })}
                            className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-amber-300 text-xs font-bold focus:outline-none focus:border-amber-500"
                          >
                            {[0,1,2,3].map(n => <option key={n} value={n}>+{n}</option>)}
                          </select>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={weapon.extraDamage}
                            onChange={e => updateWeapon(wi, { extraDamage: e.target.checked })}
                            className="accent-amber-500"
                          />
                          <span className="text-xs text-stone-400">¿Daño extra?</span>
                        </label>
                        {weapon.extraDamage && (
                          <input
                            type="text"
                            value={weapon.extraDamageDesc}
                            onChange={e => updateWeapon(wi, { extraDamageDesc: e.target.value })}
                            placeholder="ej. 1d6 fuego, 2d6 radiante vs no-muertos"
                            className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-300 text-xs placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Maestría */}
                  {wData?.mastery && WEAPON_MASTERIES[wData.mastery] && (
                    <div className="pt-2 border-t border-stone-800">
                      <p className="text-xs font-bold text-stone-300 mb-0.5">
                        Maestría: {WEAPON_MASTERIES[wData.mastery]!.name}
                      </p>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        {WEAPON_MASTERIES[wData.mastery]!.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "spells" && (
          <div className="space-y-5">

            {/* Barra de estadísticas de conjuración */}
            <div className="flex items-center gap-3 bg-stone-800/60 border border-stone-700 rounded-lg p-3">
              <div className="flex-1">
                <p className="text-[10px] text-stone-500 mb-0.5 uppercase tracking-wide">Caract. conjuración</p>
                <select
                  value={form.spellcastingAbility ?? ""}
                  onChange={e => set("spellcastingAbility", e.target.value || null)}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">Auto</option>
                  <option value="intelligence">INT — Inteligencia</option>
                  <option value="wisdom">SAB — Sabiduría</option>
                  <option value="charisma">CAR — Carisma</option>
                </select>
              </div>
              <div className="text-center min-w-[48px]">
                <p className="text-[10px] text-stone-500 uppercase tracking-wide">CD</p>
                <p className="text-xl font-bold text-amber-400">{calcDC ?? "—"}</p>
              </div>
              <div className="text-center min-w-[48px]">
                <p className="text-[10px] text-stone-500 uppercase tracking-wide">Ataque</p>
                <p className="text-xl font-bold text-amber-400">
                  {calcAttack !== null ? (calcAttack >= 0 ? `+${calcAttack}` : calcAttack) : "—"}
                </p>
              </div>
            </div>

            {/* Magia de Pacto (Brujo) */}
            {pactMagic && (() => {
              const pact = getSlot("pact");
              return (
                <div className="bg-stone-900 border border-violet-800/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Magia de Pacto</span>
                    <span className="text-xs text-stone-500">espacios nv.{pactMagic.slotLevel}</span>
                    <button
                      onClick={syncPactSlots}
                      className="ml-auto text-xs text-stone-500 hover:text-violet-400 transition-colors"
                      title="Sincronizar según nivel de Brujo"
                    >
                      ↺ Sincronizar
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: pact.max }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => toggleBubble("pact", i)}
                        title={i < pact.used ? "Recuperar espacio" : "Gastar espacio"}
                        className={`w-5 h-5 rounded-full border-2 transition-colors ${
                          i < pact.used
                            ? "border-violet-600 bg-transparent"
                            : "border-violet-400 bg-violet-400"
                        }`}
                      />
                    ))}
                    <button onClick={() => setSlot("pact", pact.used, pact.max + 1)} className="text-stone-500 hover:text-stone-300 text-xs ml-1">+</button>
                    {pact.max > 0 && (
                      <button onClick={() => setSlot("pact", Math.min(pact.used, pact.max - 1), pact.max - 1)} className="text-stone-500 hover:text-stone-300 text-xs">−</button>
                    )}
                    <span className="text-xs text-stone-500 ml-1">{pact.max - pact.used}/{pact.max}</span>
                  </div>
                </div>
              );
            })()}

            {/* Botón de sincronización de espacios normales */}
            {mainSpellClass !== PACT_MAGIC_CLASS && mainSpellClass !== "" && (
              <div className="flex justify-end">
                <button
                  onClick={syncRegularSlots}
                  className="text-xs text-stone-500 hover:text-amber-400 transition-colors"
                  title="Calcula los espacios según tus niveles de clase"
                >
                  ↺ Sincronizar espacios según nivel
                </button>
              </div>
            )}

            {/* Secciones por nivel (0 = trucos, 1–9 = niveles) */}
            {[0,1,2,3,4,5,6,7,8,9].map(lvl => {
              const spellsAtLevel = spells.filter(s => s.level === lvl);
              const slotKey = String(lvl);
              const slot = lvl > 0 ? getSlot(slotKey) : null;
              const hasSlots = slot !== null && slot.max > 0;

              if (lvl > 0 && !hasSlots && spellsAtLevel.length === 0) return null;
              if (lvl === 0 && spellsAtLevel.length === 0 && HALF_CASTER_CLASSES_SET.has(mainSpellClass)) return null;

              return (
                <div key={lvl} className="space-y-2">
                  {/* Cabecera del nivel */}
                  <div className="flex items-center gap-2 border-b border-stone-800 pb-1">
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">
                      {lvl === 0 ? "Trucos" : `Nivel ${lvl}`}
                    </span>

                    {/* Burbujas de espacios */}
                    {slot !== null && (
                      <div className="flex items-center gap-1 ml-1">
                        {Array.from({ length: slot.max }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => toggleBubble(slotKey, i)}
                            title={i < slot.used ? "Recuperar espacio" : "Gastar espacio"}
                            className={`w-4 h-4 rounded-full border-2 transition-colors ${
                              i < slot.used
                                ? "border-stone-600 bg-transparent"
                                : "border-amber-400 bg-amber-400"
                            }`}
                          />
                        ))}
                        <button onClick={() => setSlot(slotKey, slot.used, slot.max + 1)} className="text-stone-500 hover:text-stone-300 text-xs">+</button>
                        {slot.max > 0 && (
                          <button onClick={() => setSlot(slotKey, Math.min(slot.used, slot.max - 1), slot.max - 1)} className="text-stone-500 hover:text-stone-300 text-xs">−</button>
                        )}
                        {slot.max > 0 && (
                          <span className="text-[10px] text-stone-500">{slot.max - slot.used}/{slot.max}</span>
                        )}
                      </div>
                    )}

                    {/* Botón añadir hechizo */}
                    <button
                      onClick={() => {
                        setSpellModalLevel(lvl);
                        setSpellModalClass(mainSpellClass);
                        setSpellSearch("");
                        setSpellModalOpen(true);
                      }}
                      className="ml-auto text-xs text-amber-600 hover:text-amber-400 transition-colors"
                    >
                      + Añadir
                    </button>
                  </div>

                  {/* Lista de hechizos */}
                  {spellsAtLevel.length === 0 ? (
                    <p className="text-xs text-stone-600 italic pl-1">Sin hechizos</p>
                  ) : (
                    <div className="space-y-1">
                      {spellsAtLevel.map(spell => {
                        const isExpanded = expandedSpellId === spell.id;
                        const detail = spellDetailCache[spell.name];
                        return (
                          <div key={spell.id} className="rounded overflow-hidden">
                            {/* Fila compacta */}
                            <div
                              className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors ${
                                isExpanded ? "bg-stone-700" : "bg-stone-900 hover:bg-stone-800"
                              }`}
                              onClick={() => toggleSpellExpand(spell)}
                            >
                              <span className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                              <span className="text-sm text-stone-200 flex-1">{spell.name}</span>
                              {spell.concentration && (
                                <span className="text-[10px] font-bold bg-blue-900/60 text-blue-300 px-1.5 rounded" title="Concentración">C</span>
                              )}
                              {spell.ritual && (
                                <span className="text-[10px] font-bold bg-green-900/60 text-green-300 px-1.5 rounded" title="Ritual">R</span>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); removeSpell(spell.id); }}
                                className="text-stone-600 hover:text-red-400 text-xs transition-colors shrink-0"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Vista expandida */}
                            {isExpanded && (
                              <div className="bg-stone-950 border border-stone-700 border-t-0 rounded-b px-3 py-3 space-y-3">
                                {detail === undefined ? (
                                  <p className="text-xs text-stone-500 italic">Cargando...</p>
                                ) : detail === null ? (
                                  <p className="text-xs text-stone-500 italic">
                                    Descripción no disponible para &quot;{spell.name}&quot;.
                                  </p>
                                ) : (
                                  <>
                                    {/* Cabecera: nivel + escuela */}
                                    <div className="flex items-start gap-2 flex-wrap">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-stone-400">
                                          {detail.level === 0
                                            ? `Truco · ${detail.school}`
                                            : `Nivel ${detail.level} · ${detail.school}`}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {detail.concentration && (
                                          <span className="text-[10px] font-bold bg-blue-900/70 text-blue-300 px-1.5 py-0.5 rounded" title="Concentración">C</span>
                                        )}
                                        {detail.ritual && (
                                          <span className="text-[10px] font-bold bg-green-900/70 text-green-300 px-1.5 py-0.5 rounded" title="Ritual">R</span>
                                        )}
                                        {/Adicional/.test(detail.castingTime) && (
                                          <span className="text-[10px] font-bold bg-orange-900/70 text-orange-300 px-1.5 py-0.5 rounded" title="Acción adicional">AA</span>
                                        )}
                                        {/Reacción|reacción/.test(detail.castingTime) && (
                                          <span className="text-[10px] font-bold bg-purple-900/70 text-purple-300 px-1.5 py-0.5 rounded" title="Reacción">Rx</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Stats: tiempo, alcance, duración */}
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                      {[
                                        { label: "Tiempo", value: detail.castingTime },
                                        { label: "Alcance", value: detail.range },
                                        { label: "Duración", value: detail.duration },
                                      ].map(({ label, value }) => (
                                        <div key={label} className="bg-stone-900 rounded p-1.5">
                                          <p className="text-[9px] text-stone-500 uppercase tracking-wide mb-0.5">{label}</p>
                                          <p className="text-xs text-stone-200 leading-tight">{value}</p>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Componentes */}
                                    <div className="flex items-start gap-2 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        {detail.components.verbal && (
                                          <span className="text-[10px] font-bold bg-stone-700 text-stone-300 px-1.5 py-0.5 rounded" title="Verbal">V</span>
                                        )}
                                        {detail.components.somatic && (
                                          <span className="text-[10px] font-bold bg-stone-700 text-stone-300 px-1.5 py-0.5 rounded" title="Somático">S</span>
                                        )}
                                        {detail.components.material && (
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            detail.components.consumed
                                              ? "bg-red-900/60 text-red-300"
                                              : detail.components.hasCost
                                              ? "bg-yellow-900/60 text-yellow-300"
                                              : "bg-stone-700 text-stone-300"
                                          }`} title="Material">M</span>
                                        )}
                                      </div>
                                      {detail.components.material && detail.components.materialDesc && (
                                        <p className={`text-xs flex-1 leading-tight ${
                                          detail.components.consumed
                                            ? "text-red-300"
                                            : detail.components.hasCost
                                            ? "text-yellow-300"
                                            : "text-stone-400"
                                        }`}>
                                          {detail.components.materialDesc}
                                          {detail.components.consumed && <span className="ml-1 font-bold">✗</span>}
                                        </p>
                                      )}
                                    </div>

                                    {/* CD / Ataque hechizo (del personaje) */}
                                    {(calcDC !== null || calcAttack !== null) && (
                                      <div className="flex items-center gap-3">
                                        {calcDC !== null && (
                                          <div className="text-center">
                                            <p className="text-[9px] text-stone-500 uppercase tracking-wide">CD salvación</p>
                                            <p className="text-sm font-bold text-amber-400">{calcDC}</p>
                                          </div>
                                        )}
                                        {calcAttack !== null && (
                                          <div className="text-center">
                                            <p className="text-[9px] text-stone-500 uppercase tracking-wide">Ataque hechizo</p>
                                            <p className="text-sm font-bold text-amber-400">
                                              {calcAttack >= 0 ? `+${calcAttack}` : calcAttack}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Descripción */}
                                    {detail.description && (
                                      <p className="text-xs text-stone-300 leading-relaxed">
                                        {detail.description}
                                      </p>
                                    )}

                                    {/* Ranura superior / Mejora de truco */}
                                    {detail.higherLevels && (
                                      <div className="border-t border-stone-700 pt-2">
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">
                                          {detail.level === 0 ? "Mejora de Truco" : "En ranuras superiores"}
                                        </p>
                                        <p className="text-xs text-stone-400 leading-relaxed">{detail.higherLevels}</p>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Modal — Añadir hechizo */}
            {spellModalOpen && (() => {
              const modalSpells = getSpellsForModal();
              return (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
                  <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">

                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-800 shrink-0">
                      <h3 className="text-sm font-bold text-amber-400 flex-1">
                        Añadir hechizo — {spellModalLevel === 0 ? "Truco" : `Nivel ${spellModalLevel}`}
                      </h3>
                      <button
                        onClick={() => setSpellModalOpen(false)}
                        className="text-stone-400 hover:text-stone-200 text-lg leading-none"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Filtros */}
                    <div className="px-4 pt-3 pb-2 border-b border-stone-800 space-y-2 shrink-0">
                      <select
                        value={spellModalClass}
                        onChange={e => setSpellModalClass(e.target.value)}
                        className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                      >
                        <option value="">— Todas las clases —</option>
                        {Object.keys(SPELL_LISTS_BY_CLASS).map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={spellSearch}
                        onChange={e => setSpellSearch(e.target.value)}
                        placeholder="Buscar hechizo..."
                        autoFocus
                        className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500 placeholder-stone-600"
                      />
                    </div>

                    {/* Pestañas de nivel */}
                    <div className="flex gap-1 px-4 pt-2 pb-1 border-b border-stone-800 overflow-x-auto shrink-0">
                      {[0,1,2,3,4,5,6,7,8,9].map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => setSpellModalLevel(lvl)}
                          className={`text-xs px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                            spellModalLevel === lvl
                              ? "bg-amber-600 text-white"
                              : "text-stone-400 hover:text-stone-200"
                          }`}
                        >
                          {lvl === 0 ? "Trucos" : `Nv.${lvl}`}
                        </button>
                      ))}
                    </div>

                    {/* Lista de hechizos */}
                    <div className="overflow-y-auto flex-1 px-4 py-2 space-y-1">
                      {modalSpells.length === 0 ? (
                        <p className="text-xs text-stone-600 italic py-4 text-center">
                          {spellSearch ? "No hay hechizos que coincidan." : "No hay hechizos en esta lista."}
                        </p>
                      ) : (
                        modalSpells.map(entry => {
                          const alreadyAdded = spells.some(s => s.name === entry.name && s.level === spellModalLevel);
                          return (
                            <button
                              key={entry.name}
                              onClick={() => { addSpell(entry, spellModalLevel); }}
                              disabled={alreadyAdded}
                              className={`w-full flex items-center gap-2 text-left rounded px-2.5 py-1.5 transition-colors text-sm ${
                                alreadyAdded
                                  ? "text-stone-600 cursor-default"
                                  : "bg-stone-800 hover:bg-stone-700 text-stone-200"
                              }`}
                            >
                              <span className="flex-1">{entry.name}</span>
                              {entry.concentration && (
                                <span className="text-[10px] font-bold text-blue-400" title="Concentración">C</span>
                              )}
                              {entry.ritual && (
                                <span className="text-[10px] font-bold text-green-400" title="Ritual">R</span>
                              )}
                              {alreadyAdded && (
                                <span className="text-[10px] text-stone-600">✓</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-6">
            <SectionTitle>Monedas</SectionTitle>
            <div className="grid grid-cols-5 gap-3">
              {([ ["cp","PC"],["sp","PO"],["ep","PE"],["gp","PG"],["pp","PP"] ] as [string,string][]).map(([k, label]) => {
                const curr = parseJson(form.currency ?? "{}", {});
                return (
                  <div key={k} className="text-center">
                    <p className="text-xs text-stone-500 mb-1">{label}</p>
                    <input
                      type="number" min={0}
                      value={curr[k] ?? ""}
                      onChange={e => {
                        const next = { ...curr, [k]: parseInt(e.target.value) || 0 };
                        set("currency", JSON.stringify(next));
                      }}
                      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-center text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>

            <SectionTitle>Equipamiento</SectionTitle>
            <textarea
              value={parseJson(form.inventory ?? "[]", []).join("\n")}
              onChange={e => set("inventory", JSON.stringify(e.target.value.split("\n").filter(Boolean)))}
              placeholder="Un objeto por línea..."
              rows={12}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none"
            />

            <SectionTitle>Rasgos y características de clase</SectionTitle>
            <textarea
              value={parseJson(form.features ?? "[]", []).join("\n")}
              onChange={e => set("features", JSON.stringify(e.target.value.split("\n").filter(Boolean)))}
              placeholder="Un rasgo por línea (ej: Ataque furtivo — 3d6 de daño adicional)..."
              rows={8}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>
        )}

        {activeTab === "backstory" && (
          <div className="space-y-6">
            <SectionTitle>Personalidad</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Rasgos de personalidad">
                <textarea value={form.traits ?? ""} onChange={e => set("traits", e.target.value)} rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </Field>
              <Field label="Ideales">
                <textarea value={form.ideals ?? ""} onChange={e => set("ideals", e.target.value)} rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </Field>
              <Field label="Vínculos">
                <textarea value={form.bonds ?? ""} onChange={e => set("bonds", e.target.value)} rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </Field>
              <Field label="Defectos">
                <textarea value={form.flaws ?? ""} onChange={e => set("flaws", e.target.value)} rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </Field>
            </div>

            <SectionTitle>Historia</SectionTitle>
            <textarea value={form.backstory ?? ""} onChange={e => set("backstory", e.target.value)} rows={8}
              placeholder="Historia del personaje..."
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />

            <SectionTitle>Apariencia</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              {([ ["age","Edad"],["height","Altura"],["weight","Peso"],["eyes","Ojos"],["skin","Piel"],["hair","Cabello"] ] as [string,string][]).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input value={form[k] as string | undefined} onChange={v => set(k, v)} />
                </Field>
              ))}
            </div>
            <Field label="Descripción física">
              <textarea value={form.appearance ?? ""} onChange={e => set("appearance", e.target.value)} rows={4}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
            </Field>

            <SectionTitle>Notas adicionales</SectionTitle>
            <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} rows={4}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>
        )}

        {/* Save button bottom */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => setShowSaveConfirm(true)}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar ficha
          </button>
        </div>
      </div>

        {/* Modal selección de maestría */}
        {expertiseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="font-bold text-stone-100 text-lg mb-1">Nuevos slots de Maestría</h3>
              <p className="text-stone-400 text-sm mb-4">
                Ganaste {expertiseModal.slots} slot{expertiseModal.slots > 1 ? "s" : ""} de maestría.
                Elige {expertiseModal.slots} habilidad{expertiseModal.slots > 1 ? "es" : ""} en las que ya tienes competencia.
              </p>
              {(() => {
                const proficientWithoutExp = SKILLS.filter(s => {
                  const hasPro = bgSkills.includes(s.key) || speciesSkills.includes(s.key) || skillProfs.includes(s.key);
                  return hasPro && !skillExpert.includes(s.key);
                });
                return proficientWithoutExp.length === 0 ? (
                  <p className="text-stone-500 text-sm text-center py-4 mb-4">
                    No tienes competencia en ninguna habilidad adicional.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto mb-4 pr-1">
                    {proficientWithoutExp.map(s => {
                      const picked = expertisePick.has(s.key);
                      const full   = expertisePick.size >= expertiseModal.slots && !picked;
                      return (
                        <label
                          key={s.key}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${full ? "opacity-40" : "hover:bg-stone-800"}`}
                        >
                          <input
                            type="checkbox"
                            checked={picked}
                            disabled={full}
                            onChange={e => {
                              setExpertisePick(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(s.key);
                                else next.delete(s.key);
                                return next;
                              });
                            }}
                            className="accent-amber-400"
                          />
                          <span className="text-sm text-stone-300 flex-1">{s.label}</span>
                          <span className="text-xs text-stone-600">{ABILITIES.find(a => a.key === s.ability)?.label}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500">{expertisePick.size}/{expertiseModal.slots} elegidas</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setExpertiseModal(null); setExpertisePick(new Set()); }}
                    className="px-4 py-2 text-stone-400 hover:text-stone-200 text-sm transition-colors"
                  >
                    Luego
                  </button>
                  <button
                    onClick={() => {
                      set("skillExpertise", JSON.stringify([...new Set([...skillExpert, ...expertisePick])]));
                      setExpertiseModal(null);
                      setExpertisePick(new Set());
                    }}
                    disabled={expertisePick.size === 0}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg text-sm transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="font-bold text-stone-100 text-lg mb-2">Guardar ficha</h3>
              <p className="text-stone-400 text-sm mb-6">
                ¿Guardar los cambios en la ficha de{" "}
                <span className="text-stone-200 font-semibold">{form.name}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSaveConfirm(false)}
                  className="px-4 py-2 text-stone-400 hover:text-stone-200 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => { setShowSaveConfirm(false); await handleSave(); }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg text-sm transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {saveError && (
          <div className="fixed bottom-4 right-4 z-50 bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg text-sm shadow-lg">
            {saveError}
          </div>
        )}
    </AppShell>
  );
}

export default function PlayerSheetPage() {
  return <Suspense><CharacterSheetContent /></Suspense>;
}
