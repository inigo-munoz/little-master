"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Plus, Swords, Users, BookOpen, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Campaign } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { StatusBadge } from "../../components/ui/Badge";
import { useAppStore } from "../../store/app.store";
import Link from "next/link";

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
    } catch (err: any) {
      setError(err.message ?? "Failed to create campaign");
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

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { setActiveCampaign, activeCampaignId } = useAppStore();
  const isActive = campaign.id === activeCampaignId;

  return (
    <div
      className={clsx(
        "border rounded-xl p-5 transition-all cursor-pointer group",
        isActive
          ? "border-amber-600 bg-amber-950/20"
          : "border-stone-800 bg-stone-900 hover:border-stone-600"
      )}
      onClick={() => setActiveCampaign(campaign)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Swords
            size={16}
            className={isActive ? "text-amber-400" : "text-stone-500 group-hover:text-stone-400"}
          />
          <h3 className="font-semibold text-stone-100 group-hover:text-white truncate max-w-xs">
            {campaign.title}
          </h3>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {campaign.description && (
        <p className="text-sm text-stone-400 line-clamp-2 mb-4">{campaign.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1">
          <BookOpen size={12} />
          {campaign._count?.sessions ?? 0} sessions
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} />
          {campaign._count?.npcs ?? 0} NPCs
        </span>
        {(campaign._count?.issues ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-amber-500">
            <AlertTriangle size={12} />
            {campaign._count?.issues} open issues
          </span>
        )}
        <span className="ml-auto">{campaign.system}</span>
      </div>

      <div className="mt-4 pt-4 border-t border-stone-800/50 flex gap-3">
        <Link
          href={`/campaigns/${campaign.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          Open Campaign →
        </Link>
        <Link
          href={`/chat?campaignId=${campaign.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
        >
          Assistant
        </Link>
        <Link
          href={`/issues?campaignId=${campaign.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
        >
          Issues
        </Link>
        <Link
          href={`/changelog?campaignId=${campaign.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
        >
          Changelog
        </Link>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const { data: campaigns, error, isLoading } = useSWR("/campaigns", () => api.campaigns.list());
  const [showCreate, setShowCreate] = useState(false);

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
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-stone-900 rounded-xl animate-pulse border border-stone-800" />
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

        <div className="space-y-4">
          {campaigns?.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      </div>

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={(campaign) => {
            mutate("/campaigns");
            setShowCreate(false);
          }}
        />
      )}
    </AppShell>
  );
}
