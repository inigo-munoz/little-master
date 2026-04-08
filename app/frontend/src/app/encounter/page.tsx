"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import {
  Swords, Plus, Trash2, AlertTriangle, Shield,
  ChevronDown, ChevronUp, Save, Check, Loader2,
  History, RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { AppShell } from "../../components/layout/AppShell";
import { useAppStore } from "../../store/app.store";
import { api } from "../../lib/api";
import type { MonsterDetail, Encounter } from "../../lib/api";

const CR_OPTIONS = [
  "0", "1/8", "1/4", "1/2",
  "1","2","3","4","5","6","7","8","9","10",
  "11","12","13","14","15","16","17","18","19","20",
  "21","22","23","24","25","26","27","28","29","30",
];

function crToNumber(cr: string): number {
  if (cr === "1/8") return 0.125;
  if (cr === "1/4") return 0.25;
  if (cr === "1/2") return 0.5;
  return parseFloat(cr);
}

function modStr(score: number | null | undefined): string {
  if (score == null) return "—";
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

interface MonsterEntry {
  id: string;
  name: string;
  cr: string;
  count: number;
  expanded: boolean;
}

const DIFFICULTY_CONFIG = {
  trivial:    { color: "text-stone-400", bg: "bg-stone-800", label: "Trivial" },
  easy:       { color: "text-emerald-400", bg: "bg-emerald-950", label: "Easy" },
  medium:     { color: "text-blue-400", bg: "bg-blue-950", label: "Medium" },
  hard:       { color: "text-amber-400", bg: "bg-amber-950", label: "Hard" },
  deadly:     { color: "text-red-400", bg: "bg-red-950", label: "Deadly" },
  impossible: { color: "text-red-300", bg: "bg-red-950", label: "Impossible" },
} as const;

interface ValidationResult {
  difficulty: keyof typeof DIFFICULTY_CONFIG;
  totalXp: number;
  adjustedXp: number;
  thresholds: { easy: number; medium: number; hard: number; deadly: number };
  recommendation: string;
  warnings: string[];
  source: string;
}

// ─── Monster Autocomplete ─────────────────────────────────────────────────────

interface SrdMonster { name: string; cr: string; type: string; size: string; }

function MonsterAutocomplete({
  value,
  onChange,
  onSelectMonster,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectMonster: (name: string, cr: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: allMonsters } = useSWR("/srd-monsters", () => api.srd.monsters());

  const filtered = useMemo<SrdMonster[]>(() => {
    if (!allMonsters || value.length < 2) return [];
    const lower = value.toLowerCase();
    return allMonsters.filter((m) => m.name.toLowerCase().includes(lower)).slice(0, 8);
  }, [allMonsters, value]);

  useEffect(() => {
    setOpen(filtered.length > 0);
  }, [filtered]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Monster name"
        autoComplete="off"
        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded-lg overflow-hidden shadow-xl">
          {filtered.map((m) => (
            <button
              key={m.name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectMonster(m.name, m.cr);
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-stone-700 flex items-center justify-between gap-2 transition-colors"
            >
              <span className="text-stone-200 text-sm truncate">{m.name}</span>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                {m.type && <span className="text-stone-500 truncate max-w-24">{m.type}</span>}
                <span className="text-amber-400 font-mono">CR {m.cr}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat Block Panel ─────────────────────────────────────────────────────────

function AbilityCell({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="text-center">
      <p className="text-xs text-amber-500 font-bold uppercase">{label}</p>
      <p className="text-sm font-bold text-stone-100">{score ?? "—"}</p>
      <p className="text-xs text-stone-400">{modStr(score)}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-stone-500 shrink-0 font-semibold">{label}</span>
      <span className="text-stone-300">{value}</span>
    </div>
  );
}

function SectionBlock({ title, entries }: { title: string; entries: { name: string; description: string }[] }) {
  if (!entries.length) return null;
  return (
    <div>
      <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 mt-3 border-t border-stone-700 pt-2">{title}</p>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={i}>
            <span className="text-xs font-semibold text-stone-200">{e.name}. </span>
            <span className="text-xs text-stone-400">{e.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonsterStatBlockPanel({ name }: { name: string }) {
  const { data, isLoading } = useSWR(
    name ? `/srd/monster-detail/${name}` : null,
    () => api.srd.monsterDetail(name)
  );

  if (isLoading) {
    return (
      <div className="mt-2 p-3 bg-stone-900 rounded-lg flex items-center gap-2 text-xs text-stone-500">
        <Loader2 size={12} className="animate-spin" /> Cargando bloque de estadísticas...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-2 p-3 bg-stone-900 rounded-lg text-xs text-stone-500 italic">
        Bloque de estadísticas no disponible en el SRD.
      </div>
    );
  }

  return (
    <div className="mt-2 p-4 bg-stone-900 border border-stone-700 rounded-lg text-xs space-y-2">
      {/* Header */}
      <div>
        <p className="font-bold text-stone-100 text-sm">{data.name}</p>
        <p className="text-stone-500 italic">
          {[data.size, data.type, data.alignment].filter(Boolean).join(", ")}
        </p>
      </div>

      {/* Core stats */}
      <div className="space-y-1 border-t border-stone-700 pt-2">
        <StatRow label="CA" value={data.ac} />
        <StatRow label="PG" value={data.hp} />
        <StatRow label="Velocidad" value={data.speed} />
        {data.initiative && <StatRow label="Iniciativa" value={data.initiative} />}
      </div>

      {/* Ability scores */}
      {(data.str != null || data.dex != null) && (
        <div className="grid grid-cols-6 gap-1 border-t border-stone-700 pt-2">
          <AbilityCell label="FUE" score={data.str} />
          <AbilityCell label="DES" score={data.dex} />
          <AbilityCell label="CON" score={data.con} />
          <AbilityCell label="INT" score={data.int} />
          <AbilityCell label="SAB" score={data.wis} />
          <AbilityCell label="CAR" score={data.cha} />
        </div>
      )}

      {/* Secondary stats */}
      <div className="space-y-1 border-t border-stone-700 pt-2">
        <StatRow label="Tiradas de salvación" value={data.savingThrows} />
        <StatRow label="Habilidades" value={data.skills} />
        <StatRow label="Resistencias" value={data.resistances} />
        <StatRow label="Inmunidades al daño" value={data.immunities} />
        <StatRow label="Inmunidades a condiciones" value={data.conditionImmunities} />
        <StatRow label="Vulnerabilidades" value={data.vulnerabilities} />
        <StatRow label="Sentidos" value={data.senses} />
        <StatRow label="Idiomas" value={data.languages} />
        <StatRow label="CR" value={data.cr ? `${data.cr}${data.xp ? ` (${data.xp})` : ""}${data.profBonus ? ` · PB ${data.profBonus}` : ""}` : ""} />
      </div>

      {/* Abilities & actions */}
      <SectionBlock title="Rasgos" entries={data.traits} />
      <SectionBlock title="Acciones" entries={data.actions} />
      <SectionBlock title="Acciones adicionales" entries={data.bonusActions} />
      <SectionBlock title="Reacciones" entries={data.reactions} />
      <SectionBlock title="Acciones legendarias" entries={data.legendaryActions} />

      {/* Fallback raw text if no structured data was parsed */}
      {!data.ac && !data.hp && data.rawText && (
        <pre className="text-stone-500 text-xs whitespace-pre-wrap font-mono border-t border-stone-700 pt-2 overflow-auto max-h-64">
          {data.rawText}
        </pre>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EncounterPage() {
  const { activeCampaign } = useAppStore();

  const encountersSWRKey = activeCampaign ? `/encounters/${activeCampaign.id}` : null;
  const { data: savedEncounters, mutate: mutateEncounters } = useSWR(
    encountersSWRKey,
    () => api.encounters.list(activeCampaign!.id)
  );

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [partySize, setPartySize] = useState(4);
  const [avgLevel, setAvgLevel] = useState(5);
  const [monsters, setMonsters] = useState<MonsterEntry[]>([
    { id: "1", name: "Goblin", cr: "1/4", count: 4, expanded: false },
  ]);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addMonster() {
    setMonsters((m) => [...m, { id: crypto.randomUUID(), name: "", cr: "1", count: 1, expanded: false }]);
  }

  function removeMonster(id: string) {
    setMonsters((m) => m.filter((x) => x.id !== id));
  }

  function updateMonster(id: string, field: keyof MonsterEntry, value: string | number | boolean) {
    setMonsters((m) => m.map((x) => x.id === id ? { ...x, [field]: value } : x));
  }

  function selectMonster(id: string, name: string, cr: string) {
    // CR se rellena automáticamente con el valor del SRD
    setMonsters((m) => m.map((x) => x.id === id ? { ...x, name, cr } : x));
  }

  function toggleExpand(id: string) {
    setMonsters((m) => m.map((x) => x.id === id ? { ...x, expanded: !x.expanded } : x));
  }

  async function validate() {
    if (monsters.length === 0 || monsters.some((m) => !m.name.trim())) {
      setError("All monsters need a name.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.rules.validateEncounter({
        campaignId: activeCampaign?.id,
        party: { size: partySize, averageLevel: avgLevel },
        monsters: monsters.map((m) => ({
          name: m.name,
          cr: crToNumber(m.cr),
          count: m.count,
        })),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message ?? "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveEncounter() {
    if (!result) return;
    if (!activeCampaign) {
      setError("Selecciona una campaña para guardar el encuentro.");
      return;
    }
    setSaving(true);
    try {
      await api.encounters.create({
        campaignId: activeCampaign.id,
        monsters: monsters.map((m) => ({ name: m.name, cr: m.cr, count: m.count })),
        partySize,
        partyLevel: avgLevel,
        baseXp: result.totalXp,
        adjustedXp: result.adjustedXp,
        difficulty: result.difficulty,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await mutateEncounters();
    } catch (err: any) {
      setError(err.message ?? "Error al guardar el encuentro");
    } finally {
      setSaving(false);
    }
  }

  function loadEncounter(enc: Encounter) {
    setMonsters(
      enc.monsters.map((m) => ({
        id: crypto.randomUUID(),
        name: m.name,
        cr: m.cr,
        count: m.count,
        expanded: false,
      }))
    );
    setResult(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteEncounter(id: string) {
    setDeleting(true);
    try {
      await api.encounters.delete(id);
      await mutateEncounters();
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.message ?? "Error al eliminar el encuentro");
    } finally {
      setDeleting(false);
    }
  }

  const diff = result ? DIFFICULTY_CONFIG[result.difficulty] : null;

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Swords size={20} className="text-amber-400" />
            <h1 className="text-2xl font-bold text-stone-100">Encounter Validator</h1>
          </div>
          {activeCampaign && (
            <p className="text-xs text-stone-500">
              Campaña: <span className="text-amber-400">{activeCampaign.title}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Party */}
          <div className="border border-stone-800 bg-stone-900 rounded-xl p-5">
            <h2 className="font-semibold text-stone-300 mb-4 flex items-center gap-2">
              <Shield size={15} className="text-amber-400" /> Party
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Party Size</label>
                <input
                  type="number" min={1} max={20} value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Average Level</label>
                <input
                  type="number" min={1} max={20} value={avgLevel}
                  onChange={(e) => setAvgLevel(Number(e.target.value))}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Result */}
          <div className={clsx(
            "border rounded-xl p-5 flex flex-col items-center justify-center transition-colors",
            diff ? `border-stone-700 ${diff.bg}/30` : "border-stone-800 bg-stone-900"
          )}>
            {!result && !loading && (
              <p className="text-stone-600 text-sm text-center">
                Add monsters and validate to see difficulty
              </p>
            )}
            {loading && (
              <div className="flex gap-1">
                {[0,1,2].map((i) => (
                  <div key={i} className="w-2 h-2 bg-amber-600 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
            {result && diff && (
              <div className="text-center w-full">
                <p className={clsx("text-3xl font-bold mb-1", diff.color)}>{diff.label}</p>
                <p className="text-xs text-stone-500 mb-3">{result.source}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-stone-900/50 rounded p-2">
                    <p className="text-stone-500">Base XP</p>
                    <p className="text-stone-200 font-mono">{result.totalXp.toLocaleString()}</p>
                  </div>
                  <div className="bg-stone-900/50 rounded p-2">
                    <p className="text-stone-500">Adjusted XP</p>
                    <p className="text-stone-200 font-mono">{result.adjustedXp.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thresholds bar */}
        {result && (
          <div className="border border-stone-800 bg-stone-900 rounded-xl p-4 mb-6">
            <p className="text-xs text-stone-500 mb-3">XP Thresholds</p>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {Object.entries(result.thresholds).map(([label, val]) => (
                <div key={label} className={clsx(
                  "rounded p-2",
                  result.adjustedXp >= val ? "bg-stone-700" : "bg-stone-800"
                )}>
                  <p className="text-stone-400 capitalize">{label}</p>
                  <p className="text-stone-200 font-mono">{val.toLocaleString()}</p>
                </div>
              ))}
            </div>
            {result.recommendation && (
              <p className="text-xs text-stone-400 mt-3 border-t border-stone-800 pt-3">
                {result.recommendation}
              </p>
            )}
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-500 flex items-center gap-1 mt-2">
                <AlertTriangle size={11} /> {w}
              </p>
            ))}
          </div>
        )}

        {/* Monsters */}
        <div className="border border-stone-800 bg-stone-900 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-300">Monsters</h2>
            <button
              onClick={addMonster}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 rounded-lg text-xs transition-colors"
            >
              <Plus size={12} /> Add Monster
            </button>
          </div>

          <div className="space-y-2">
            {monsters.map((m) => (
              <div key={m.id}>
                {/* Monster row */}
                <div className="flex gap-2 items-center">
                  <MonsterAutocomplete
                    value={m.name}
                    onChange={(v) => updateMonster(m.id, "name", v)}
                    onSelectMonster={(name, cr) => selectMonster(m.id, name, cr)}
                  />
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-stone-600">CR</label>
                    <select
                      value={m.cr}
                      onChange={(e) => updateMonster(m.id, "cr", e.target.value)}
                      className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 w-20"
                    >
                      {CR_OPTIONS.map((cr) => <option key={cr} value={cr}>{cr}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-stone-600">×</label>
                    <input
                      type="number" min={1} max={50} value={m.count}
                      onChange={(e) => updateMonster(m.id, "count", Number(e.target.value))}
                      className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 text-center"
                    />
                  </div>
                  {/* Expand stat block button */}
                  <button
                    onClick={() => toggleExpand(m.id)}
                    disabled={!m.name.trim()}
                    title="Ver bloque de estadísticas"
                    className={clsx(
                      "p-2 rounded-lg transition-colors",
                      m.expanded
                        ? "text-amber-400 bg-amber-900/30"
                        : "text-stone-600 hover:text-stone-300 disabled:opacity-30"
                    )}
                  >
                    {m.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    onClick={() => removeMonster(m.id)}
                    className="p-2 text-stone-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Stat block panel */}
                {m.expanded && m.name.trim() && (
                  <MonsterStatBlockPanel name={m.name} />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4 flex items-center gap-1">
            <AlertTriangle size={14} /> {error}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={validate}
            disabled={loading || monsters.length === 0}
            className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-bold rounded-xl transition-colors"
          >
            {loading ? "Validating..." : "Validate Encounter"}
          </button>

          {result && (
            <button
              onClick={saveEncounter}
              disabled={saving || !activeCampaign}
              title={!activeCampaign ? "Selecciona una campaña primero" : "Guardar encuentro"}
              className={clsx(
                "flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all",
                saved
                  ? "bg-emerald-700 text-white"
                  : "bg-stone-700 hover:bg-stone-600 text-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : saved ? (
                <Check size={16} />
              ) : (
                <Save size={16} />
              )}
              {saved ? "Guardado" : "Guardar"}
            </button>
          )}
        </div>

        <p className="text-xs text-stone-700 text-center mt-2">
          Uses official D&D 2024 DMG XP thresholds and multipliers
        </p>

        {/* ── Encuentros Guardados ─────────────────────────────────────────── */}
        <div className="mt-10 border-t border-stone-800 pt-8">
          <div className="flex items-center gap-2 mb-4">
            <History size={16} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-stone-200">Encuentros Guardados</h2>
          </div>

          {!activeCampaign && (
            <p className="text-stone-500 text-sm">Selecciona una campaña para ver encuentros guardados.</p>
          )}

          {activeCampaign && !savedEncounters && (
            <div className="flex items-center gap-2 text-stone-600 text-sm">
              <Loader2 size={14} className="animate-spin" /> Cargando...
            </div>
          )}

          {savedEncounters && savedEncounters.length === 0 && (
            <p className="text-stone-500 text-sm">No hay encuentros guardados para esta campaña.</p>
          )}

          <div className="space-y-3">
            {savedEncounters?.map((enc) => {
              const dcfg = DIFFICULTY_CONFIG[enc.difficulty as keyof typeof DIFFICULTY_CONFIG];
              const monsterSummary = enc.monsters
                .map((m) => `${m.name} ×${m.count}`)
                .join(", ");
              const dateStr = new Date(enc.createdAt).toLocaleDateString("es-ES", {
                day: "2-digit", month: "short", year: "numeric",
              });

              return (
                <div
                  key={enc.id}
                  className="border border-stone-800 bg-stone-900 rounded-xl p-4 flex gap-4 items-start"
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {dcfg && (
                        <span className={clsx("text-xs font-bold px-2 py-0.5 rounded", dcfg.bg, dcfg.color)}>
                          {dcfg.label}
                        </span>
                      )}
                      <span className="text-xs text-stone-500">{dateStr}</span>
                      <span className="text-xs text-stone-600 font-mono">
                        {enc.adjustedXp.toLocaleString()} XP · Grupo {enc.partySize} · Nv.{enc.partyLevel}
                      </span>
                    </div>
                    <p className="text-sm text-stone-300 truncate">{monsterSummary}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => loadEncounter(enc)}
                      title="Cargar en el validador"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 rounded-lg text-xs transition-colors"
                    >
                      <RotateCcw size={12} /> Cargar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(enc.id)}
                      title="Eliminar encuentro"
                      className="p-1.5 text-stone-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Modal de confirmación de borrado ──────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 max-w-sm w-full">
            <p className="text-stone-200 font-semibold mb-2">¿Eliminar encuentro?</p>
            <p className="text-stone-500 text-sm mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 border border-stone-700 text-stone-400 rounded-lg hover:border-stone-500 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteEncounter(confirmDelete)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
