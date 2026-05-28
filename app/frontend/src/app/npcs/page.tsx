"use client";

import { useState, useEffect, Suspense } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { Users, Plus, Pencil, Trash2, X, Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Npc, UpdateNpc, StatBlockEntry } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { DetailModal, type ModalEntity } from "../../components/ui/DetailModal";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { useAppStore } from "../../store/app.store";
import { DND_CLASSES, DND_SPECIES, SAVING_THROWS_BY_CLASS, HIT_DIE_BY_CLASS, LANGUAGES_BY_SPECIES, baseSpeedForSpecies } from "../../lib/dnd-2024-data";
import { abilityModifier, proficiencyBonus } from "../../lib/player-calcs";
import { MonsterPicker } from "../../components/ui/MonsterPicker";
import type { MonsterEntry } from "../../lib/monster-types";
import { formatCR } from "../../lib/monster-types";

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

interface NpcFormProps {
  campaignId: string;
  initial?: Partial<Npc>;
  onClose: () => void;
  onSaved: () => void;
}

function parseEntriesField(raw: StatBlockEntry[] | string | null | undefined): StatBlockEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as StatBlockEntry[]; } catch { return []; }
}

function modStr(score: string): string {
  const n = parseInt(score, 10);
  if (isNaN(n)) return "";
  const m = Math.floor((n - 10) / 2);
  return m >= 0 ? `(+${m})` : `(${m})`;
}

function EntryListEditor({
  label,
  entries,
  onChange,
}: {
  label: string;
  entries: StatBlockEntry[];
  onChange: (entries: StatBlockEntry[]) => void;
}) {
  function add() {
    onChange([...entries, { name: "", description: "" }]);
  }
  function remove(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
  }
  function update(i: number, field: keyof StatBlockEntry, value: string) {
    onChange(entries.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">{label}</p>
        <button
          type="button"
          onClick={add}
          className="text-xs text-stone-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
        >
          <Plus size={11} /> Añadir
        </button>
      </div>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 grid grid-cols-3 gap-1">
              <input
                type="text"
                value={e.name}
                onChange={(ev) => update(i, "name", ev.target.value)}
                placeholder="Nombre"
                className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                value={e.description}
                onChange={(ev) => update(i, "description", ev.target.value)}
                placeholder="Descripción"
                className="col-span-2 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <button type="button" onClick={() => remove(i)} className="text-stone-600 hover:text-red-400 transition-colors mt-1" aria-label="Eliminar entrada">
              <X size={13} />
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-xs text-stone-600 italic">Sin entradas</p>
        )}
      </div>
    </div>
  );
}

