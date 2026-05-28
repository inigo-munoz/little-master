"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Plus, Swords, ChevronRight, Zap } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Campaign } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { StatusBadge } from "../../components/ui/Badge";
import { useAppStore } from "../../store/app.store";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  trivial:    { color: "text-stone-400", bg: "bg-stone-800",   label: "Trivial" },
  easy:       { color: "text-emerald-400", bg: "bg-emerald-950", label: "Easy" },
  medium:     { color: "text-blue-400",  bg: "bg-blue-950",    label: "Medium" },
  hard:       { color: "text-amber-400", bg: "bg-amber-950",   label: "Hard" },
  deadly:     { color: "text-red-400",   bg: "bg-red-950",     label: "Deadly" },
  impossible: { color: "text-red-300",   bg: "bg-red-950",     label: "Impossible" },
} as const;

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`;
  return `hace ${Math.floor(days / 30)} meses`;
}

// ─── Encuentros Recientes Widget ──────────────────────────────────────────────

function EncuentrosRecientes({ campaignId }: { campaignId: string }) {
  const { data: encounters } = useSWR(
    `/encounters-recent/${campaignId}`,
    () => api.encounters.list(campaignId, 5)
  );

  if (!encounters || encounters.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">
            Encuentros Recientes
          </h2>
        </div>
        <Link href="/encounter" className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
          Ver validador →
        </Link>
      </div>

      <div className="space-y-2">
        {encounters.map((enc) => {
          const dcfg = DIFFICULTY_CONFIG[enc.difficulty as keyof typeof DIFFICULTY_CONFIG];
          const summary = enc.monsters.map((m) => `${m.name} ×${m.count}`).join(", ");
          return (
            <Link
              key={enc.id}
              href="/encounter"
              className="flex items-center gap-3 border border-stone-800 bg-stone-900 rounded-lg px-4 py-2.5 hover:border-stone-700 transition-colors group"
            >
              {dcfg && (
                <span className={clsx("text-xs font-bold px-2 py-0.5 rounded shrink-0", dcfg.bg, dcfg.color)}>
                  {dcfg.label}
                </span>
              )}
              <span className="text-sm text-stone-300 truncate flex-1 group-hover:text-stone-100">
                {enc.title || summary}
              </span>
              <span className="text-xs text-stone-600 shrink-0">{relativeDate(enc.createdAt)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CreateCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: Campaign) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState("D&D 2024");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const campaign = await api.campaigns.create({ title: title.trim(), description, system });
      onCreated(campaign);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-stone-800">
          <h2 className="text-lg font-semibold text-amber-400">New Campaign</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-stone-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
              placeholder="The Lost Mines of Andeavion"
              required
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-sm text-stone-400 mb-1">System</label>
            <input
              type="text"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Campaign premise, setting, tone..."
              maxLength={5000}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-stone-700 text-stone-400 rounded-lg hover:border-stone-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors"
            >
              {loading ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const { setActiveCampaign, activeCampaignId } = useAppStore();
  const router = useRouter();
  const isActive = campaign.id === activeCampaignId;

  function handleClick() {
    setActiveCampaign(campaign);
    router.push(`/campaigns/detail?id=${campaign.id}`);
  }

  const counts = [
    { value: campaign._count?.sessions ?? 0, label: "ses." },
    { value: campaign._count?.npcs ?? 0, label: "PNJs" },
    { value: campaign._count?.locations ?? 0, label: "locs." },
    { value: campaign._count?.factions ?? 0, label: "fac." },
    { value: campaign._count?.players ?? 0, label: "PJs" },
  ];

  return (
    <div
      onClick={handleClick}
      className={clsx(
        "flex items-center gap-4 border rounded-xl px-4 py-3.5 cursor-pointer transition-colors group",
        isActive
          ? "border-amber-600 bg-amber-950/20"
          : "border-stone-800 bg-stone-900 hover:border-stone-700"
      )}
    >
      {/* Nombre + sistema */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-100 truncate group-hover:text-white">
          {campaign.title}
        </p>
        <p className="text-xs text-stone-500 mt-0.5">{campaign.system}</p>
      </div>

      {/* Badge estado */}
      <StatusBadge status={campaign.status} />

      {/* Contadores */}
      <div className="hidden sm:flex items-center gap-5">
        {counts.map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="text-sm font-semibold text-amber-400 leading-none">{value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Chevron */}
      <ChevronRight size={16} className="text-stone-600 group-hover:text-stone-400 shrink-0" />
    </div>
  );
}

export default function CampaignsPage() {
  const { data: campaigns, error, isLoading } = useSWR("/campaigns", () => api.campaigns.list());
  const [showCreate, setShowCreate] = useState(false);
  const { activeCampaignId } = useAppStore();

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-stone-100">Campaigns</h1>
            <p className="text-stone-500 text-sm mt-1">
              Select a campaign to set the context for the assistant
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
          >
            <Plus size={16} />
            New Campaign
          </button>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-stone-900 rounded-xl animate-pulse border border-stone-800" />
            ))}
          </div>
        )}

        {error && (
          <div className="border border-red-800 bg-red-950/30 rounded-lg p-4 text-red-400 text-sm">
            Failed to load campaigns. Is the backend running?
          </div>
        )}

        {campaigns && campaigns.length === 0 && !isLoading && (
          <div className="text-center py-20 border border-stone-800 rounded-xl">
            <Swords size={48} className="text-stone-700 mx-auto mb-4" />
            <p className="text-stone-500">No campaigns yet</p>
            <p className="text-stone-600 text-sm mt-1">Create your first campaign to get started</p>
          </div>
        )}

        <div className="space-y-2">
          {campaigns?.map((c) => <CampaignRow key={c.id} campaign={c} />)}
        </div>

        {activeCampaignId && <EncuentrosRecientes campaignId={activeCampaignId} />}
      </div>

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={(_campaign) => {
            mutate("/campaigns");
            setShowCreate(false);
          }}
        />
      )}
    </AppShell>
  );
}
