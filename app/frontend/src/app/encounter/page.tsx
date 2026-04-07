"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import useSWR from "swr";
import { Swords, Plus, Trash2, AlertTriangle, Shield } from "lucide-react";
import { clsx } from "clsx";
import { AppShell } from "../../components/layout/AppShell";
import { useAppStore } from "../../store/app.store";
import { api } from "../../lib/api";

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

interface MonsterEntry { id: string; name: string; cr: string; count: number; }

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EncounterPage() {
  const { activeCampaign } = useAppStore();

  const [partySize, setPartySize] = useState(4);
  const [avgLevel, setAvgLevel] = useState(5);
  const [monsters, setMonsters] = useState<MonsterEntry[]>([
    { id: "1", name: "Goblin", cr: "1/4", count: 4 },
  ]);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addMonster() {
    setMonsters((m) => [...m, { id: crypto.randomUUID(), name: "", cr: "1", count: 1 }]);
  }

  function removeMonster(id: string) {
    setMonsters((m) => m.filter((x) => x.id !== id));
  }

  function updateMonster(id: string, field: keyof MonsterEntry, value: string | number) {
    setMonsters((m) => m.map((x) => x.id === id ? { ...x, [field]: value } : x));
  }

  function selectMonster(id: string, name: string, cr: string) {
    setMonsters((m) => m.map((x) => x.id === id ? { ...x, name, cr } : x));
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

  const diff = result ? DIFFICULTY_CONFIG[result.difficulty] : null;

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Swords size={20} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-stone-100">Encounter Validator</h1>
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
              <div key={m.id} className="flex gap-2 items-center">
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
                <button
                  onClick={() => removeMonster(m.id)}
                  className="p-2 text-stone-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4 flex items-center gap-1">
            <AlertTriangle size={14} /> {error}
          </p>
        )}

        <button
          onClick={validate}
          disabled={loading || monsters.length === 0}
          className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-bold rounded-xl transition-colors"
        >
          {loading ? "Validating..." : "Validate Encounter"}
        </button>

        <p className="text-xs text-stone-700 text-center mt-2">
          Uses official D&D 2024 DMG XP thresholds and multipliers
        </p>
      </div>
    </AppShell>
  );
}
