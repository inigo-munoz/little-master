"use client";

import { useState, Suspense } from "react";
import useSWR, { mutate } from "swr";
import {
  ScrollText,
  FileDown,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Session } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { useAppStore } from "../../store/app.store";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

// ─── Inline Edit Row ──────────────────────────────────────────────────────────

function SessionRow({ session, onUpdated }: { session: Session; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    title: session.title,
    summary: session.summary ?? "",
    notes: session.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  function startEdit() {
    setForm({
      title: session.title,
      summary: session.summary ?? "",
      notes: session.notes ?? "",
    });
    setEditing(true);
    setExpanded(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.sessions.update(session.id, {
        title: form.title,
        summary: form.summary || undefined,
        notes: form.notes || undefined,
      });
      onUpdated();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditing(false);
    setForm({
      title: session.title,
      summary: session.summary ?? "",
      notes: session.notes ?? "",
    });
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`${BACKEND}/api/pdf/session/${session.id}`);
      if (!res.ok) throw new Error("Error generating PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sesion-${session.sessionNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdf(false);
    }
  }

  const dateStr = session.playedAt
    ? new Date(session.playedAt).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="border border-stone-800 bg-stone-900 rounded-xl overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-stone-500 hover:text-stone-300 transition-colors shrink-0"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-900/30 text-amber-400 text-sm font-bold shrink-0">
          #{session.sessionNumber}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full bg-stone-800 border border-amber-700 rounded px-2 py-1 text-stone-100 text-sm focus:outline-none"
              autoFocus
            />
          ) : (
            <p className="font-medium text-stone-100 text-sm truncate">{session.title}</p>
          )}
          {dateStr && <p className="text-xs text-stone-500 mt-0.5">{dateStr}</p>}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="p-1.5 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                title="Guardar"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button
                onClick={handleCancel}
                className="p-1.5 text-stone-500 hover:text-stone-300 transition-colors"
                title="Cancelar"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                className="p-1.5 text-stone-600 hover:text-amber-400 transition-colors"
                title="Editar"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="p-1.5 text-stone-600 hover:text-amber-400 transition-colors"
                title="Descargar PDF"
              >
                {downloadingPdf ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileDown size={14} />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cuerpo expandible */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-stone-800 pt-3 space-y-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Resumen</label>
            {editing ? (
              <textarea
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                rows={4}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none"
                placeholder="Resumen de lo ocurrido en la sesión..."
              />
            ) : (
              <p className="text-stone-400 text-sm whitespace-pre-wrap">
                {session.summary || <em className="text-stone-600">Sin resumen</em>}
              </p>
            )}
          </div>

          {(editing || session.notes) && (
            <div>
              <label className="block text-xs text-stone-500 mb-1">Notas del DM</label>
              {editing ? (
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none"
                  placeholder="Notas privadas del DM..."
                />
              ) : (
                <p className="text-stone-400 text-sm whitespace-pre-wrap">{session.notes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Session Modal ─────────────────────────────────────────────────────────

function NewSessionModal({
  campaignId,
  nextNumber,
  onClose,
  onCreated,
}: {
  campaignId: string;
  nextNumber: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [sessionNumber, setSessionNumber] = useState(nextNumber);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.sessions.create({
        campaignId,
        title: title.trim(),
        sessionNumber,
        summary: summary.trim() || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-400">Nueva Sesión</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Nº Sesión</label>
              <input
                type="number"
                min={1}
                value={sessionNumber}
                onChange={(e) => setSessionNumber(parseInt(e.target.value) || 1)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 text-center"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-stone-500 mb-1">Título *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                placeholder="La cueva del dragón..."
                required
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Resumen (opcional)</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Resumen de lo ocurrido en la sesión..."
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
              disabled={loading || !title.trim()}
              className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
            >
              {loading ? "Creando..." : "Crear sesión"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Content ──────────────────────────────────────────────────────────────

function SessionsContent() {
  const { activeCampaign } = useAppStore();
  const [showNewSession, setShowNewSession] = useState(false);

  const swrKey = activeCampaign ? `/sessions/${activeCampaign.id}` : null;
  const { data: sessions, isLoading } = useSWR(swrKey, () =>
    activeCampaign ? api.sessions.list(activeCampaign.id) : Promise.resolve([])
  );

  const refresh = () => mutate(swrKey ?? "");

  const nextNumber = sessions ? (Math.max(0, ...sessions.map((s) => s.sessionNumber)) + 1) : 1;

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
              <ScrollText size={22} className="text-amber-400" />
              Sesiones
            </h1>
            {activeCampaign && (
              <p className="text-stone-500 text-sm mt-1">{activeCampaign.title}</p>
            )}
          </div>
          {activeCampaign && (
            <button
              onClick={() => setShowNewSession(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
            >
              <Plus size={14} />
              Nueva sesión
            </button>
          )}
        </div>

        {!activeCampaign && (
          <div className="text-center py-16 border border-stone-800 rounded-xl">
            <ScrollText size={40} className="text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500">No hay campaña activa</p>
            <p className="text-stone-600 text-sm mt-1">
              Selecciona una campaña en la sección Campaigns para ver sus sesiones
            </p>
          </div>
        )}

        {activeCampaign && isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-stone-900 rounded-xl animate-pulse border border-stone-800" />
            ))}
          </div>
        )}

        {activeCampaign && !isLoading && sessions?.length === 0 && (
          <div className="text-center py-16 border border-stone-800 rounded-xl">
            <ScrollText size={40} className="text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500">No hay sesiones registradas</p>
            <p className="text-stone-600 text-sm mt-1">
              Crea la primera sesión de la campaña
            </p>
          </div>
        )}

        {sessions && sessions.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-stone-600 mb-4">
              {sessions.length} sesión{sessions.length !== 1 ? "es" : ""} · ordenadas por número descendente
            </p>
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} onUpdated={refresh} />
            ))}
          </div>
        )}
      </div>

      {showNewSession && activeCampaign && (
        <NewSessionModal
          campaignId={activeCampaign.id}
          nextNumber={nextNumber}
          onClose={() => setShowNewSession(false)}
          onCreated={() => {
            setShowNewSession(false);
            refresh();
          }}
        />
      )}
    </AppShell>
  );
}

export default function SessionsPage() {
  return <Suspense><SessionsContent /></Suspense>;
}
