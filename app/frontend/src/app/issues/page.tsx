"use client";

import { useState, Suspense } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle, XCircle, Filter } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Issue } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { SeverityBadge, StatusBadge } from "../../components/ui/Badge";
import { useAppStore } from "../../store/app.store";

function ResolveModal({
  issue,
  onClose,
  onResolved,
}: {
  issue: Issue;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResolve() {
    if (!resolution.trim()) return;
    setLoading(true);
    try {
      await api.issues.resolve(issue.id, resolution.trim());
      onResolved();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-stone-800">
          <h2 className="font-semibold text-stone-100">Resolve Issue</h2>
          <p className="text-sm text-stone-400 mt-1">{issue.description}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-stone-400 mb-1">Resolution *</label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500 resize-none text-sm"
              placeholder="How was this resolved?"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-stone-700 text-stone-400 rounded-lg hover:border-stone-500 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={loading || !resolution.trim()}
              className="flex-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
            >
              {loading ? "Resolving..." : "Mark Resolved"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueRow({ issue, onAction }: { issue: Issue; onAction: () => void }) {
  const [showResolve, setShowResolve] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await api.issues.dismiss(issue.id);
      onAction();
    } finally {
      setDismissing(false);
    }
  }

  const isOpen = issue.status === "open" || issue.status === "in_progress";

  return (
    <>
      <div className="border border-stone-800 bg-stone-900 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={16}
            className={clsx(
              "shrink-0 mt-0.5",
              issue.severity === "critical" && "text-red-400",
              issue.severity === "major" && "text-orange-400",
              issue.severity === "minor" && "text-amber-400",
              issue.severity === "info" && "text-stone-500"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <SeverityBadge severity={issue.severity} />
              <StatusBadge status={issue.status} />
              <span className="text-xs text-stone-600">{issue.type.replace(/_/g, " ")}</span>
            </div>
            <p className="text-sm text-stone-300">{issue.description}</p>
            {issue.relatedEntityType && (
              <p className="text-xs text-stone-600 mt-1">
                Entity: {issue.relatedEntityType} / {issue.relatedEntityId}
              </p>
            )}
            {issue.resolution && (
              <div className="mt-2 border-l-2 border-emerald-800 pl-3">
                <p className="text-xs text-stone-500">Resolution: {issue.resolution}</p>
              </div>
            )}
            <p className="text-xs text-stone-700 mt-2">
              {new Date(issue.createdAt).toLocaleDateString()}
              {issue.resolvedAt && ` → resolved ${new Date(issue.resolvedAt).toLocaleDateString()}`}
            </p>
          </div>

          {isOpen && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowResolve(true)}
                className="p-1.5 text-stone-500 hover:text-emerald-400 transition-colors"
                title="Resolve"
              >
                <CheckCircle size={16} />
              </button>
              <button
                onClick={handleDismiss}
                disabled={dismissing}
                className="p-1.5 text-stone-500 hover:text-stone-300 transition-colors"
                title="Dismiss"
              >
                <XCircle size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {showResolve && (
        <ResolveModal
          issue={issue}
          onClose={() => setShowResolve(false)}
          onResolved={() => { setShowResolve(false); onAction(); }}
        />
      )}
    </>
  );
}

function IssuesContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { activeCampaign } = useAppStore();
  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  const [statusFilter, setStatusFilter] = useState<string>("open");

  const { data: issues, error, isLoading } = useSWR(
    effectiveCampaignId ? `/issues/${effectiveCampaignId}/${statusFilter}` : null,
    () => api.issues.list(effectiveCampaignId!, statusFilter === "all" ? undefined : statusFilter)
  );

  const refresh = () => mutate(`/issues/${effectiveCampaignId}/${statusFilter}`);

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-100">Issues</h1>
            {effectiveCampaignId && (
              <p className="text-stone-500 text-sm mt-1">{activeCampaign?.title}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-stone-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {!effectiveCampaignId && (
          <div className="border border-amber-800 bg-amber-950/30 rounded-lg p-4 text-amber-400 text-sm">
            Select a campaign from the Campaigns page to view its issues.
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-stone-900 rounded-lg animate-pulse border border-stone-800" />
            ))}
          </div>
        )}

        {issues?.length === 0 && !isLoading && (
          <div className="text-center py-16 border border-stone-800 rounded-xl">
            <CheckCircle size={40} className="text-emerald-700 mx-auto mb-3" />
            <p className="text-stone-500">No {statusFilter !== "all" ? statusFilter : ""} issues</p>
          </div>
        )}

        <div className="space-y-3">
          {issues?.map((issue) => (
            <IssueRow key={issue.id} issue={issue} onAction={refresh} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default function IssuesPage() {
  return <Suspense><IssuesContent /></Suspense>;
}
