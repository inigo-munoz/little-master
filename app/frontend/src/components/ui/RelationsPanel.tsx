"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Plus, X } from "lucide-react";
import { api, type RelationItem, type CreateEntityRelationPayload } from "../../lib/api";
import { RELATION_TYPES, getRelationPairKey } from "@dnd/shared";

// ─── Tipos locales ────────────────────────────────────────────────────────────
type EntityKind = "npc" | "faction" | "location";

interface EntityOption {
  id: string;
  name: string;
}

interface RelationsPanelProps {
  campaignId: string;
  entityType: EntityKind;
  entityId: string;
}

const ENTITY_LABELS: Record<EntityKind, string> = {
  npc: "PNJ",
  faction: "Facción",
  location: "Localización",
};

// ─── Hook para cargar opciones de entidades ───────────────────────────────────
function useEntityOptions(campaignId: string, type: EntityKind | "") {
  const { data } = useSWR(
    type ? `entity-options-${campaignId}-${type}` : null,
    async () => {
      if (type === "npc") {
        const items = await api.npcs.list(campaignId);
        return items.map((n) => ({ id: n.id, name: n.name }));
      }
      if (type === "faction") {
        const items = await api.factions.list(campaignId);
        return items.map((f) => ({ id: f.id, name: f.name }));
      }
      const items = await api.locations.list(campaignId);
      return items.map((l) => ({ id: l.id, name: l.name }));
    }
  );
  return (data ?? []) as EntityOption[];
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function RelationsPanel({
  campaignId,
  entityType,
  entityId,
}: RelationsPanelProps) {
  const swrKey = `relations-${campaignId}-${entityType}-${entityId}`;

  const { data: relations = [], isLoading } = useSWR<RelationItem[]>(swrKey, () =>
    api.relations.list(campaignId, entityType, entityId)
  );

  const [showForm, setShowForm] = useState(false);
  const [targetType, setTargetType] = useState<EntityKind | "">("");
  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetOptions = useEntityOptions(campaignId, targetType);

  // Lista de tipos de relación válidos para el par actual
  const pairKey = targetType ? getRelationPairKey(entityType, targetType) : null;
  const availableTypes: readonly string[] = pairKey
    ? (RELATION_TYPES[pairKey] as readonly string[])
    : [];

  function resetForm() {
    setTargetType("");
    setTargetId("");
    setRelationType("");
    setNotes("");
    setError(null);
    setShowForm(false);
  }

  async function handleSave() {
    if (!targetType || !targetId || !relationType) {
      setError("Selecciona entidad, tipo de entidad y tipo de relación.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateEntityRelationPayload = {
        campaignId,
        fromType: entityType,
        fromId: entityId,
        toType: targetType,
        toId: targetId,
        relationType,
        notes: notes || null,
      };
      await api.relations.create(payload);
      await mutate(swrKey);
      resetForm();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar la relación");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.relations.delete(id);
      await mutate(swrKey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al eliminar la relación");
    }
  }

  return (
    <div className="mt-6 pt-4 border-t border-stone-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Relaciones
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-stone-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
          >
            <Plus size={12} /> Añadir
          </button>
        )}
      </div>

      {/* Lista de relaciones existentes */}
      {isLoading ? (
        <p className="text-xs text-stone-500">Cargando...</p>
      ) : relations.length === 0 && !showForm ? (
        <p className="text-xs text-stone-500 italic">Sin relaciones registradas.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {relations.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 text-sm group"
            >
              <span className="px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 text-xs font-medium whitespace-nowrap">
                {r.relationType}
              </span>
              <span className="text-stone-300 truncate flex-1">
                {ENTITY_LABELS[r.entity.type]} — {r.entity.name}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="text-stone-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Eliminar relación"
                aria-label="Eliminar relación"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Formulario inline */}
      {showForm && (
        <div className="bg-stone-800/60 rounded-lg p-3 space-y-2">
          {/* Tipo de entidad destino */}
          <div>
            <label className="block text-xs text-stone-400 mb-1">Tipo de entidad</label>
            <select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as EntityKind | "");
                setTargetId("");
                setRelationType("");
              }}
              className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">Seleccionar...</option>
              {(["npc", "faction", "location"] as EntityKind[]).map((t) => (
                <option key={t} value={t}>
                  {ENTITY_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Entidad destino */}
          {targetType && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">
                {ENTITY_LABELS[targetType]}
              </label>
              <select
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  setRelationType("");
                }}
                className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Seleccionar...</option>
                {targetOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tipo de relación */}
          {targetId && availableTypes.length > 0 && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">Tipo de relación</label>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Seleccionar...</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notas opcionales */}
          {relationType && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">
                Notas <span className="text-stone-600">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Contexto narrativo..."
                className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-500 resize-none focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !relationType}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
