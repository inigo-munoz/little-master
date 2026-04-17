"use client";

import { useState, Suspense } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { Users, Shield, Heart, Star, X, Plus } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Player } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { DetailModal, type ModalEntity } from "../../components/ui/DetailModal";
import { StatusBadge } from "../../components/ui/Badge";
import { useAppStore } from "../../store/app.store";
import {
  DND_CLASSES,
  DND_SPECIES,
  DND_SPECIES_VARIANTS,
} from "../../lib/dnd-2024-data";

// ─── PlayerForm ───────────────────────────────────────────────────────────────

interface PlayerFormProps {
  campaignId: string;
  onClose: () => void;
  onSaved: () => void;
}

const SORTED_CLASSES = Object.keys(DND_CLASSES).sort();

const SPECIES_VARIANT_LABEL: Record<string, string> = {
  "Dracónido": "Ascendencia",
  "Elfo": "Linaje",
  "Gnomo": "Linaje",
  "Goliath": "Ascendencia",
  "Tiefling": "Legado",
};

function PlayerForm({ campaignId, onClose, onSaved }: PlayerFormProps) {
  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerClass, setPlayerClass] = useState("");
  const [subclass, setSubclass] = useState("");
  const [species, setSpeciesState] = useState("");
  const [speciesVariant, setSpeciesVariant] = useState("");
  const [level, setLevel] = useState(1);
  const [hpMax, setHpMax] = useState("");
  const [ac, setAc] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "dead" | "retired">("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Subclases de la clase seleccionada; subclase solo editable en nivel >= 3
  const availableSubclasses = playerClass ? (DND_CLASSES[playerClass] ?? []) : [];
  const showSubclass = !!playerClass && level >= 3;

  // Variantes de la especie seleccionada — hasOwnProperty evita falsos negativos con índices string
  const speciesVariants = species && Object.prototype.hasOwnProperty.call(DND_SPECIES_VARIANTS, species)
    ? DND_SPECIES_VARIANTS[species] ?? []
    : [];
  const variantLabel = (species && Object.prototype.hasOwnProperty.call(SPECIES_VARIANT_LABEL, species)
    ? SPECIES_VARIANT_LABEL[species]
    : undefined) ?? "Linaje";

  function handleClassChange(cls: string) {
    setPlayerClass(cls);
    setSubclass("");
  }

  function handleLevelChange(v: number) {
    setLevel(v);
    if (v < 3) setSubclass("");
  }

  function handleSpeciesChange(sp: string) {
    setSpeciesState(sp);
    setSpeciesVariant("");
  }

  // El campo race almacena "Especie (Variante)" o simplemente "Especie"
  function getRaceValue(): string {
    if (!species) return "";
    return speciesVariant ? `${species} (${speciesVariant})` : species;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.players.create({
        campaignId,
        name: name.trim(),
        playerName: playerName.trim() || undefined,
        class: playerClass || undefined,
        subclass: subclass || undefined,
        race: getRaceValue() || undefined,
        level,
        hp: hpMax ? parseInt(hpMax, 10) : undefined,
        ac: ac ? parseInt(ac, 10) : undefined,
        status,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message ?? "Error al guardar el jugador");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500";
  const selectCls = "w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed";
  const labelCls = "block text-sm text-stone-400 mb-1";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-stone-800 flex items-center justify-between sticky top-0 bg-stone-900 z-10">
          <h2 className="font-semibold text-amber-400">Nuevo Jugador</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Lyra Moonwhisper"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className={selectCls}
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="dead">Muerto</option>
                <option value="retired">Retirado</option>
              </select>
            </div>
          </div>

          {/* Nombre real del jugador */}
          <div>
            <label className={labelCls}>Nombre del jugador real</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className={inputCls}
              placeholder="Juan García"
            />
          </div>

          {/* Clase + Nivel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Clase</label>
              <select
                value={playerClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className={selectCls}
              >
                <option value="">Selecciona clase</option>
                {SORTED_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nivel</label>
              <input
                type="number"
                min={1}
                max={20}
                value={level}
                onChange={(e) => handleLevelChange(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className={inputCls}
              />
            </div>
          </div>

          {/* Subclase — condicional: solo si hay clase y nivel >= 3 */}
          <div>
            <label className={labelCls}>Subclase</label>
            {showSubclass ? (
              <select
                value={subclass}
                onChange={(e) => setSubclass(e.target.value)}
                className={selectCls}
              >
                <option value="">Selecciona subclase</option>
                {availableSubclasses.map((sc) => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
                <option value="Homebrew / Otra">Homebrew / Otra</option>
              </select>
            ) : (
              <p className="text-xs text-stone-500 italic py-2 px-1">
                {playerClass ? "La subclase se elige al nivel 3" : "Selecciona una clase primero"}
              </p>
            )}
          </div>

          {/* Especie + Subtipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Especie</label>
              <select
                value={species}
                onChange={(e) => handleSpeciesChange(e.target.value)}
                className={selectCls}
              >
                <option value="">Selecciona especie</option>
                {DND_SPECIES.map((sp) => (
                  <option key={sp} value={sp}>{sp}</option>
                ))}
                <option value="Otra (homebrew)">Otra (homebrew)</option>
              </select>
            </div>
            {speciesVariants.length > 0 && (
              <div>
                <label className={labelCls}>{variantLabel}</label>
                <select
                  value={speciesVariant}
                  onChange={(e) => setSpeciesVariant(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Selecciona {variantLabel.toLowerCase()}</option>
                  {speciesVariants.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* HP máximo + CA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>HP máximo</label>
              <input
                type="number"
                min={1}
                value={hpMax}
                onChange={(e) => setHpMax(e.target.value)}
                className={inputCls}
                placeholder="—"
              />
            </div>
            <div>
              <label className={labelCls}>CA (Clase de Armadura)</label>
              <input
                type="number"
                min={1}
                value={ac}
                onChange={(e) => setAc(e.target.value)}
                className={inputCls}
                placeholder="—"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? "Guardando..." : "Guardar Jugador"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

function PlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
  return (
    <div
      className="border border-stone-800 bg-stone-900 rounded-xl p-5 hover:border-stone-700 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-amber-900 border border-amber-700 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
              {player.name[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-stone-100">{player.name}</p>
              {player.playerName && (
                <p className="text-xs text-stone-500">Jugador: {player.playerName}</p>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={player.status} />
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        {player.class && (
          <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
            {player.class}
          </span>
        )}
        {player.race && (
          <span className="text-xs bg-stone-800 text-stone-400 border border-stone-700 px-2 py-0.5 rounded">
            {player.race}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-stone-800 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Star size={11} className="text-amber-400" />
            <span className="text-xs text-stone-500">Nivel</span>
          </div>
          <p className="text-lg font-bold text-amber-400">{player.level}</p>
        </div>
        {player.hp !== null && player.hp !== undefined && (
          <div className="bg-stone-800 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Heart size={11} className="text-red-400" />
              <span className="text-xs text-stone-500">HP</span>
            </div>
            <p className="text-lg font-bold text-red-400">{player.hp}</p>
          </div>
        )}
        {player.ac !== null && player.ac !== undefined && (
          <div className="bg-stone-800 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Shield size={11} className="text-blue-400" />
              <span className="text-xs text-stone-500">CA</span>
            </div>
            <p className="text-lg font-bold text-blue-400">{player.ac}</p>
          </div>
        )}
      </div>

      {player.notes && (
        <p className="text-xs text-stone-500 mt-3 line-clamp-2">{player.notes}</p>
      )}
    </div>
  );
}

// ─── PlayersContent ───────────────────────────────────────────────────────────

function PlayersContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { activeCampaign, _hasHydrated } = useAppStore();
  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  const [selected, setSelected] = useState<ModalEntity | null>(null);
  const [showForm, setShowForm] = useState(false);

  const swrKey = effectiveCampaignId ? `/players/${effectiveCampaignId}` : null;
  const { data: players, isLoading, mutate } = useSWR(swrKey, () =>
    api.players.list(effectiveCampaignId!)
  );

  const active = players?.filter((p) => p.status === "active") ?? [];
  const inactive = players?.filter((p) => p.status !== "active") ?? [];

  if (!_hasHydrated && !campaignId) return null;

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Users size={22} className="text-amber-400" />
            <h1 className="text-2xl font-bold text-stone-100">Jugadores</h1>
            {players && (
              <span className="text-stone-600 text-sm ml-1">({players.length})</span>
            )}
          </div>
          {effectiveCampaignId && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium rounded-lg text-sm transition-colors"
            >
              <Plus size={14} />
              Nuevo Jugador
            </button>
          )}
        </div>

        {!effectiveCampaignId && (
          <div className="border border-amber-800 bg-amber-950/30 rounded-lg p-4 text-amber-400 text-sm">
            Selecciona una campaña para ver sus jugadores.
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-stone-900 rounded-xl animate-pulse border border-stone-800" />
            ))}
          </div>
        )}

        {players?.length === 0 && !isLoading && (
          <div className="text-center py-16 border border-stone-800 rounded-xl">
            <Users size={40} className="text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500">No hay jugadores registrados</p>
            <p className="text-stone-600 text-sm mt-1">
              Usa "+ Nuevo Jugador" o importa tu vault de Obsidian desde Settings
            </p>
          </div>
        )}

        {active.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">
              Activos ({active.length})
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {active.map((p) => (
                <PlayerCard key={p.id} player={p} onClick={() => setSelected({ type: "player", data: p })} />
              ))}
            </div>
          </div>
        )}

        {inactive.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">
              Inactivos / Retirados ({inactive.length})
            </h2>
            <div className="grid grid-cols-2 gap-4 opacity-60">
              {inactive.map((p) => (
                <PlayerCard key={p.id} player={p} onClick={() => setSelected({ type: "player", data: p })} />
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && <DetailModal entity={selected} onClose={() => setSelected(null)} campaignId={effectiveCampaignId} />}

      {showForm && effectiveCampaignId && (
        <PlayerForm
          campaignId={effectiveCampaignId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            mutate();
          }}
        />
      )}
    </AppShell>
  );
}

export default function PlayersPage() {
  return <Suspense><PlayersContent /></Suspense>;
}
