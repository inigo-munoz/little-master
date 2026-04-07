"use client";

import { useState, Suspense } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { Users, Plus, Pencil, Trash2, X, Search, Download } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Npc, UpdateNpc } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { DetailModal, type ModalEntity } from "../../components/ui/DetailModal";
import { StatusBadge } from "../../components/ui/Badge";
import { useAppStore } from "../../store/app.store";

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

interface NpcFormProps {
  campaignId: string;
  initial?: Partial<Npc>;
  onClose: () => void;
  onSaved: () => void;
}

function NpcForm({ campaignId, initial, onClose, onSaved }: NpcFormProps) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<"alive" | "dead" | "unknown" | "missing">(
    (initial?.status as any) ?? "alive"
  );
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
        const update: UpdateNpc = { name: name.trim(), role, description, status, tags };
        await api.npcs.update(initial.id, update);
      } else {
        await api.npcs.create({ campaignId, name: name.trim(), role, description, status, tags });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message ?? "Failed to save NPC");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-stone-800 flex items-center justify-between">
          <h2 className="font-semibold text-amber-400">{isEdit ? "Edit NPC" : "New NPC"}</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-stone-400 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-stone-400 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="alive">Alive</option>
                <option value="dead">Dead</option>
                <option value="unknown">Unknown</option>
                <option value="missing">Missing</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Blacksmith, Guild Leader, Antagonist..."
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Appearance, personality, motivations..."
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Tags</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="villain, merchant, recurring (comma-separated)"
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
            >
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create NPC"}
            </button>
          </div>
        </form>
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

  async function handleDelete() {
    if (!confirm("Eliminar a " + npc.name + "?")) return;
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
    : "bg-gradient-to-r from-stone-600 to-stone-900";

  return (
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
        <div className="flex items-start gap-3 mb-3">
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
              <div className="flex items-center gap-1">
                <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
                <span className="text-xs text-stone-500 capitalize">{npc.status}</span>
              </div>
            </div>
            {npc.role && (
              <p className="text-xs text-amber-500/80 font-medium">{npc.role}</p>
            )}
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

        {(race || gender || age) && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {race && <span className="text-xs bg-stone-800 border border-stone-700 text-stone-400 px-2 py-0.5 rounded-full">{race}</span>}
            {gender && <span className="text-xs bg-stone-800 border border-stone-700 text-stone-500 px-2 py-0.5 rounded-full">{gender}</span>}
            {age && <span className="text-xs bg-stone-800 border border-stone-700 text-stone-500 px-2 py-0.5 rounded-full">{age}</span>}
          </div>
        )}

        {cleanDesc && (
          <p className="text-xs text-stone-400 leading-relaxed line-clamp-3 mb-3">
            {cleanDesc}
          </p>
        )}

        {allies.length > 0 && (
          <div className="border-t border-stone-800 pt-2.5">
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
  );
}

function NpcsContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { activeCampaign } = useAppStore();
  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<ModalEntity | null>(null);
  const [editNpc, setEditNpc] = useState<Npc | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const swrKey = effectiveCampaignId ? `/npcs/${effectiveCampaignId}` : null;
  const { data: npcs, isLoading } = useSWR(swrKey, () =>
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

      {selected && <DetailModal entity={selected} onClose={() => setSelected(null)} />}
      {(showForm || editNpc) && effectiveCampaignId && (
        <NpcForm
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
