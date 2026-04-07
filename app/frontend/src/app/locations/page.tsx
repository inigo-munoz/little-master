"use client";

import { useState, Suspense } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { MapPin, Plus, Pencil, Trash2, X, Search, Download } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Location } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { DetailModal, type ModalEntity } from "../../components/ui/DetailModal";
import { useAppStore } from "../../store/app.store";

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

interface LocationFormProps {
  campaignId: string;
  initial?: Partial<Location>;
  onClose: () => void;
  onSaved: () => void;
}

function LocationForm({ campaignId, initial, onClose, onSaved }: LocationFormProps) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
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
        await api.locations.update(initial.id, { name: name.trim(), description, tags });
      } else {
        await api.locations.create({ campaignId, name: name.trim(), description, tags });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message ?? "Error al guardar la localización");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-stone-800 flex items-center justify-between">
          <h2 className="font-semibold text-amber-400">
            {isEdit ? "Editar Localización" : "Nueva Localización"}
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <label className="block text-sm text-stone-400 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Historia, descripción física, habitantes..."
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Tags</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="ciudad, dungeon, bosque (separados por coma)"
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
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear Localización"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LocationCard({
  location,
  onEdit,
  onDelete,
  onView,
}: {
  location: Location;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const tags = parseTags(location.tags);

  const cleanDesc = (location.description ?? "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 200);

  async function handleDelete() {
    if (!confirm("¿Eliminar " + location.name + "?")) return;
    setDeleting(true);
    try {
      await api.locations.delete(location.id);
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="group relative border border-stone-800 bg-stone-900 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5 hover:border-stone-700"
      onClick={onView}
    >
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-600 to-emerald-900" />
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800 shrink-0 flex items-center justify-center">
            <MapPin size={16} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-stone-100 text-base leading-tight">{location.name}</h3>
            {tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-xs bg-stone-800 border border-stone-700 text-stone-500 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={`${process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:3001"}/api/pdf/location/${location.id}`}
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
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              disabled={deleting}
              className="p-1.5 text-stone-600 hover:text-red-400 transition-colors rounded"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        {cleanDesc && (
          <p className="text-xs text-stone-400 leading-relaxed line-clamp-3">{cleanDesc}</p>
        )}
      </div>
    </div>
  );
}

function LocationsContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { activeCampaign } = useAppStore();
  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<ModalEntity | null>(null);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [search, setSearch] = useState("");

  const swrKey = effectiveCampaignId ? `/locations/${effectiveCampaignId}` : null;
  const { data: locations, isLoading } = useSWR(swrKey, () =>
    api.locations.list(effectiveCampaignId!)
  );

  const refresh = () => mutate(swrKey);

  const filtered = locations?.filter((l) =>
    !search || l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
              <MapPin size={22} className="text-emerald-400" />
              Localizaciones
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
              Nueva Localización
            </button>
          )}
        </div>

        {!effectiveCampaignId && (
          <div className="border border-amber-800 bg-amber-950/30 rounded-lg p-4 text-amber-400 text-sm">
            Selecciona una campaña para gestionar sus localizaciones.
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
            <MapPin size={40} className="text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500">
              {search ? "Sin resultados" : "No hay localizaciones aún"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered?.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              onEdit={() => setEditLocation(loc)}
              onDelete={refresh}
              onView={() => setSelected({ type: "location", data: loc })}
            />
          ))}
        </div>
      </div>

      {selected && <DetailModal entity={selected} onClose={() => setSelected(null)} />}
      {(showForm || editLocation) && effectiveCampaignId && (
        <LocationForm
          campaignId={effectiveCampaignId}
          initial={editLocation ?? undefined}
          onClose={() => { setShowForm(false); setEditLocation(null); }}
          onSaved={() => { setShowForm(false); setEditLocation(null); refresh(); }}
        />
      )}
    </AppShell>
  );
}

export default function LocationsPage() {
  return <Suspense><LocationsContent /></Suspense>;
}
