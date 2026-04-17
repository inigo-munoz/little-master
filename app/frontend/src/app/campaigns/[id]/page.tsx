"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useParams, useRouter } from "next/navigation";
import {
  Swords,
  BookOpen,
  Users,
  ScrollText,
  AlertTriangle,
  Plus,
  ChevronLeft,
  Calendar,
  FileText,
  Pencil,
  CheckCircle,
  Clock,
  X,
  Download,
} from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../../lib/api";
import type { Campaign, Session, Npc, Document, Issue } from "../../../lib/api";
import { AppShell } from "../../../components/layout/AppShell";
import { DetailModal, type ModalEntity } from "../../../components/ui/DetailModal";
import { WikiMarkdown } from "../../../components/ui/WikiMarkdown";
import { StatusBadge, SeverityBadge, SourceBadge, AuthorityBadge } from "../../../components/ui/Badge";
import { useAppStore } from "../../../store/app.store";
import Link from "next/link";

// ─── Session Form ─────────────────────────────────────────────────────────────
function SessionForm({
  campaignId,
  initial,
  onClose,
  onSaved,
}: {
  campaignId: string;
  initial?: Partial<Session>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sessionNumber, setSessionNumber] = useState(initial?.sessionNumber ?? 1);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [playedAt, setPlayedAt] = useState(
    initial?.playedAt ? new Date(initial.playedAt).toISOString().slice(0, 10) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = {
        title: title.trim(),
        sessionNumber,
        notes: notes || undefined,
        summary: summary || undefined,
        playedAt: playedAt || undefined,
      };
      if (isEdit && initial?.id) {
        await api.sessions.update(initial.id, data);
      } else {
        await api.sessions.create({ campaignId, ...data });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message ?? "Failed to save session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-stone-800 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-amber-400">{isEdit ? "Edit Session" : "New Session"}</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm text-stone-400 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                placeholder="The Dragon's Lair"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-stone-400 mb-1">Session #</label>
              <input
                type="number"
                min={1}
                value={sessionNumber}
                onChange={(e) => setSessionNumber(Number(e.target.value))}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Played At</label>
            <input
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="One-paragraph summary for quick reference..."
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">
              Notes{" "}
              <span className="text-stone-600">(Markdown supported)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={12}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 resize-none font-mono"
              placeholder="# Session Notes&#10;&#10;## What happened&#10;&#10;## NPCs encountered&#10;&#10;## DM notes"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>

        <div className="p-6 border-t border-stone-800 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-stone-700 text-stone-400 rounded-lg hover:border-stone-500 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={loading || !title.trim()}
            className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
          >
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Session"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ session, campaignId, onEdit }: { session: Session; campaignId: string; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-stone-800 bg-stone-900 rounded-lg">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-stone-800/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="w-8 h-8 rounded-full bg-amber-950 border border-amber-800 flex items-center justify-center shrink-0 text-amber-400 font-bold text-xs">
          {session.sessionNumber}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-stone-200 text-sm truncate">{session.title}</p>
          {session.summary && (
            <p className="text-xs text-stone-500 truncate mt-0.5">{session.summary}</p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-600 shrink-0">
          {session.playedAt && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {new Date(session.playedAt).toLocaleDateString()}
            </span>
          )}
          <a
            href={`${process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:3001"}/api/pdf/session/${session.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 hover:text-blue-400 transition-colors"
            title="Descargar PDF de la sesión"
          >
            <Download size={12} />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1 hover:text-amber-400 transition-colors"
          >
            <Pencil size={12} />
          </button>
        </div>
      </div>

      {expanded && session.notes && (
        <div className="border-t border-stone-800 p-4">
          <div className="prose-dnd text-sm">
            <WikiMarkdown campaignId={campaignId}>{session.notes}</WikiMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = "sessions" | "players" | "npcs" | "documents" | "issues";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "sessions", label: "Sessions", icon: ScrollText },
  { id: "players", label: "Jugadores", icon: Users },
  { id: "npcs", label: "NPCs", icon: Users },
  { id: "documents", label: "Documents", icon: BookOpen },
  { id: "issues", label: "Issues", icon: AlertTriangle },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { setActiveCampaign } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>("sessions");
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [selected, setSelected] = useState<ModalEntity | null>(null);
  const [editSession, setEditSession] = useState<Session | null>(null);

  const { data: campaignData, isLoading } = useSWR(
    `/campaigns/${params.id}`,
    () => api.campaigns.get(params.id)
  );
  const campaign = campaignData as unknown as Campaign;

  useEffect(() => {
    if (campaign) setActiveCampaign(campaign);
  }, [campaign, setActiveCampaign]);

  const { data: sessions } = useSWR(
    activeTab === "sessions" ? `/sessions/${params.id}` : null,
    () => api.sessions.list(params.id)
  );

  const { data: players } = useSWR(
    campaign ? `/players/${campaign.id}` : null,
    () => api.players.list(campaign!.id)
  );

  const { data: npcs } = useSWR(
    activeTab === "npcs" ? `/npcs/${params.id}` : null,
    () => api.npcs.list(params.id)
  );

  const { data: documents } = useSWR(
    activeTab === "documents" ? `/docs/${params.id}` : null,
    () => api.documents.list(params.id)
  );

  const { data: issues } = useSWR(
    activeTab === "issues" ? `/issues-list/${params.id}` : null,
    () => api.issues.list(params.id, "open")
  );

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8">
          <div className="h-8 w-64 bg-stone-800 rounded animate-pulse mb-4" />
          <div className="h-4 w-96 bg-stone-800 rounded animate-pulse" />
        </div>
      </AppShell>
    );
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="p-8 text-stone-500">Campaign not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-stone-800">
          <button
            onClick={() => router.push("/campaigns")}
            className="flex items-center gap-1 text-stone-500 hover:text-stone-300 text-sm mb-4 transition-colors"
          >
            <ChevronLeft size={14} />
            All Campaigns
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Swords size={20} className="text-amber-400" />
                <h1 className="text-2xl font-bold text-stone-100">{campaign.title}</h1>
                <StatusBadge status={campaign.status} />
              </div>
              {campaign.description && (
                <p className="text-stone-400 text-sm mt-2 max-w-2xl">{campaign.description}</p>
              )}
              <p className="text-stone-600 text-xs mt-2">{campaign.system}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={`${process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:3001"}/api/pdf/campaign/${campaign.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 border border-stone-700 text-stone-400 hover:text-stone-200 hover:border-stone-500 rounded-lg text-sm transition-colors"
              >
                <Download size={14} />
                Exportar PDF
              </a>
              <Link
                href={`/chat?campaignId=${campaign.id}`}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg text-sm transition-colors"
              >
                Open Assistant
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800 px-8">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors",
                activeTab === id
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-stone-500 hover:text-stone-300"
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-8">
          {/* Sessions */}
          {activeTab === "sessions" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-300">
                  Sessions{sessions ? ` (${sessions.length})` : ""}
                </h2>
                <button
                  onClick={() => setShowSessionForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 rounded-lg text-sm transition-colors"
                >
                  <Plus size={13} />
                  New Session
                </button>
              </div>

              {sessions?.length === 0 && (
                <div className="text-center py-12 border border-stone-800 rounded-xl">
                  <ScrollText size={36} className="text-stone-700 mx-auto mb-3" />
                  <p className="text-stone-500 text-sm">No sessions yet</p>
                </div>
              )}

              <div className="space-y-3">
                {sessions?.map((s) => (
                  <div key={s.id} onClick={() => setSelected({ type: "session", data: s })} className="cursor-pointer">
                  <SessionCard
                    key={s.id}
                    session={s}
                    campaignId={params.id}
                    onEdit={() => setEditSession(s)}
                  /></div>
                ))}
              </div>
            </div>
          )}

          {/* Players */}
          {activeTab === "players" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">
                  Jugadores{players ? ` (${players.length})` : ""}
                </h3>
                <a href="/players" className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                  Ver todos →
                </a>
              </div>
              {!players?.length ? (
                <p className="text-stone-500 text-sm">No hay jugadores. Importa tu vault de Obsidian para añadirlos.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="border border-stone-800 bg-stone-900 rounded-lg p-3 cursor-pointer hover:border-amber-800 transition-colors"
                      onClick={() => setSelected({ type: "player", data: { ...p, playerName: null, notes: null } })}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-amber-900 border border-amber-700 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                          {p.name[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-stone-200 text-sm truncate">{p.name}</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="bg-stone-800 text-amber-400 px-1.5 py-0.5 rounded font-bold">Nv.{p.level}</span>
                        {p.class && <span className="text-stone-500 truncate">{p.class}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NPCs */}
          {activeTab === "npcs" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-300">
                  NPCs{npcs ? ` (${npcs.length})` : ""}
                </h2>
                <Link
                  href={`/npcs?campaignId=${campaign.id}`}
                  className="text-sm text-amber-500 hover:text-amber-400 transition-colors"
                >
                  Manage NPCs →
                </Link>
              </div>

              {npcs?.length === 0 && (
                <div className="text-center py-12 border border-stone-800 rounded-xl">
                  <Users size={36} className="text-stone-700 mx-auto mb-3" />
                  <p className="text-stone-500 text-sm">No NPCs yet</p>
                  <Link
                    href={`/npcs?campaignId=${campaign.id}`}
                    className="text-xs text-amber-600 hover:text-amber-500 mt-2 inline-block"
                  >
                    Add NPCs →
                  </Link>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {npcs?.map((npc) => {
                  let tags: string[] = [];
                  try { tags = JSON.parse(npc.tags); } catch {}
                  return (
                    <div key={npc.id} className="border border-stone-800 bg-stone-900 rounded-lg p-3 cursor-pointer hover:border-stone-700 transition-colors" onClick={() => setSelected({ type: "npc", data: npc })}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-xs text-stone-400 font-bold shrink-0">
                          {npc.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-200 truncate">{npc.name}</p>
                          {npc.role && <p className="text-xs text-stone-500 truncate">{npc.role}</p>}
                        </div>
                        <StatusBadge status={npc.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Documents */}
          {activeTab === "documents" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-300">
                  Documents{documents ? ` (${documents.length})` : ""}
                </h2>
                <Link
                  href={`/documents?campaignId=${campaign.id}`}
                  className="text-sm text-amber-500 hover:text-amber-400 transition-colors"
                >
                  Manage Documents →
                </Link>
              </div>

              {documents?.length === 0 && (
                <div className="text-center py-12 border border-stone-800 rounded-xl">
                  <BookOpen size={36} className="text-stone-700 mx-auto mb-3" />
                  <p className="text-stone-500 text-sm">No documents yet</p>
                </div>
              )}

              <div className="space-y-2">
                {documents?.map((doc) => (
                  <div key={doc.id} className="border border-stone-800 bg-stone-900 rounded-lg p-3 flex items-center gap-3">
                    <FileText size={14} className="text-stone-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-300 truncate">{doc.title}</p>
                    </div>
                    <SourceBadge sourceType={doc.sourceType} />
                    <AuthorityBadge level={doc.authorityLevel} />
                    {doc.isIndexed ? (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle size={11} /> {doc.chunkCount}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-600 flex items-center gap-1">
                        <Clock size={11} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {activeTab === "issues" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-300">
                  Open Issues{issues ? ` (${issues.length})` : ""}
                </h2>
                <Link
                  href={`/issues?campaignId=${campaign.id}`}
                  className="text-sm text-amber-500 hover:text-amber-400 transition-colors"
                >
                  Manage Issues →
                </Link>
              </div>

              {issues?.length === 0 && (
                <div className="text-center py-12 border border-stone-800 rounded-xl">
                  <CheckCircle size={36} className="text-emerald-700 mx-auto mb-3" />
                  <p className="text-stone-500 text-sm">No open issues</p>
                </div>
              )}

              <div className="space-y-3">
                {issues?.map((issue) => (
                  <div key={issue.id} className="border border-stone-800 bg-stone-900 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <SeverityBadge severity={issue.severity} />
                      <p className="text-sm text-stone-300 flex-1">{issue.description}</p>
                    </div>
                    <p className="text-xs text-stone-600 mt-1">
                      {issue.type.replace(/_/g, " ")} · {new Date(issue.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && <DetailModal entity={selected} onClose={() => setSelected(null)} campaignId={params.id} />}
      {(showSessionForm || editSession) && (
        <SessionForm
          campaignId={campaign.id}
          initial={editSession ?? undefined}
          onClose={() => { setShowSessionForm(false); setEditSession(null); }}
          onSaved={() => {
            setShowSessionForm(false);
            setEditSession(null);
            mutate(`/sessions/${params.id}`);
          }}
        />
      )}
    </AppShell>
  );
}
