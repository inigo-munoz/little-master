"use client";

import { useState, Suspense } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { Users, Plus, Pencil, Trash2, X, Search, Download } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Faction } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { DetailModal, type ModalEntity } from "../../components/ui/DetailModal";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { useAppStore } from "../../store/app.store";
import { getPdfUrl } from "../../lib/backend-url";

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

interface FactionFormProps {
  campaignId: string;
  initial?: Partial<Faction>;
  onClose: () => void;
  onSaved: () => void;
}

function FactionForm({ campaignId, initial, onClose, onSaved }: FactionFormProps) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [alignment, setAlignment] = useState(initial?.alignment ?? "");
  const [disposition, setDisposition] = useState(initial?.disposition ?? "unknown");
  const [tagInput, setTagInput] = useState(parseTags(initial?.tags ?? "[]").join(", "));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (isEdit && initial?.id) {
        await api.factions.update(initial.id, { name: name.trim(), description, alignment, disposition, tags });
      } else {
        await api.factions.create({ campaignId, name: name.trim(), description, alignment, disposition, tags });
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar la facción");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-stone-800 flex items-center justify-between">
          <h2 className="font-semibold text-amber-400">
            {isEdit ? "Editar Facción" : "Nueva Facción"}
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-stone-400 mb-1">Nombre *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-stone-400 mb-1">Disposición</label>
              <select
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="unknown">Desconocida</option>
                <option value="allied">Aliada</option>
                <option value="neutral">Neutral</option>
                <option value="hostile">Hostil</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-stone-400 mb-1">Alineamiento</label>
              <input
                type="text"
                value={alignment}
                onChange={(e) => setAlignment(e.target.value)}
                placeholder="Neutral malvado..."
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Historia, objetivos, estructura de poder..."
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Tags</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="criminal, gremio, religioso (separados por coma)"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-stone-700 text-stone-400 rounded-lg hover:border-stone-500 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
            >
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear Facción"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const DISPOSITION_COLORS: Record<string, string> = {
  allied: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
  neutral: "text-stone-400 bg-stone-800 border-stone-700",
  hostile: "text-red-400 bg-red-950/40 border-red-900/40",
  unknown: "text-stone-500 bg-stone-800/50 border-stone-700/50",
};

const DISPOSITION_LABELS: Record<string, string> = {
  allied: "Aliada",
  neutral: "Neutral",
  hostile: "Hostil",
  unknown: "Desconocida",
};

function FactionCard({
  faction,
  onEdit,
  onDelete,
  onView,
}: {
  faction: Faction;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const tags = parseTags(faction.tags);

  const cleanDesc = (faction.description ?? "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 200);

  async function doDelete() {
    setShowConfirm(false);
    setDeleting(true);
    try {
      await api.factions.delete(faction.id);
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const dispositionStyle = DISPOSITION_COLORS[faction.disposition ?? "unknown"] ?? DISPOSITION_COLORS["unknown"]!;

  return (
    <>
    <div
      className="group relative border border-stone-800 bg-stone-900 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5 hover:border-stone-700"
      onClick={onView}
    >
      <div className="h-0.5 w-full bg-gradient-to-r from-purple-600 to-purple-900" />
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-purple-950 border border-purple-800 shrink-0 flex items-center justify-center">
            <Users size={16} className="text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-stone-100 text-base leading-tight">{faction.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={clsx("text-xs px-2 py-0.5 rounded-full border capitalize", dispositionStyle)}>
                {DISPOSITION_LABELS[faction.disposition ?? "unknown"] ?? "Desconocida"}
              </span>
              {faction.alignment && (
                <span className="text-xs text-stone-500">{faction.alignment}</span>
              )}
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={getPdfUrl(`/api/pdf/faction/${faction.id}`)}
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
              aria-label="Editar facción"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
              disabled={deleting}
              className="p-1.5 text-stone-600 hover:text-red-400 transition-colors rounded"
              aria-label="Eliminar facción"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        {cleanDesc && (
          <p className="text-xs text-stone-400 leading-relaxed line-clamp-3 mb-2">{cleanDesc}</p>
        )}
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="text-xs bg-stone-800 border border-stone-700 text-stone-500 px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
    <ConfirmModal
      isOpen={showConfirm}
      title="Eliminar facción"
      message={`¿Eliminar facción ${faction.name}?`}
      onConfirm={doDelete}
      onCancel={() => setShowConfirm(false)}
    />
    </>
  );
}

function FactionsContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { activeCampaign, _hasHydrated } = useAppStore();
  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<ModalEntity | null>(null);
  const [editFaction, setEditFaction] = useState<Faction | null>(null);
  const [search, setSearch] = useState("");

  const swrKey = effectiveCampaignId ? `/factions/${effectiveCampaignId}` : null;
  const { data: factions, error: swrError, isLoading } = useSWR(swrKey, () =>
    api.factions.list(effectiveCampaignId!)
  );

  const refresh = () => mutate(swrKey);

  const filtered = factions?.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

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
              <Users size={22} className="text-purple-400" />
              Facciones
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
              Nueva Facción
            </button>
          )}
        </div>

        {!effectiveCampaignId && (
          <div className="border border-amber-800 bg-amber-950/30 rounded-lg p-4 text-amber-400 text-sm">
            Selecciona una campaña para gestionar sus facciones.
          </div>
        )}

        {effectiveCampaignId && (
          <div className="flex-1 relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full bg-stone-900 border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
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
              {search ? "Sin resultados" : "No hay facciones aún"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered?.map((faction) => (
            <FactionCard
              key={faction.id}
              faction={faction}
              onEdit={() => setEditFaction(faction)}
              onDelete={refresh}
              onView={() => setSelected({ type: "faction", data: faction })}
            />
          ))}
        </div>
      </div>

      {selected && <DetailModal entity={selected} onClose={() => setSelected(null)} campaignId={effectiveCampaignId} />}
      {(showForm || editFaction) && effectiveCampaignId && (
        <FactionForm
          campaignId={effectiveCampaignId}
          initial={editFaction ?? undefined}
          onClose={() => { setShowForm(false); setEditFaction(null); }}
          onSaved={() => { setShowForm(false); setEditFaction(null); refresh(); }}
        />
      )}
    </AppShell>
  );
}

export default function FactionsPage() {
  return <Suspense><FactionsContent /></Suspense>;
}
