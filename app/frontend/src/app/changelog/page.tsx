"use client";

import { useState, Suspense } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { ScrollText, ChevronDown, ChevronRight, Bot, User, Cpu } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { ChangeLog } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { useAppStore } from "../../store/app.store";

function DiffView({ before, after }: { before?: string | null; after?: string | null }) {
  const parsedBefore = before ? JSON.parse(before) : null;
  const parsedAfter = after ? JSON.parse(after) : null;

  if (!parsedBefore && !parsedAfter) return null;

  // Show only changed keys
  const allKeys = new Set([
    ...Object.keys(parsedBefore ?? {}),
    ...Object.keys(parsedAfter ?? {}),
  ]);

  const changedKeys = [...allKeys].filter(
    (key) => JSON.stringify(parsedBefore?.[key]) !== JSON.stringify(parsedAfter?.[key])
  );

  if (changedKeys.length === 0) {
    return (
      <div className="text-xs text-stone-600 font-mono mt-2">
        No field-level changes detected
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1 font-mono text-xs">
      {changedKeys.map((key) => (
        <div key={key} className="space-y-0.5">
          {parsedBefore?.[key] !== undefined && (
            <div className="bg-red-950/30 border border-red-900/50 rounded px-2 py-1 text-red-400">
              <span className="text-red-600 mr-2">−</span>
              <span className="text-stone-500">{key}: </span>
              {String(parsedBefore[key]).slice(0, 100)}
            </div>
          )}
          {parsedAfter?.[key] !== undefined && (
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded px-2 py-1 text-emerald-400">
              <span className="text-emerald-600 mr-2">+</span>
              <span className="text-stone-500">{key}: </span>
              {String(parsedAfter[key]).slice(0, 100)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChangeLogEntry({ log }: { log: ChangeLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = log.beforeJson || log.afterJson;

  const AuthorIcon = log.authorType === "ai" ? Bot
    : log.authorType === "system" ? Cpu
    : User;

  return (
    <div className="border border-stone-800 bg-stone-900 rounded-lg">
      <div
        className={clsx("flex items-start gap-3 p-4", hasDiff && "cursor-pointer hover:bg-stone-800/50 transition-colors")}
        onClick={() => hasDiff && setExpanded((e) => !e)}
      >
        <div className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center shrink-0 mt-0.5">
          <AuthorIcon size={12} className={clsx(
            log.authorType === "ai" && "text-purple-400",
            log.authorType === "system" && "text-stone-400",
            log.authorType === "user" && "text-blue-400",
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-stone-400 bg-stone-800 px-2 py-0.5 rounded">
              {log.entityType}
            </span>
            {log.reason && (
              <span className="text-sm text-stone-300">{log.reason}</span>
            )}
          </div>
          <p className="text-xs text-stone-600">
            {log.entityId.slice(0, 12)}…
            <span className="mx-2">·</span>
            {log.authorType}
            <span className="mx-2">·</span>
            {new Date(log.createdAt).toLocaleString()}
          </p>
        </div>

        {hasDiff && (
          <div className="shrink-0 text-stone-600">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {expanded && hasDiff && (
        <div className="px-4 pb-4 border-t border-stone-800 pt-3">
          <DiffView before={log.beforeJson} after={log.afterJson} />
        </div>
      )}
    </div>
  );
}

function ChangelogContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { activeCampaign, _hasHydrated } = useAppStore();
  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  const { data: logs, isLoading } = useSWR(
    effectiveCampaignId ? `/changelog/${effectiveCampaignId}` : null,
    () => api.changelog.byCampaign(effectiveCampaignId!)
  );

  if (!_hasHydrated && !campaignId) return null;

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            <ScrollText size={22} className="text-amber-400" />
            Changelog
          </h1>
          {effectiveCampaignId && (
            <p className="text-stone-500 text-sm mt-1">{activeCampaign?.title}</p>
          )}
        </div>

        {!effectiveCampaignId && (
          <div className="border border-amber-800 bg-amber-950/30 rounded-lg p-4 text-amber-400 text-sm">
            Select a campaign to view its changelog.
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-stone-900 rounded-lg animate-pulse border border-stone-800" />
            ))}
          </div>
        )}

        {logs?.length === 0 && !isLoading && (
          <div className="text-center py-16 border border-stone-800 rounded-xl">
            <ScrollText size={40} className="text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500">No changes recorded yet</p>
          </div>
        )}

        <div className="space-y-2">
          {logs?.map((log) => (
            <ChangeLogEntry key={log.id} log={log} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default function ChangelogPage() {
  return <Suspense><ChangelogContent /></Suspense>;
}
