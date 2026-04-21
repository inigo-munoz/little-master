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
  type PlayerClassEntry,
  type HpRollEntry,
  type FeatEntry,
} from "../../../lib/player-calcs";
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

function AbilityBox({ ability, value, featBonus = 0, onChange }: {
  ability: typeof ABILITIES[number];
  value: number | null | undefined;
  featBonus?: number;
  onChange: (v: number | null) => void;
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
    </div>
  );
}

function CharacterSheetContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"core" | "abilities" | "skills" | "spells" | "inventory" | "backstory">("core");

  const { data: player, mutate } = useSWR(
    params.id ? `/player/${params.id}` : null,
    () => api.players.get(params.id)
  );

  const [form, setForm] = useState<Record<string, any>>({});
  const formInitialized = useRef(false);

  // Popula el formulario con los datos del jugador al montar
  useEffect(() => {
    if (player && !formInitialized.current) {
      setForm(player);
      formInitialized.current = true;
    }
  }, [player]);

  function set(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function parseJson(v: string, fallback: any) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  async function handleSave() {
    setSaving(true);
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
      const spellClsSave     = cls.filter(c => SPELLCASTING_ABILITY_BY_CLASS[c.class] !== null);
      const primarySpellSave = spellClsSave.length > 0
        ? spellClsSave.reduce((a, b) => a.level >= b.level ? a : b)
        : null;
      const detectedAbilitySave = primarySpellSave
        ? (SPELLCASTING_ABILITY_BY_CLASS[primarySpellSave.class] ?? null)
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
    } finally {
      setSaving(false);
    }
  }

  // ── Parsear campos JSON ──────────────────────────────────────────────────────
  const classes: PlayerClassEntry[] = parseJson(form.classes ?? "[]", []);
  const hpRolls: HpRollEntry[]      = parseJson(form.hpRolls ?? "[]", []);
  const feats: FeatEntry[]          = parseJson(form.feats ?? "[]", []);

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

  const hasPerceptionProf = skillProfs.includes("Perception");
  const hasPerceptionExp  = skillExpert.includes("Perception");
  const calcPassivePerc = calcPassivePerception(finalWis, level, hasPerceptionProf, hasPerceptionExp);

  const spellcastingClasses = classes.filter(c => SPELLCASTING_ABILITY_BY_CLASS[c.class] !== null);
  const hasSpellcasting     = spellcastingClasses.length > 0;
  const primarySpellClass   = hasSpellcasting
    ? spellcastingClasses.reduce((a, b) => a.level >= b.level ? a : b)
    : null;
  const detectedSpellAbility = primarySpellClass
    ? (SPELLCASTING_ABILITY_BY_CLASS[primarySpellClass.class] ?? null)
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
  const currentVariant = raceMatch ? raceMatch[2] : "";
  const speciesVariants = currentSpecies && Object.prototype.hasOwnProperty.call(DND_SPECIES_VARIANTS, currentSpecies)
    ? DND_SPECIES_VARIANTS[currentSpecies] ?? []
    : [];

  function setSpecies(species: string) { set("race", species); }
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
  const variantLabel = (currentSpecies && Object.prototype.hasOwnProperty.call(SPECIES_VARIANT_LABEL, currentSpecies)
    ? SPECIES_VARIANT_LABEL[currentSpecies]
    : undefined) ?? "Linaje";

  const TABS = [
    { id: "core", label: "Básico" },
    { id: "abilities", label: "Estadísticas" },
    { id: "skills", label: "Habilidades" },
    { id: "spells", label: "Hechizos" },
    { id: "inventory", label: "Inventario" },
    { id: "backstory", label: "Trasfondo" },
  ] as const;

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
            onClick={handleSave}
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
          {TABS.map(t => (
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
                const spellClasses = updated.filter(c => SPELLCASTING_ABILITY_BY_CLASS[c.class] !== null);
                if (!form.spellcastingAbility && spellClasses.length > 0) {
                  const primary = spellClasses.reduce((a, b) => a.level >= b.level ? a : b);
                  const ability = SPELLCASTING_ABILITY_BY_CLASS[primary.class];
                  if (ability) set("spellcastingAbility", ability);
                }
                if (spellClasses.length === 0) {
                  set("spellcastingAbility", null);
                }
              }}
            />

            <SectionTitle>Información básica</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre"><Input value={form.name} onChange={v => set("name", v)} /></Field>
              <Field label="Jugador"><Input value={form.playerName} onChange={v => set("playerName", v)} /></Field>
              <Field label="Especie">
                <Select value={currentSpecies} onChange={setSpecies} options={[...DND_SPECIES, "Otra (homebrew)"]} placeholder="Selecciona especie..." />
              </Field>
              {speciesVariants.length > 0 ? (
                <Field label={(currentSpecies ? SPECIES_VARIANT_LABEL[currentSpecies] : undefined) ?? "Linaje"}>
                  <Select value={currentVariant} onChange={setVariant} options={speciesVariants} placeholder={`Selecciona...`} />
                </Field>
              ) : (
                <Field label="Trasfondo">
                  <Select value={form.background} onChange={v => set("background", v)} options={[...DND_BACKGROUNDS, "Otro (homebrew)"]} placeholder="Selecciona trasfondo..." />
                </Field>
              )}
              {speciesVariants.length > 0 && (
                <Field label="Trasfondo">
                  <Select value={form.background} onChange={v => set("background", v)} options={[...DND_BACKGROUNDS, "Otro (homebrew)"]} placeholder="Selecciona trasfondo..." />
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
              <Field label="Idiomas"><Input value={form.languages} onChange={v => set("languages", v)} placeholder="Común, Élfico..." /></Field>
            </div>
          </div>
        )}

        {activeTab === "abilities" && (
          <div className="space-y-6">
            <SectionTitle>Puntuaciones de característica</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              {ABILITIES.map(ability => (
                <AbilityBox
                  key={ability.key}
                  ability={ability}
                  value={form[ability.key]}
                  featBonus={featBonuses[ability.key] ?? 0}
                  onChange={v => set(ability.key, v)}
                />
              ))}
            </div>

            <SectionTitle>Tiradas de salvación</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map(a => {
                const hasSave = saveProfs.includes(a.key);
                const abilMod = Math.floor(((form[a.key] ?? 10) - 10) / 2);
                const total = abilMod + (hasSave ? pb : 0);
                return (
                  <label key={a.key} className="flex items-center gap-2 p-2 bg-stone-800 rounded-lg cursor-pointer hover:bg-stone-750">
                    <input
                      type="checkbox"
                      checked={hasSave}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...saveProfs, a.key]
                          : saveProfs.filter(s => s !== a.key);
                        set("savingThrows", JSON.stringify(next));
                      }}
                      className="accent-amber-500"
                    />
                    <span className="text-xs text-stone-300 flex-1">{a.full}</span>
                    <span className="text-xs font-mono text-amber-400">{total >= 0 ? `+${total}` : total}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "skills" && (
          <div className="space-y-4">
            <SectionTitle>Habilidades</SectionTitle>
            <p className="text-xs text-stone-600 mb-3">Bono de competencia: +{pb}</p>
            <div className="space-y-1">
              {SKILLS.map(s => {
                const hasPro = skillProfs.includes(s.key);
                const hasExp = skillExpert.includes(s.key);
                const abilKey = s.ability as keyof typeof form;
                const abilScore = form[abilKey] as number | undefined;
                const abilMod = Math.floor(((abilScore ?? 10) - 10) / 2);
                const bonus = hasExp ? pb * 2 : hasPro ? pb : 0;
                const total = abilMod + bonus;
                const foundAbil = ABILITIES.find(a => a.key === s.ability);

                return (
                  <div key={s.key} className="flex items-center gap-3 p-2 hover:bg-stone-800 rounded-lg">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasPro || hasExp}
                        onChange={e => {
                          if (e.target.checked) {
                            set("skillProficiencies", JSON.stringify([...skillProfs, s.key]));
                          } else {
                            set("skillProficiencies", JSON.stringify(skillProfs.filter(k => k !== s.key)));
                            set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== s.key)));
                          }
                        }}
                        className="accent-amber-500"
                      />
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer" title="Maestría">
                      <input
                        type="checkbox"
                        checked={hasExp}
                        onChange={e => {
                          if (e.target.checked) {
                            set("skillExpertise", JSON.stringify([...skillExpert, s.key]));
                            if (!hasPro) set("skillProficiencies", JSON.stringify([...skillProfs, s.key]));
                          } else {
                            set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== s.key)));
                          }
                        }}
                        className="accent-purple-500"
                      />
                    </label>
                    <span className="text-sm text-stone-300 flex-1">{s.label}</span>
                    <span className="text-xs text-stone-600">{foundAbil?.label}</span>
                    <span className="text-sm font-mono font-bold text-amber-400 w-8 text-right">
                      {total >= 0 ? `+${total}` : total}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-stone-600">Naranja = competencia · Morado = maestría</p>
          </div>
        )}

        {activeTab === "spells" && (
          <div className="space-y-6">
            <SectionTitle>Trucos (Cantrips)</SectionTitle>
            <textarea
              value={parseJson(form.cantrips ?? "[]", []).join("\n")}
              onChange={e => set("cantrips", JSON.stringify(e.target.value.split("\n").filter(Boolean)))}
              placeholder="Un truco por línea..."
              rows={4}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none"
            />

            <SectionTitle>Hechizos preparados</SectionTitle>
            <textarea
              value={parseJson(form.spellsPrepared ?? "[]", []).join("\n")}
              onChange={e => set("spellsPrepared", JSON.stringify(e.target.value.split("\n").filter(Boolean)))}
              placeholder="Un hechizo por línea (ej: Bola de Fuego - Nivel 3)..."
              rows={12}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none"
            />

            <SectionTitle>Espacios de conjuro</SectionTitle>
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5,6,7,8,9].map(lvl => {
                const slots = parseJson(form.spellSlots ?? "{}", {});
                return (
                  <div key={lvl} className="text-center">
                    <p className="text-xs text-stone-500 mb-1">Nv.{lvl}</p>
                    <input
                      type="number"
                      min={0} max={9}
                      value={slots[lvl] ?? ""}
                      onChange={e => {
                        const next = { ...slots, [lvl]: parseInt(e.target.value) || 0 };
                        set("spellSlots", JSON.stringify(next));
                      }}
                      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-center text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>
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
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar ficha
          </button>
        </div>
      </div>
    </AppShell>
  );
}

export default function PlayerSheetPage() {
  return <Suspense><CharacterSheetContent /></Suspense>;
}
