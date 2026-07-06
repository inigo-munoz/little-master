"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Search, X, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { MonsterDetail } from "../../lib/api";
import { crToNumber } from "../../lib/monster-types";

const CR_OPTIONS = [
  "0", "1/8", "1/4", "1/2",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "30",
];

interface MonsterPickerProps {
  onSelect: (monster: MonsterDetail) => void;
}

export function MonsterPicker({ onSelect }: MonsterPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [crFilter, setCrFilter] = useState("");
  const [loadingName, setLoadingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: monsters } = useSWR("/api/srd/monsters", () => api.srd.monsters());

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return (monsters ?? []).filter(m => {
      if (crFilter && m.cr !== crFilter) return false;
      if (s && !m.name.toLowerCase().includes(s) && !m.type.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [monsters, search, crFilter]);

  async function handleSelect(name: string) {
    setLoadingName(name);
    setError(null);
    try {
      const detail = await api.srd.monsterDetail(name);
      if (detail) {
        onSelect(detail);
        setOpen(false);
        setSearch("");
        setCrFilter("");
      }
    } catch (err) {
      console.error("MonsterPicker: no se pudo cargar el detalle del monstruo", err);
      setError(`No se pudo cargar "${name}". Intentá de nuevo.`);
    } finally {
      setLoadingName(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-dashed border-violet-700 text-violet-400 hover:border-violet-500 hover:text-violet-300 transition-colors"
      >
        <Search size={14} />
        Importar desde el SRD{monsters ? ` (${monsters.length} criaturas)` : ""}
      </button>
    );
  }

  return (
    <div className="border border-violet-700/50 rounded-lg bg-stone-950/80 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-400">SRD 5.2.1</span>
        <button type="button" onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-300">
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o tipo..."
            className="w-full bg-stone-800 border border-stone-700 rounded pl-7 pr-2 py-1.5 text-stone-100 text-xs focus:outline-none focus:border-violet-500"
            autoFocus
          />
        </div>
        <div className="relative">
          <select
            value={crFilter}
            onChange={e => setCrFilter(e.target.value)}
            className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-100 text-xs focus:outline-none focus:border-violet-500 appearance-none pr-6"
          >
            <option value="">VD: Todos</option>
            {CR_OPTIONS.map(cr => (
              <option key={cr} value={cr}>VD {cr}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </p>
      )}

      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {!monsters ? (
          <p className="text-xs text-stone-600 text-center py-4">Cargando criaturas...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-stone-600 text-center py-4">Sin resultados</p>
        ) : (
          filtered.slice(0, 50).map(m => (
            <button
              key={m.name}
              type="button"
              disabled={loadingName !== null}
              onClick={() => handleSelect(m.name)}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-stone-800 transition-colors group disabled:opacity-50"
            >
              <span className={clsx(
                "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
                crToNumber(m.cr) >= 10 ? "bg-red-900/60 text-red-300"
                  : crToNumber(m.cr) >= 5 ? "bg-amber-900/60 text-amber-300"
                  : "bg-stone-700 text-stone-300"
              )}>
                VD {m.cr}
              </span>
              <span className="text-xs text-stone-200 group-hover:text-stone-100 truncate flex-1">{m.name}</span>
              <span className="text-[10px] text-stone-600 shrink-0">{m.type} · {m.size}</span>
              {m.ac !== undefined && m.hp !== undefined && (
                <span className="text-[10px] text-stone-600 shrink-0">CA {m.ac} · PG {m.hp}</span>
              )}
              {loadingName === m.name && <Loader2 size={12} className="animate-spin text-violet-400 shrink-0" />}
            </button>
          ))
        )}
        {filtered.length > 50 && (
          <p className="text-[10px] text-stone-600 text-center pt-2">
            Mostrando 50 de {filtered.length} — refiná la búsqueda
          </p>
        )}
      </div>
    </div>
  );
}
