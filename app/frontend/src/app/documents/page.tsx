"use client";

import { useState, useRef, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Upload,
  RefreshCw,
  Trash2,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { Document } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { SourceBadge, AuthorityBadge } from "../../components/ui/Badge";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { useAppStore } from "../../store/app.store";

interface UploadModalProps {
  campaignId?: string;
  onClose: () => void;
  onUploaded: () => void;
}

function UploadModal({ campaignId, onClose, onUploaded }: UploadModalProps) {
  const [tab, setTab] = useState<"text" | "file">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<"markdown" | "plaintext">("markdown");
  const [sourceType, setSourceType] = useState("campaign");
  const [authorityLevel, setAuthorityLevel] = useState("medium");
  const [version, setVersion] = useState("1.0");
  const [scope, setScope] = useState<"campaign" | "global">(campaignId ? "campaign" : "global");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const autoAuth: Record<string, string> = {
    official: "high", srd: "high", campaign: "medium",
    homebrew_external: "medium", homebrew_user: "low", ai_inferred: "low",
  };

  function handleSourceChange(v: string) {
    setSourceType(v);
    setAuthorityLevel(autoAuth[v] ?? "medium");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (tab === "text") {
        if (!title.trim() || !content.trim()) return;
        await api.documents.create({
          title: title.trim(),
          content: content.trim(),
          contentType,
          sourceType,
          authorityLevel,
          campaignId: scope === "campaign" ? campaignId : undefined,
          version,
        });
      } else {
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (title.trim()) formData.append("title", title.trim());
        formData.append("sourceType", sourceType);
        formData.append("authorityLevel", authorityLevel);
        formData.append("version", version);
        if (scope === "campaign" && campaignId) formData.append("campaignId", campaignId);
        await api.documents.upload(formData);
      }
      onUploaded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir el documento");
    } finally {
      setLoading(false);
    }
  }

  const charCount = content.length;
  const approxTokens = Math.ceil(charCount / 4);
  const canSubmit = tab === "text"
    ? Boolean(title.trim() && content.trim())
    : Boolean(selectedFile);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-400">Añadir Documento</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-stone-800 pb-0">
            {(["text", "file"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  "px-4 py-2 text-sm transition-colors",
                  tab === t
                    ? "text-amber-400 border-b-2 border-amber-400 -mb-px"
                    : "text-stone-500 hover:text-stone-300"
                )}
              >
                {t === "text" ? "Pegar texto" : "Subir archivo"}
              </button>
            ))}
          </div>

          {/* Scope (Campaign / Global) */}
          {campaignId && (
            <div className="flex gap-2">
              {(["campaign", "global"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-sm border transition-colors capitalize",
                    scope === s
                      ? "border-amber-600 bg-amber-900/20 text-amber-400"
                      : "border-stone-700 text-stone-500 hover:border-stone-500"
                  )}
                >
                  {s === "campaign" ? "Campaña activa" : "Global"}
                </button>
              ))}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm text-stone-400 mb-1">
              Título {tab === "text" ? "*" : "(opcional — usa el nombre del archivo)"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              required={tab === "text"}
            />
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-stone-400 mb-1">Tipo de fuente</label>
              <select
                value={sourceType}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="official">Oficial</option>
                <option value="srd">SRD</option>
                <option value="campaign">Campaña</option>
                <option value="homebrew_external">Homebrew (externo)</option>
                <option value="homebrew_user">Homebrew (propio)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-stone-400 mb-1">Autoridad</label>
              <select
                value={authorityLevel}
                onChange={(e) => setAuthorityLevel(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-stone-400 mb-1">Versión</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Tab content */}
          {tab === "text" ? (
            <div>
              <label className="block text-sm text-stone-400 mb-1">
                Contenido *
                {charCount > 0 && (
                  <span className="ml-2 text-stone-600">
                    {charCount.toLocaleString()} chars · ~{approxTokens.toLocaleString()} tokens
                  </span>
                )}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 font-mono resize-none"
                placeholder="Pega aquí el contenido en Markdown o texto plano..."
                required
              />
            </div>
          ) : (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                className={clsx(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  selectedFile
                    ? "border-amber-700 bg-amber-900/10"
                    : "border-stone-700 hover:border-amber-700"
                )}
              >
                <Upload size={24} className="text-stone-600 mx-auto mb-2" />
                {selectedFile ? (
                  <p className="text-amber-400 text-sm font-medium">{selectedFile.name}</p>
                ) : (
                  <p className="text-stone-500 text-sm">
                    Arrastra un archivo o{" "}
                    <span className="text-amber-500">selecciónalo</span>
                  </p>
                )}
                <p className="text-stone-600 text-xs mt-1">PDF, .md, .txt · máx 10 MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".md,.txt,.markdown,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm flex items-center gap-1">
              <AlertCircle size={14} />
              {error}
            </p>
          )}
        </div>

        <div className="p-6 border-t border-stone-800 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-stone-700 text-stone-400 rounded-lg hover:border-stone-500 transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit as React.MouseEventHandler}
            disabled={loading || !canSubmit}
            className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
          >
            {loading ? "Guardando e indexando..." : "Guardar documento"}
          </button>
        </div>
      </div>
    </div>
  );
}


function DocumentViewModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const { data, isLoading } = useSWR(
    `/doc-content/${doc.id}`,
    () => api.documents.content(doc.id)
  );

  // Close on Escape
  useState(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} className="text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold text-stone-100 truncate">{doc.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <SourceBadge sourceType={doc.sourceType} />
                <AuthorityBadge level={doc.authorityLevel} />
                <span className="text-xs text-stone-600">v{doc.version}</span>
                {doc.chunkCount > 0 && (
                  <span className="text-xs text-stone-600">{doc.chunkCount} chunks</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors p-1 shrink-0 ml-4">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-stone-600 text-sm">
              Cargando contenido...
            </div>
          )}
          {!isLoading && !data?.content && (
            <p className="text-stone-600 text-sm italic text-center py-12">
              No hay contenido disponible para este documento.
            </p>
          )}
          {data?.content && (
            <div className="prose-dnd text-sm">
              {doc.contentType === "markdown" || doc.sourceType === "srd" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content}</ReactMarkdown>
              ) : (
                <pre className="whitespace-pre-wrap text-stone-300 font-mono text-xs leading-relaxed">
                  {data.content}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentCard({ doc, onAction, onView }: { doc: Document; onAction: () => void; onView: () => void }) {
  const [reindexing, setReindexing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleReindex() {
    setReindexing(true);
    try {
      await api.documents.reindex(doc.id);
      onAction();
    } finally {
      setReindexing(false);
    }
  }

  async function doDelete() {
    setShowConfirm(false);
    setDeleting(true);
    try {
      await api.documents.delete(doc.id);
      onAction();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="border border-stone-800 bg-stone-900 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <FileText size={16} className="text-stone-500 shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-medium text-stone-200 text-sm truncate cursor-pointer hover:text-amber-400 transition-colors" onClick={onView}>{doc.title}</h3>
            <span className="text-stone-600 text-xs">v{doc.version}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SourceBadge sourceType={doc.sourceType} />
            <AuthorityBadge level={doc.authorityLevel} />
            <span className="text-xs text-stone-600">{doc.contentType}</span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-stone-600">
            {doc.isIndexed ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle size={11} />
                {doc.chunkCount} chunks indexed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <Clock size={11} />
                Not indexed yet
              </span>
            )}
            <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="p-1.5 text-stone-600 hover:text-amber-400 transition-colors"
            title="Re-index and re-embed"
          >
            <RefreshCw size={14} className={clsx(reindexing && "animate-spin")} />
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={deleting}
            className="p-1.5 text-stone-600 hover:text-red-400 transition-colors"
            title="Delete document"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <ConfirmModal
        isOpen={showConfirm}
        title="Eliminar documento"
        message={`¿Eliminar documento "${doc.title}"?`}
        onConfirm={doDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

function DocumentsContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { activeCampaign } = useAppStore();
  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  const [showUpload, setShowUpload] = useState(false);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [filter, setFilter] = useState<"all" | "campaign" | "global">("all");

  const swrKey = `/documents/${effectiveCampaignId ?? "global"}`;
  const { data: docs, isLoading } = useSWR(swrKey, () =>
    api.documents.list(effectiveCampaignId)
  );

  const filtered = docs?.filter((d) => {
    if (filter === "campaign") return !!d.campaignId;
    if (filter === "global") return !d.campaignId;
    return true;
  });

  const refresh = () => mutate(swrKey);

  const totalChunks = docs?.reduce((sum, d) => sum + d.chunkCount, 0) ?? 0;
  const indexedDocs = docs?.filter((d) => d.isIndexed).length ?? 0;

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
              <BookOpen size={22} className="text-amber-400" />
              Documents
            </h1>
            {effectiveCampaignId && (
              <p className="text-stone-500 text-sm mt-1">{activeCampaign?.title}</p>
            )}
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
          >
            <Upload size={14} />
            Add Document
          </button>
        </div>

        {/* Stats */}
        {docs && docs.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Total documents", value: docs.length },
              { label: "Indexed", value: `${indexedDocs} / ${docs.length}` },
              { label: "Total chunks", value: totalChunks.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-stone-900 border border-stone-800 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-amber-400">{value}</p>
                <p className="text-xs text-stone-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {(["all", "campaign", "global"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-1 rounded-lg text-sm transition-colors capitalize",
                filter === f
                  ? "bg-amber-900/40 text-amber-400 border border-amber-700"
                  : "text-stone-500 hover:text-stone-300"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-stone-900 rounded-lg animate-pulse border border-stone-800" />
            ))}
          </div>
        )}

        {filtered?.length === 0 && !isLoading && (
          <div className="text-center py-16 border border-stone-800 rounded-xl">
            <BookOpen size={40} className="text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500">No documents yet</p>
            <p className="text-stone-600 text-sm mt-1">
              Upload rule books, session notes, or homebrew content
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filtered?.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onAction={refresh} onView={() => setViewDoc(doc)} />
          ))}
        </div>
      </div>

      {viewDoc && <DocumentViewModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
      {showUpload && (
        <UploadModal
          campaignId={effectiveCampaignId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); refresh(); }}
        />
      )}
    </AppShell>
  );
}

export default function DocumentsPage() {
  return <Suspense><DocumentsContent /></Suspense>;
}