function NpcForm({ campaignId, initial, onClose, onSaved }: NpcFormProps) {
  const isEdit = !!initial?.id;

  // Basic fields
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<"alive" | "dead" | "unknown" | "missing">(
    (initial?.status ?? "alive") as "alive" | "dead" | "unknown" | "missing"
  );
  const [disposition, setDisposition] = useState<"ally" | "neutral" | "enemy">(
    (initial?.disposition ?? "neutral") as "ally" | "neutral" | "enemy"
  );
  const [tagInput, setTagInput] = useState(parseTags(initial?.tags ?? "[]").join(", "));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Stat block
  const [statExpanded, setStatExpanded] = useState(false);
  const [npcType, setNpcType] = useState<"monster" | "player">((initial?.npcType ?? "monster") as "monster" | "player");
  const [ac, setAc] = useState(initial?.armorClass != null ? String(initial.armorClass) : "");
  const [hp, setHp] = useState(initial?.hitPoints ?? "");
  const [spd, setSpd] = useState(initial?.speed ?? "");
  const [str, setStr] = useState(initial?.strength != null ? String(initial.strength) : "");
  const [dex, setDex] = useState(initial?.dexterity != null ? String(initial.dexterity) : "");
  const [con, setCon] = useState(initial?.constitution != null ? String(initial.constitution) : "");
  const [int_, setInt] = useState(initial?.intelligence != null ? String(initial.intelligence) : "");
  const [wis, setWis] = useState(initial?.wisdom != null ? String(initial.wisdom) : "");
  const [cha, setCha] = useState(initial?.charisma != null ? String(initial.charisma) : "");
  const [saves, setSaves] = useState(initial?.savingThrows ?? "");
  const [skillsField, setSkillsField] = useState(initial?.skills ?? "");
  const [resistances, setResistances] = useState(initial?.resistances ?? "");
  const [immunities, setImmunities] = useState(initial?.immunities ?? "");
  const [senses, setSenses] = useState(initial?.senses ?? "");
  const [langs, setLangs] = useState(initial?.languages ?? "");
  const [cr, setCr] = useState(initial?.challengeRating ?? "");
  const [npcClass, setNpcClass] = useState(initial?.npcClass ?? "");
  const [npcLevel, setNpcLevel] = useState(initial?.npcLevel != null ? String(initial.npcLevel) : "");
  const [npcSpecies, setNpcSpecies] = useState(initial?.npcSpecies ?? "");
  const [traits, setTraits] = useState<StatBlockEntry[]>(parseEntriesField(initial?.traits));
  const [actions, setActions] = useState<StatBlockEntry[]>(parseEntriesField(initial?.actions));
  const [bonusActions, setBonusActions] = useState<StatBlockEntry[]>(parseEntriesField(initial?.bonusActions));
  const [reactions, setReactions] = useState<StatBlockEntry[]>(parseEntriesField(initial?.reactions));

  useEffect(() => {
    if (npcType !== "player" || !npcClass || !npcLevel) return;
    const lvl = parseInt(npcLevel, 10);
    if (isNaN(lvl) || lvl < 1) return;
    const pb = proficiencyBonus(lvl);

    const scores: Record<string, string> = {
      strength: str, dexterity: dex, constitution: con,
      intelligence: int_, wisdom: wis, charisma: cha,
    };
    const labels: Record<string, string> = {
      strength: "FUE", dexterity: "DES", constitution: "CON",
      intelligence: "INT", wisdom: "SAB", charisma: "CAR",
    };

    const classSaves = SAVING_THROWS_BY_CLASS[npcClass];
    if (classSaves) {
      const parts = classSaves.map(key => {
        const score = parseInt(scores[key] ?? "", 10);
        const mod = isNaN(score) ? 0 : abilityModifier(score);
        const total = mod + pb;
        return `${labels[key] ?? key} ${total >= 0 ? "+" : ""}${total}`;
      });
      setSaves(parts.join(", "));
    }

    const conScore = parseInt(con, 10);
    const conMod = isNaN(conScore) ? 0 : abilityModifier(conScore);
    const hitDie = HIT_DIE_BY_CLASS[npcClass];
    if (hitDie) {
      const hpMax = hitDie + conMod + (lvl - 1) * (Math.floor(hitDie / 2) + 1 + conMod);
      setHp(`${hpMax} (${lvl}d${hitDie}${conMod >= 0 ? " + " : " - "}${Math.abs(conMod * lvl)})`);
    }

    const wisScore = parseInt(wis, 10);
    if (!isNaN(wisScore)) {
      const pp = 10 + abilityModifier(wisScore);
      setSenses(`percepción pasiva ${pp}`);
    }

    if (npcSpecies) {
      setSpd(`${baseSpeedForSpecies(npcSpecies)} pies`);
      const speciesLangs = LANGUAGES_BY_SPECIES[npcSpecies];
      if (speciesLangs) setLangs(speciesLangs.join(", "));
    }
  }, [npcType, npcClass, npcLevel, npcSpecies, str, dex, con, int_, wis, cha]);

  useEffect(() => {
    setName(initial?.name ?? "");
    setRole(initial?.role ?? "");
    setDescription(initial?.description ?? "");
    setStatus((initial?.status ?? "alive") as "alive" | "dead" | "unknown" | "missing");
    setDisposition((initial?.disposition ?? "neutral") as "ally" | "neutral" | "enemy");
    setTagInput(parseTags(initial?.tags ?? "[]").join(", "));
    setNpcType((initial?.npcType ?? "monster") as "monster" | "player");
    setAc(initial?.armorClass != null ? String(initial.armorClass) : "");
    setHp(initial?.hitPoints ?? "");
    setSpd(initial?.speed ?? "");
    setStr(initial?.strength != null ? String(initial.strength) : "");
    setDex(initial?.dexterity != null ? String(initial.dexterity) : "");
    setCon(initial?.constitution != null ? String(initial.constitution) : "");
    setInt(initial?.intelligence != null ? String(initial.intelligence) : "");
    setWis(initial?.wisdom != null ? String(initial.wisdom) : "");
    setCha(initial?.charisma != null ? String(initial.charisma) : "");
    setSaves(initial?.savingThrows ?? "");
    setSkillsField(initial?.skills ?? "");
    setResistances(initial?.resistances ?? "");
    setImmunities(initial?.immunities ?? "");
    setSenses(initial?.senses ?? "");
    setLangs(initial?.languages ?? "");
    setCr(initial?.challengeRating ?? "");
    setNpcClass(initial?.npcClass ?? "");
    setNpcLevel(initial?.npcLevel != null ? String(initial.npcLevel) : "");
    setNpcSpecies(initial?.npcSpecies ?? "");
    setTraits(parseEntriesField(initial?.traits));
    setActions(parseEntriesField(initial?.actions));
    setBonusActions(parseEntriesField(initial?.bonusActions));
    setReactions(parseEntriesField(initial?.reactions));
  }, [initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);

    const statBlockData = {
      npcType: npcType || undefined,
      armorClass: ac ? parseInt(ac, 10) : undefined,
      hitPoints: hp || undefined,
      speed: spd || undefined,
      strength: str ? parseInt(str, 10) : undefined,
      dexterity: dex ? parseInt(dex, 10) : undefined,
      constitution: con ? parseInt(con, 10) : undefined,
      intelligence: int_ ? parseInt(int_, 10) : undefined,
      wisdom: wis ? parseInt(wis, 10) : undefined,
      charisma: cha ? parseInt(cha, 10) : undefined,
      savingThrows: saves || undefined,
      skills: skillsField || undefined,
      resistances: resistances || undefined,
      immunities: immunities || undefined,
      senses: senses || undefined,
      languages: langs || undefined,
      challengeRating: cr || undefined,
      npcClass: npcType === "player" ? (npcClass || undefined) : undefined,
      npcLevel: npcType === "player" && npcLevel ? parseInt(npcLevel, 10) : undefined,
      npcSpecies: npcType === "player" ? (npcSpecies || undefined) : undefined,
      traits: traits.length ? traits : undefined,
      actions: actions.length ? actions : undefined,
      bonusActions: bonusActions.length ? bonusActions : undefined,
      reactions: reactions.length ? reactions : undefined,
    };

    try {
      if (isEdit && initial?.id) {
        const update: UpdateNpc = { name: name.trim(), role, description, status, disposition, tags, ...statBlockData };
        await api.npcs.update(initial.id, update);
      } else {
        await api.npcs.create({ campaignId, name: name.trim(), role, description, status, disposition, tags, ...statBlockData });
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save NPC");
    } finally {
      setLoading(false);
    }
  }

  function applyMonster(m: MonsterEntry) {
    setNpcType("monster");
    setAc(String(m.ac));
    setHp(String(m.hp));
    setSpd(m.speed);
    setStr(String(m.str));
    setDex(String(m.dex));
    setCon(String(m.con));
    setInt(String(m.int));
    setWis(String(m.wis));
    setCha(String(m.cha));
    setSaves(m.savingThrows);
    setSkillsField(m.skills);
    setResistances([m.resistances, m.vulnerabilities ? `Vulnerabilidades: ${m.vulnerabilities}` : ""].filter(Boolean).join("; "));
    setImmunities([m.damageImmunities, m.conditionImmunities ? `Condiciones: ${m.conditionImmunities}` : ""].filter(Boolean).join("; "));
    setSenses(m.senses ? `${m.senses}, percepción pasiva ${m.passivePerception}` : `percepción pasiva ${m.passivePerception}`);
    setLangs(m.languages);
    setCr(formatCR(m.cr, m.xp));
    setTraits(m.traits ? m.traits.split(", ").map(t => ({ name: t.trim(), description: "" })) : []);
    setActions(m.actions);
    setBonusActions(m.bonusAction ? [{ name: "Acción adicional", description: m.bonusAction }] : []);
    setReactions(m.reaction ? [{ name: "Reacción", description: m.reaction }] : []);
    setStatExpanded(true);
  }

  const inputCls = "w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500";
  const smallInputCls = "w-full bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-amber-400">{isEdit ? "Edit NPC" : "New NPC"}</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Basic fields */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-stone-400 mb-1">Nombre *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Estado</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as "alive" | "dead" | "unknown" | "missing")} className={inputCls}>
                  <option value="alive">Vivo</option>
                  <option value="dead">Muerto</option>
                  <option value="unknown">Desconocido</option>
                  <option value="missing">Desaparecido</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Disposición</label>
                <select value={disposition} onChange={(e) => setDisposition(e.target.value as "ally" | "neutral" | "enemy")} className={inputCls}>
                  <option value="neutral">Neutral</option>
                  <option value="ally">Aliado</option>
                  <option value="enemy">Enemigo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-stone-400 mb-1">Rol</label>
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Herrero, Líder del gremio, Antagonista..." className={inputCls} />
            </div>

            <div>
              <label className="block text-sm text-stone-400 mb-1">Descripción</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inputCls} resize-none`} placeholder="Apariencia, personalidad, motivaciones..." />
            </div>

            <div>
              <label className="block text-sm text-stone-400 mb-1">Tags</label>
              <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="villano, mercader, recurrente (separados por coma)" className={inputCls} />
            </div>

            {/* ── Stat Block Section ───────────────────────────────────── */}
            <div className="border border-stone-700 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setStatExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-stone-800 hover:bg-stone-750 text-stone-300 text-sm font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-amber-500">⚔</span>
                  Stat Block de Combate
                  {(ac || hp || str) && <span className="text-xs text-emerald-500 font-normal">(configurado)</span>}
                </span>
                {statExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {statExpanded && (
                <div className="p-4 space-y-4 bg-stone-900/50">
                  <MonsterPicker onSelect={applyMonster} />

                  {/* Tipo */}
                  <div>
                    <label className="block text-xs text-stone-500 mb-2">Tipo</label>
                    <div className="flex gap-2">
                      {(["monster", "player"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNpcType(t)}
                          className={clsx(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                            npcType === t
                              ? "bg-amber-600 border-amber-500 text-stone-950"
                              : "bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500"
                          )}
                        >
                          {t === "monster" ? "Monstruo" : "Personaje"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CR or Class+Level */}
                  {npcType === "monster" ? (
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">CR</label>
                      <input type="text" value={cr} onChange={(e) => setCr(e.target.value)} placeholder="ej: 3 (700 XP)" className={`${smallInputCls} max-w-xs`} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Clase</label>
                        <select value={npcClass} onChange={(e) => setNpcClass(e.target.value)} className={smallInputCls}>
                          <option value="">— seleccionar —</option>
                          {Object.keys(DND_CLASSES).map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Especie</label>
                        <select value={npcSpecies} onChange={(e) => setNpcSpecies(e.target.value)} className={smallInputCls}>
                          <option value="">— seleccionar —</option>
                          {DND_SPECIES.map((sp) => (
                            <option key={sp} value={sp}>{sp}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Nivel</label>
                        <input type="number" min={1} max={20} value={npcLevel} onChange={(e) => setNpcLevel(e.target.value)} className={smallInputCls} />
                      </div>
                    </div>
                  )}

                  {/* CA / PG / Velocidad */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">CA</label>
                      <input type="number" min={0} max={30} value={ac} onChange={(e) => setAc(e.target.value)} className={smallInputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Puntos de Golpe</label>
                      <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} placeholder="27 (5d8+5)" className={smallInputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Velocidad</label>
                      <input type="text" value={spd} onChange={(e) => setSpd(e.target.value)} placeholder="30 pies" className={smallInputCls} />
                    </div>
                  </div>

                  {/* Ability scores */}
                  <div>
                    <label className="block text-xs text-stone-500 mb-2">Características</label>
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        { label: "FUE", val: str, set: setStr },
                        { label: "DES", val: dex, set: setDex },
                        { label: "CON", val: con, set: setCon },
                        { label: "INT", val: int_, set: setInt },
                        { label: "SAB", val: wis, set: setWis },
                        { label: "CAR", val: cha, set: setCha },
                      ].map(({ label, val, set }) => (
                        <div key={label} className="text-center">
                          <p className="text-xs text-amber-500 font-bold mb-1">{label}</p>
                          <input
                            type="number" min={1} max={30} value={val}
                            onChange={(e) => set(e.target.value)}
                            className="w-full bg-stone-800 border border-stone-700 rounded px-1 py-1.5 text-stone-100 text-sm text-center focus:outline-none focus:border-amber-500"
                          />
                          <p className="text-xs text-stone-500 mt-0.5">{val ? modStr(val) : ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Secondary stats */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Salvaciones", val: saves, set: setSaves, placeholder: "DES +4, CAR +3" },
                      { label: "Habilidades", val: skillsField, set: setSkillsField, placeholder: "Sigilo +5, Percepción +3" },
                      { label: "Resistencias", val: resistances, set: setResistances, placeholder: "Fuego, Ácido" },
                      { label: "Inmunidades", val: immunities, set: setImmunities, placeholder: "Veneno, Encantamiento" },
                      { label: "Sentidos", val: senses, set: setSenses, placeholder: "Vista en la oscuridad 18m" },
                      { label: "Idiomas", val: langs, set: setLangs, placeholder: "Común, Infernal" },
                    ].map(({ label, val, set, placeholder }) => (
                      <div key={label}>
                        <label className="block text-xs text-stone-500 mb-1">{label}</label>
                        <input type="text" value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} className={smallInputCls} />
                      </div>
                    ))}
                  </div>

                  {/* Dynamic entry lists */}
                  <div className="space-y-4 border-t border-stone-700 pt-4">
                    <EntryListEditor label="Rasgos" entries={traits} onChange={setTraits} />
                    <EntryListEditor label="Acciones" entries={actions} onChange={setActions} />
                    <EntryListEditor label="Acciones Adicionales" entries={bonusActions} onChange={setBonusActions} />
                    <EntryListEditor label="Reacciones" entries={reactions} onChange={setReactions} />
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-stone-700 text-stone-400 rounded-lg hover:border-stone-500 transition-colors text-sm">
                Cancelar
              </button>
              <button type="submit" disabled={loading || !name.trim()} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors text-sm">
                {loading ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear NPC"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Status color mapping for NPC cards
const STATUS_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  alive:   { bg: "bg-emerald-950/40", border: "border-emerald-800/50", dot: "bg-emerald-400" },
  dead:    { bg: "bg-red-950/30",     border: "border-red-900/50",     dot: "bg-red-500" },
  missing: { bg: "bg-amber-950/30",   border: "border-amber-800/50",   dot: "bg-amber-400" },
  unknown: { bg: "bg-stone-800/40",   border: "border-stone-700/50",   dot: "bg-stone-500" },
};

function extractAllies(description: string | null): string[] {
  if (!description) return [];
  const idx = description.indexOf("Allies:");
  if (idx === -1) return [];
  const line = (description.slice(idx + 7).split("\n")[0] ?? "");
  return line.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 3);
}

function nameToColor(name: string): string {
  const colors = [
    "from-amber-700 to-amber-900",
    "from-purple-700 to-purple-900",
    "from-blue-700 to-blue-900",
    "from-emerald-700 to-emerald-900",
    "from-rose-700 to-rose-900",
    "from-cyan-700 to-cyan-900",
    "from-orange-700 to-orange-900",
    "from-indigo-700 to-indigo-900",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx] ?? "from-stone-700 to-stone-900";
}

function NpcCard({
  npc,
  onEdit,
  onDelete,
  onView,
}: {
  npc: Npc;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const tags = parseTags(npc.tags);
  const statusStyle = STATUS_COLORS[npc.status] ?? STATUS_COLORS["unknown"]!;
  const allies = extractAllies(npc.description ?? null);
  const avatarColor = nameToColor(npc.name);

  const race = tags[0] ?? null;
  const gender = tags[1] ?? null;
  const age = tags[2] ?? null;

  const cleanDesc = (npc.description ?? "")
    .split("\n")
    .filter((l: string) => !l.startsWith("Allies:") && !l.startsWith("Enemies:") && !l.startsWith(">") && !l.startsWith("#"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

  async function doDelete() {
    setShowConfirm(false);
    setDeleting(true);
    try {
      await api.npcs.delete(npc.id);
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const dotColor = statusStyle.dot;
  const topBarColor = dotColor === "bg-emerald-400"
    ? "bg-gradient-to-r from-emerald-600 to-emerald-900"
    : dotColor === "bg-red-500"
    ? "bg-gradient-to-r from-red-700 to-red-950"
    : dotColor === "bg-amber-400"
    ? "bg-gradient-to-r from-amber-600 to-amber-900"
    : "bg-gradient-to-r from-stone-600 to-stone-900";

  const dispositionLabel = npc.disposition === "ally" ? "Aliado" : npc.disposition === "enemy" ? "Enemigo" : "Neutral";
  const dispositionCls = npc.disposition === "ally"
    ? "bg-emerald-900/60 text-emerald-300"
    : npc.disposition === "enemy"
    ? "bg-red-900/60 text-red-300"
    : "bg-stone-700/60 text-stone-400";

  const statusLabel = npc.status === "alive" ? "Vivo" : npc.status === "dead" ? "Muerto" : npc.status === "missing" ? "Desaparecido" : "Desconocido";

  const hasStats = npc.armorClass != null || npc.hitPoints;

  return (
    <>
    <div
      className={clsx(
        "group relative border rounded-xl overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5",
        statusStyle.border,
        "bg-stone-900"
      )}
      onClick={onView}
    >
      <div className={clsx("h-0.5 w-full", topBarColor)} />

      <div className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <div className={clsx(
            "w-12 h-12 rounded-lg bg-gradient-to-br shrink-0 flex items-center justify-center",
            "text-white font-bold text-lg shadow-md border border-white/10",
            avatarColor
          )}>
            {npc.name[0]?.toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="font-semibold text-stone-100 text-base leading-tight">{npc.name}</h3>
            </div>
            {npc.role && (
              <p className="text-xs text-amber-500/80 font-medium mb-1">{npc.role}</p>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded", dispositionCls)}>
                {dispositionLabel}
              </span>
              <span className="flex items-center gap-1">
                <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
                <span className="text-[10px] font-medium text-stone-400">{statusLabel}</span>
              </span>
              {npc.challengeRating && (
                <span className="text-[10px] font-bold bg-violet-900/60 text-violet-300 px-1.5 py-0.5 rounded">
                  VD {npc.challengeRating}
                </span>
              )}
              {npc.npcLevel && (
                <span className="text-[10px] font-bold bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded">
                  Nv. {npc.npcLevel}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={`${process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:3001"}/api/pdf/npc/${npc.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-stone-600 hover:text-blue-400 transition-colors rounded"
              title="Descargar PDF"
            >
              <Download size={12} />
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 text-stone-600 hover:text-amber-400 transition-colors rounded"
              aria-label="Editar NPC"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
              disabled={deleting}
              className="p-1.5 text-stone-600 hover:text-red-400 transition-colors rounded"
              aria-label="Eliminar NPC"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {hasStats && (
          <div className="flex items-center gap-3 mb-2 px-2 py-1.5 bg-stone-800/50 rounded-lg border border-stone-700/40">
            {npc.armorClass != null && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-stone-500 uppercase">CA</span>
                <span className="text-sm font-bold text-sky-400">{npc.armorClass}</span>
              </div>
            )}
            {npc.hitPoints && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-stone-500 uppercase">PG</span>
                <span className="text-sm font-bold text-red-400">{npc.hitPoints}</span>
              </div>
            )}
            {npc.speed && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-stone-500 uppercase">Vel</span>
                <span className="text-xs text-stone-300">{npc.speed}</span>
              </div>
            )}
            {npc.strength != null && (
              <div className="flex items-center gap-2 ml-auto text-[10px]">
                {([
                  ["FUE", npc.strength],
                  ["DES", npc.dexterity],
                  ["CON", npc.constitution],
                  ["INT", npc.intelligence],
                  ["SAB", npc.wisdom],
                  ["CAR", npc.charisma],
                ] as const).map(([label, val]) => val != null ? (
                  <span key={label} className="text-stone-400">
                    <span className="text-stone-600">{label}</span> {val}
                  </span>
                ) : null)}
              </div>
            )}
          </div>
        )}

        {(race || gender || age) && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {race && <span className="text-xs bg-stone-800 border border-stone-700 text-stone-400 px-2 py-0.5 rounded-full">{race}</span>}
            {gender && <span className="text-xs bg-stone-800 border border-stone-700 text-stone-500 px-2 py-0.5 rounded-full">{gender}</span>}
            {age && <span className="text-xs bg-stone-800 border border-stone-700 text-stone-500 px-2 py-0.5 rounded-full">{age}</span>}
          </div>
        )}

        {cleanDesc && (
          <p className="text-xs text-stone-400 leading-relaxed line-clamp-2 mb-2">
            {cleanDesc}
          </p>
        )}

        {allies.length > 0 && (
          <div className="border-t border-stone-800 pt-2">
            <p className="text-xs text-stone-600 mb-1">Aliados</p>
            <div className="flex gap-1.5 flex-wrap">
              {allies.map((a) => (
                <span key={a} className="text-xs bg-amber-950/40 border border-amber-800/30 text-amber-500/70 px-2 py-0.5 rounded-full">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    <ConfirmModal
      isOpen={showConfirm}
      title="Eliminar NPC"
      message={`¿Eliminar NPC ${npc.name}?`}
      onConfirm={doDelete}
      onCancel={() => setShowConfirm(false)}
    />
    </>
  );
}

function NpcsContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { activeCampaign, _hasHydrated } = useAppStore();
  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<ModalEntity | null>(null);
  const [editNpc, setEditNpc] = useState<Npc | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const swrKey = effectiveCampaignId ? `/npcs/${effectiveCampaignId}` : null;
  const { data: npcs, error: swrError, isLoading } = useSWR(swrKey, () =>
    api.npcs.list(effectiveCampaignId!)
  );

  const refresh = () => mutate(swrKey);

  const filtered = npcs?.filter((n) => {
    const matchSearch =
      !search ||
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.role?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || n.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!_hasHydrated && !campaignId) return null;

  if (swrError) return (
    <AppShell>
      <div className="p-8 text-center text-red-400">
        Error al cargar los datos. Intenta recargar la pagina.
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
              <Users size={22} className="text-amber-400" />
              NPCs
            </h1>
            {effectiveCampaignId && (
              <p className="text-stone-500 text-sm mt-1">{activeCampaign?.title}</p>
            )}
          </div>
          {effectiveCampaignId && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
            >
              <Plus size={14} />
              New NPC
            </button>
          )}
        </div>

        {!effectiveCampaignId && (
          <div className="border border-amber-800 bg-amber-950/30 rounded-lg p-4 text-amber-400 text-sm">
            Select a campaign to manage its NPCs.
          </div>
        )}

        {effectiveCampaignId && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or role..."
                className="w-full bg-stone-900 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="all">All</option>
              <option value="alive">Alive</option>
              <option value="dead">Dead</option>
              <option value="unknown">Unknown</option>
              <option value="missing">Missing</option>
            </select>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-stone-900 rounded-lg animate-pulse border border-stone-800" />
            ))}
          </div>
        )}

        {filtered?.length === 0 && !isLoading && effectiveCampaignId && (
          <div className="text-center py-16 border border-stone-800 rounded-xl">
            <Users size={40} className="text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500">
              {search || statusFilter !== "all" ? "No NPCs match the filter" : "No NPCs yet"}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filtered?.map((npc) => (
            <NpcCard
              key={npc.id}
              npc={npc}
              onEdit={() => setEditNpc(npc)}
              onDelete={refresh}
              onView={() => setSelected({ type: "npc", data: npc })}
            />
          ))}
        </div>
      </div>

      {selected && <DetailModal entity={selected} onClose={() => setSelected(null)} campaignId={effectiveCampaignId} />}
      {(showForm || editNpc) && effectiveCampaignId && (
        <NpcForm
          key={editNpc?.id ?? "new"}
          campaignId={effectiveCampaignId}
          initial={editNpc ?? undefined}
          onClose={() => { setShowForm(false); setEditNpc(null); }}
          onSaved={() => { setShowForm(false); setEditNpc(null); refresh(); }}
        />
      )}
    </AppShell>
  );
}

export default function NpcsPage() {
  return <Suspense><NpcsContent /></Suspense>;
}
