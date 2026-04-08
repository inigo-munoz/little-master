"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Shield, Heart, Star, Zap, ChevronLeft, Save, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { AppShell } from "../../../components/layout/AppShell";
import {
  DND_CLASSES,
  DND_SPECIES,
  DND_SPECIES_VARIANTS,
  DND_BACKGROUNDS,
  DND_ALIGNMENTS,
} from "../../../lib/dnd-2024-data";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

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

function mod(score: number | null | undefined): string {
  if (!score) return "+0";
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
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

function AbilityBox({ ability, value, onChange }: {
  ability: typeof ABILITIES[number];
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 text-center">
      <p className="text-xs text-amber-500 font-bold uppercase mb-1">{ability.label}</p>
      <p className="text-2xl font-bold text-stone-100 mb-1">{mod(value)}</p>
      <input
        type="number"
        value={value ?? ""}
        min={1} max={30}
        onChange={e => onChange(e.target.value === "" ? null : parseInt(e.target.value))}
        className="w-full bg-stone-900 border border-stone-600 rounded px-1 py-0.5 text-stone-300 text-sm text-center focus:outline-none focus:border-amber-500"
        placeholder="—"
      />
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
    async () => {
      const res = await fetch(`${BACKEND}/api/players/${params.id}`);
      const json = await res.json();
      return json.data;
    }
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
      await fetch(`${BACKEND}/api/players/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      await mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const pb = profBonus(form.level ?? 1);
  const skillProfs: string[] = parseJson(form.skillProficiencies ?? "[]", []);
  const skillExpert: string[] = parseJson(form.skillExpertise ?? "[]", []);
  const saveProfs: string[] = parseJson(form.savingThrows ?? "[]", []);

  // Especie + linaje: se almacenan como "Especie (Variante)" o simplemente "Especie"
  const raceStr: string = form.race ?? "";
  const raceMatch = raceStr.match(/^(.+?) \((.+)\)$/);
  const currentSpecies = raceMatch ? raceMatch[1] : raceStr;
  const currentVariant = raceMatch ? raceMatch[2] : "";
  const speciesVariants = currentSpecies && Object.prototype.hasOwnProperty.call(DND_SPECIES_VARIANTS, currentSpecies)
    ? DND_SPECIES_VARIANTS[currentSpecies] ?? []
    : [];

  function setSpecies(species: string) {
    // Al cambiar especie, se limpia la variante
    set("race", species);
  }
  function setVariant(variant: string) {
    if (!variant) {
      set("race", currentSpecies);
    } else {
      set("race", `${currentSpecies} (${variant})`);
    }
  }

  // Subclases disponibles según la clase seleccionada
  const currentClass: string = form.class ?? "";
  const availableSubclasses = DND_CLASSES[currentClass] ?? [];
  // Subclase solo visible cuando hay clase Y nivel >= 3
  const showSubclass = !!currentClass && (form.level ?? 1) >= 3;

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
                {form.class} {form.subclass ? `(${form.subclass})` : ""} · Nivel {form.level} · {form.race}
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
            { icon: <Heart size={14} className="text-red-400" />, label: "HP", value: `${form.hp ?? "—"}/${form.hpMax ?? "—"}`, sub: form.hpTemp ? `+${form.hpTemp} temp` : null },
            { icon: <Shield size={14} className="text-blue-400" />, label: "CA", value: form.ac ?? "—" },
            { icon: <Zap size={14} className="text-yellow-400" />, label: "Iniciativa", value: form.initiative != null ? (form.initiative >= 0 ? `+${form.initiative}` : form.initiative) : mod(form.dexterity) },
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
            <SectionTitle>Información básica</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre"><Input value={form.name} onChange={v => set("name", v)} /></Field>
              <Field label="Jugador"><Input value={form.playerName} onChange={v => set("playerName", v)} /></Field>

              {/* Clase — ordenada alfabéticamente */}
              <Field label="Clase">
                <Select
                  value={currentClass}
                  onChange={v => { set("class", v); set("subclass", ""); }}
                  options={Object.keys(DND_CLASSES).sort()}
                  placeholder="Selecciona clase..."
                />
              </Field>

              {/* Nivel — junto a Clase para que el condicional de subclase tenga contexto visual */}
              <Field label="Nivel">
                <NumberInput
                  value={form.level}
                  onChange={v => {
                    set("level", v);
                    if ((v ?? 1) < 3) set("subclass", "");
                  }}
                  min={1}
                  max={20}
                />
              </Field>

              {/* Subclase — solo visible con clase seleccionada Y nivel ≥ 3 */}
              <Field label="Subclase">
                {showSubclass ? (
                  <Select
                    value={form.subclass}
                    onChange={v => set("subclass", v)}
                    options={[...availableSubclasses, "Homebrew / Otra"]}
                    placeholder="Selecciona subclase..."
                  />
                ) : currentClass ? (
                  <p className="text-xs text-stone-500 italic py-1.5 px-1">
                    La subclase se elige al nivel 3
                  </p>
                ) : (
                  <select disabled className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-500 text-sm opacity-40 cursor-not-allowed">
                    <option>Selecciona clase primero</option>
                  </select>
                )}
              </Field>

              {/* Especie */}
              <Field label="Especie">
                <Select
                  value={currentSpecies}
                  onChange={setSpecies}
                  options={[...DND_SPECIES, "Otra (homebrew)"]}
                  placeholder="Selecciona especie..."
                />
              </Field>

              {/* Subtipo de especie — label específico por especie; ocupa el slot de Trasfondo si no hay variante */}
              {speciesVariants.length > 0 ? (
                <Field label={variantLabel}>
                  <Select
                    value={currentVariant}
                    onChange={setVariant}
                    options={speciesVariants}
                    placeholder={`Selecciona ${variantLabel.toLowerCase()}...`}
                  />
                </Field>
              ) : (
                <Field label="Trasfondo">
                  <Select
                    value={form.background}
                    onChange={v => set("background", v)}
                    options={[...DND_BACKGROUNDS, "Otro (homebrew)"]}
                    placeholder="Selecciona trasfondo..."
                  />
                </Field>
              )}

              {/* Trasfondo siempre visible cuando la especie ya ocupa su slot con el subtipo */}
              {speciesVariants.length > 0 && (
                <Field label="Trasfondo">
                  <Select
                    value={form.background}
                    onChange={v => set("background", v)}
                    options={[...DND_BACKGROUNDS, "Otro (homebrew)"]}
                    placeholder="Selecciona trasfondo..."
                  />
                </Field>
              )}

              <Field label="Alineamiento">
                <Select
                  value={form.alignment}
                  onChange={v => set("alignment", v)}
                  options={DND_ALIGNMENTS}
                  placeholder="Selecciona alineamiento..."
                />
              </Field>
              <Field label="Puntos de experiencia"><NumberInput value={form.experiencePoints} onChange={v => set("experiencePoints", v)} min={0} /></Field>
            </div>

            <SectionTitle>Combate</SectionTitle>
            <div className="grid grid-cols-4 gap-4">
              <Field label="HP máx"><NumberInput value={form.hpMax} onChange={v => set("hpMax", v)} /></Field>
              <Field label="HP actual"><NumberInput value={form.hp} onChange={v => set("hp", v)} /></Field>
              <Field label="HP temporal"><NumberInput value={form.hpTemp} onChange={v => set("hpTemp", v)} /></Field>
              <Field label="CA"><NumberInput value={form.ac} onChange={v => set("ac", v)} /></Field>
              <Field label="Velocidad"><NumberInput value={form.speed} onChange={v => set("speed", v)} /></Field>
              <Field label="Iniciativa"><NumberInput value={form.initiative} onChange={v => set("initiative", v)} /></Field>
              <Field label="Dados de vida"><Input value={form.hitDice} onChange={v => set("hitDice", v)} placeholder="6d8" /></Field>
              <Field label="Percepción pasiva"><NumberInput value={form.passivePerception} onChange={v => set("passivePerception", v)} /></Field>
            </div>

            <SectionTitle>Conjuros</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Característica de conjuro"><Input value={form.spellcastingAbility} onChange={v => set("spellcastingAbility", v)} placeholder="SAB / INT / CAR" /></Field>
              <Field label="CD de salvación"><NumberInput value={form.spellSaveDC} onChange={v => set("spellSaveDC", v)} /></Field>
              <Field label="Bonif. de ataque"><NumberInput value={form.spellAttackBonus} onChange={v => set("spellAttackBonus", v)} /></Field>
            </div>

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
            <div className="grid grid-cols-6 gap-3">
              {ABILITIES.map(a => (
                <AbilityBox
                  key={a.key}
                  ability={a}
                  value={form[a.key]}
                  onChange={v => set(a.key, v)}
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
