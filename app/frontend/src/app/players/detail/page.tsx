"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Shield, Heart, Star, Zap, ChevronLeft, Save, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import dynamic from "next/dynamic";
import { AppShell } from "../../../components/layout/AppShell";
import { api } from "../../../lib/api";
import {
  SPELLCASTING_ABILITY_BY_CLASS,
  HIT_DIE_BY_CLASS,
  BACKGROUND_DATA,
  SAVING_THROWS_BY_CLASS,
  THIRD_CASTER_SUBCLASSES,
  isClassSpellcaster,
  FIXED_SKILL_PROFICIENCIES_BY_SPECIES,
  LANGUAGES_BY_SPECIES,
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
  calcInitiative,
  calcSpeed,
  type PlayerClassEntry,
  type HpRollEntry,
  type FeatEntry,
} from "../../../lib/player-calcs";
import { ABILITIES, SKILLS } from "./player-types";
import { SectionTitle } from "./player-ui";
import { AbilityBox } from "./AbilityBox";
import { BackstoryTab } from "./BackstoryTab";
import { SkillsTab } from "./SkillsTab";

const CoreTab = dynamic(() => import("./CoreTab").then(m => ({ default: m.CoreTab })), { ssr: false });
const CombatTab = dynamic(() => import("./CombatTab").then(m => ({ default: m.CombatTab })), { ssr: false });
const SpellsTab = dynamic(() => import("./SpellsTab").then(m => ({ default: m.SpellsTab })), { ssr: false });


function CharacterSheetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = { id: searchParams.get("id") ?? "" };
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveError, setSaveError]             = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"core" | "abilities" | "skills" | "combat" | "spells" | "inventory" | "backstory">("core");
  const [expertiseModal, setExpertiseModal] = useState<{ slots: number } | null>(null);
  const [expertisePick, setExpertisePick] = useState<Set<string>>(new Set());
  const [bgConfirmPending, setBgConfirmPending] = useState<string | null>(null);
  const [bgUnlockConfirm, setBgUnlockConfirm] = useState(false);

  const { data: player, error: playerError, mutate } = useSWR(
    params.id ? `/player/${params.id}` : null,
    () => api.players.get(params.id)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<Record<string, any>>({});
  const formInitialized = useRef(false);

  const isSpellcasterEarly = (() => {
    let cls: PlayerClassEntry[] = [];
    try { cls = JSON.parse((form.classes as string | undefined) ?? "[]"); } catch { /* ok */ }
    return cls.some(c => isClassSpellcaster(c.class, c.subclass));
  })();

  useEffect(() => {
    if (player && !formInitialized.current) {
      setForm(player);
      formInitialized.current = true;
    }
  }, [player]);

  useEffect(() => {
    if (!isSpellcasterEarly && activeTab === "spells") setActiveTab("core");
  }, [isSpellcasterEarly, activeTab]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseJson(v: string, fallback: any) {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  const bgLocked = form.backgroundLocked === true;

  function handleBgSelect(newBg: string) {
    if (!newBg || newBg === form.background) return;
    if (bgLocked) return;
    setBgConfirmPending(newBg);
  }

  function confirmBgApply() {
    if (!bgConfirmPending) return;
    applyBackground(bgConfirmPending);
    set("backgroundLocked", true);
    setBgConfirmPending(null);
  }

  function requestBgUnlock() {
    setBgUnlockConfirm(true);
  }

  function confirmBgUnlock() {
    applyBackground("");
    set("backgroundLocked", false);
    setBgUnlockConfirm(false);
  }

  function applyBackground(newBg: string) {
    const newData  = newBg && newBg !== "Otro (homebrew)" ? (BACKGROUND_DATA[newBg] ?? null) : null;
    setForm(prev => {
      const oldBgName = prev.background as string | undefined;
      const oldData   = oldBgName && oldBgName !== "Otro (homebrew)" ? (BACKGROUND_DATA[oldBgName] ?? null) : null;

      const skills: string[] = (() => { try { return JSON.parse(prev.skillProficiencies ?? "[]"); } catch { return []; } })();
      const feats: FeatEntry[] = (() => { try { return JSON.parse(prev.feats ?? "[]"); } catch { return []; } })();

      const withoutOld = oldData ? skills.filter(s => !oldData.skillProficiencies.includes(s)) : skills;
      const newSkills   = newData ? [...new Set([...withoutOld, ...newData.skillProficiencies])] : withoutOld;

      const withoutBgFeat = feats.filter(f => !(f.classIndex === -1 && f.level === 0));
      const newFeats = newData?.feat
        ? [...withoutBgFeat, { name: newData.feat, classIndex: -1, level: 0, statBonuses: [] }]
        : withoutBgFeat;

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

  // NOTE: this closure is re-created on every render, so it can safely reuse
  // the render-scope derived values below (classes, feats, finalDex..finalCha,
  // calcedAC, calcedHpMax, level, pb, calcedInitiative, calcDC, calcAttack,
  // passivePerception, currentSpecies) instead of recomputing them — they're
  // already up to date with `form` by the time the user can click "Guardar".
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const hitDice = classes.map(c => `${c.level}d${HIT_DIE_BY_CLASS[c.class] ?? 8}`).join(" + ");
      const calcedSpeed = calcSpeed(currentSpecies, classes, feats);
      const speed = form.speed != null ? (form.speed as number) : calcedSpeed;

      const firstClass = classes[0];

      await api.players.update(params.id, {
        ...form,
        ac: calcedAC,
        hpMax: calcedHpMax,
        initiative: calcedInitiative,
        speed,
        passivePerception,
        // calcDC/calcAttack are `null` (not `undefined`) when there's no
        // spellcasting ability — convert to match the API's "omit field" contract.
        spellSaveDC: calcDC ?? undefined,
        spellAttackBonus: calcAttack ?? undefined,
        level,
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

  const isSpellcaster = classes.some(c => isClassSpellcaster(c.class, c.subclass));

  const bgName = form.background as string | undefined;
  const bgData = bgName && bgName !== "Otro (homebrew)" ? (BACKGROUND_DATA[bgName] ?? null) : null;
  const bgSkills: string[] = bgData?.skillProficiencies ?? [];

  const level = totalLevel(classes) || 1;
  const pb = proficiencyBonus(level);

  const finalStr = finalAbilityScore(form.strength    ?? 10, "strength",     feats);
  const finalDex = finalAbilityScore(form.dexterity   ?? 10, "dexterity",    feats);
  const finalCon = finalAbilityScore(form.constitution ?? 10, "constitution", feats);
  const finalInt = finalAbilityScore(form.intelligence ?? 10, "intelligence", feats);
  const finalWis = finalAbilityScore(form.wisdom       ?? 10, "wisdom",       feats);
  const finalCha = finalAbilityScore(form.charisma     ?? 10, "charisma",     feats);

  const featBonuses: Record<string, number> = {
    strength:     finalStr - (form.strength     ?? 10),
    dexterity:    finalDex - (form.dexterity    ?? 10),
    constitution: finalCon - (form.constitution ?? 10),
    intelligence: finalInt - (form.intelligence ?? 10),
    wisdom:       finalWis - (form.wisdom        ?? 10),
    charisma:     finalCha - (form.charisma      ?? 10),
  };

  const calcedAC = calcAC(
    form.equippedArmor ?? null,
    finalDex,
    form.shield ?? false,
    finalCon,
    finalWis,
  );

  const calcedHpMax = calcHpMaxFromRolls(hpRolls, classes, finalCon, form.hpUseAverage ?? true);

  const skillProfs: string[] = parseJson(form.skillProficiencies ?? "[]", []);
  const skillExpert: string[] = parseJson(form.skillExpertise ?? "[]", []);
  const passivePerception = calcPassivePerception(
    finalWis,
    level,
    skillProfs.includes("Perception"),
    skillExpert.includes("Perception"),
  );
  const saveProfs: string[] = parseJson(form.savingThrows ?? "[]", []);
  const classSaves: string[] = [...new Set(classes.flatMap(c => SAVING_THROWS_BY_CLASS[c.class] ?? []))];

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

  const calcedInitiative = calcInitiative(finalDex, feats);

  const raceStr: string = form.race ?? "";
  const raceMatch = raceStr.match(/^(.+?) \((.+)\)$/);
  const currentSpecies = raceMatch ? (raceMatch[1] ?? raceStr) : raceStr;

  const speciesSkills: string[] = FIXED_SKILL_PROFICIENCIES_BY_SPECIES[currentSpecies] ?? [];
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

  if (playerError) return (
    <AppShell>
      <div className="p-8 text-center text-red-400">
        Error al cargar los datos. Intenta recargar la pagina.
      </div>
    </AppShell>
  );

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
            <button onClick={() => router.back()} className="text-stone-500 hover:text-stone-300 transition-colors" aria-label="Volver">
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
          <CoreTab
            form={form}
            set={set}
            classes={classes}
            hpRolls={hpRolls}
            feats={feats}
            skillProfs={skillProfs}
            skillExpert={skillExpert}
            handleBgSelect={handleBgSelect}
            requestBgUnlock={requestBgUnlock}
            setActiveTab={setActiveTab}
            setExpertiseModal={setExpertiseModal}
            setExpertisePick={setExpertisePick}
            setForm={setForm}
          />
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
          <SkillsTab
            form={form}
            set={set}
            classes={classes}
            feats={feats}
            bgSkills={bgSkills}
            speciesSkills={speciesSkills}
            species={currentSpecies}
          />
        )}

        {activeTab === "combat" && (
          <CombatTab
            form={form}
            set={set}
            classes={classes}
            finalStr={finalStr}
            finalDex={finalDex}
          />
        )}

        {activeTab === "spells" && (
          <SpellsTab
            form={form}
            set={set}
            classes={classes}
            calcDC={calcDC}
            calcAttack={calcAttack}
          />
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
          <BackstoryTab form={form} set={set} />
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

        {bgConfirmPending && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="font-bold text-stone-100 text-lg mb-2">Aplicar trasfondo</h3>
              <p className="text-stone-400 text-sm mb-6">
                ¿Aplicar el trasfondo <span className="text-amber-400 font-semibold">{bgConfirmPending}</span>?
                Las competencias y dote quedarán bloqueadas. Para cambiarlo necesitarás confirmarlo explícitamente.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setBgConfirmPending(null)}
                  className="px-4 py-2 text-stone-400 hover:text-stone-200 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmBgApply}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg text-sm transition-colors"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}

        {bgUnlockConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="font-bold text-stone-100 text-lg mb-2">Cambiar trasfondo</h3>
              <p className="text-stone-400 text-sm mb-6">
                ¿Cambiar el trasfondo? Se eliminarán las competencias y la dote aplicadas por <span className="text-amber-400 font-semibold">{form.background}</span>.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setBgUnlockConfirm(false)}
                  className="px-4 py-2 text-stone-400 hover:text-stone-200 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmBgUnlock}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-stone-100 font-semibold rounded-lg text-sm transition-colors"
                >
                  Cambiar
                </button>
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
