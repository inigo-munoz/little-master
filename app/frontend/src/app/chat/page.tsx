"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Send,
  Bot,
  User,
  ChevronDown,
  FileText,
  AlertCircle,
  Shield,
  Wand2,
  BookOpen,
  Search,
  Clapperboard,
  UserPlus,
  Check,
  MapPin,
  Users,
  Bookmark,
  Wrench,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { ChatMessage, AssistantMode, ChatResponse, ContextChunk } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { SourceBadge, AuthorityBadge } from "../../components/ui/Badge";
import { useAppStore } from "../../store/app.store";
import { parseNpcFromResponse } from "../../lib/npc-parser";
import { parseSessionSummaryFromResponse } from "../../lib/session-parser";
import { parseLocationFromResponse, parseFactionFromResponse } from "../../lib/entity-parser";

const MODE_CONFIG: Record<
  AssistantMode,
  { label: string; icon: React.ElementType; description: string; color: string }
> = {
  archivista: {
    label: "Archivista",
    icon: FileText,
    description: "Saves, labels and summarizes. Does not invent.",
    color: "text-blue-400",
  },
  rule_reviewer: {
    label: "Rule Reviewer",
    icon: BookOpen,
    description: "Answers rules questions with source attribution.",
    color: "text-emerald-400",
  },
  designer: {
    label: "Designer",
    icon: Wand2,
    description: "Creates narrative content. Tags output as AI-generated.",
    color: "text-purple-400",
  },
  auditor: {
    label: "Auditor",
    icon: Search,
    description: "Detects inconsistencies and logs issues.",
    color: "text-amber-400",
  },
  session_director: {
    label: "Session Director",
    icon: Clapperboard,
    description: "Prepares sessions and encounter hooks.",
    color: "text-rose-400",
  },
};

function ModeSelector({
  value,
  onChange,
}: {
  value: AssistantMode;
  onChange: (m: AssistantMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = MODE_CONFIG[value];
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-sm hover:border-stone-500 transition-colors"
      >
        <Icon size={14} className={current.color} />
        <span className="text-stone-300">{current.label}</span>
        <ChevronDown size={12} className="text-stone-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bottom-full mb-2 w-72 bg-stone-900 border border-stone-700 rounded-xl shadow-xl z-20 overflow-hidden">
            {(Object.keys(MODE_CONFIG) as AssistantMode[]).map((mode) => {
              const cfg = MODE_CONFIG[mode];
              const ModeIcon = cfg.icon;
              return (
                <button
                  key={mode}
                  onClick={() => { onChange(mode); setOpen(false); }}
                  className={clsx(
                    "w-full flex items-start gap-3 px-4 py-3 hover:bg-stone-800 transition-colors text-left",
                    mode === value && "bg-stone-800"
                  )}
                >
                  <ModeIcon size={16} className={clsx(cfg.color, "mt-0.5 shrink-0")} />
                  <div>
                    <p className="text-sm font-medium text-stone-200">{cfg.label}</p>
                    <p className="text-xs text-stone-500">{cfg.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ContextPanel({ chunks }: { chunks: ContextChunk[] }) {
  if (chunks.length === 0) return null;

  return (
    <div className="border-t border-stone-800 p-4">
      <p className="text-xs text-stone-500 uppercase tracking-wider mb-2">
        Context used ({chunks.length} chunks)
      </p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {chunks.map((chunk) => (
          <div
            key={chunk.id}
            className="bg-stone-900 border border-stone-800 rounded-lg p-2"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-stone-400 truncate flex-1">
                {chunk.documentTitle}
              </span>
              <SourceBadge sourceType={chunk.sourceType} />
              <AuthorityBadge level={chunk.authorityLevel} />
            </div>
            <p className="text-xs text-stone-500 line-clamp-2">{chunk.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tools badge colapsable ────────────────────────────────────────────────────
function ToolsBadge({ tools }: { tools: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (tools.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-stone-800 border border-stone-700 rounded-lg text-stone-400 hover:border-stone-500 transition-colors"
      >
        <Wrench size={11} />
        <span>Tools usadas: {tools.join(", ")}</span>
        <ChevronDown size={11} className={clsx("transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {tools.map((t) => (
            <div key={t} className="flex items-center gap-1.5 px-2 py-1 bg-stone-900 border border-stone-800 rounded text-xs text-stone-500">
              <Wrench size={10} className="text-amber-600" />
              <code className="text-amber-500">{t}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel de tools disponibles por modo ─────────────────────────────────────
const MODE_TOOLS: Record<string, string[]> = {
  session_director: ["get_campaign_state", "search_rules", "log_issue"],
  designer: ["get_campaign_state", "create_npc", "search_rules", "search_documents"],
  rule_reviewer: ["search_rules", "search_documents"],
  auditor: ["get_campaign_state", "log_issue", "search_documents"],
  archivista: ["search_documents", "search_rules"],
};

// ─── DesignerSaveButton ───────────────────────────────────────────────────────
// Detecta NPC, localización o facción (en ese orden) y muestra el botón correcto.

function DesignerSaveButton({ content, campaignId }: { content: string; campaignId: string }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedName, setSavedName] = useState("");
  const [editPath, setEditPath] = useState("");

  const npc = parseNpcFromResponse(content);
  const location = !npc ? parseLocationFromResponse(content) : null;
  const faction = !npc && !location ? parseFactionFromResponse(content) : null;

  const detected = npc
    ? { kind: "npc" as const, name: npc.name, data: npc }
    : location
    ? { kind: "location" as const, name: location.name, data: location }
    : faction
    ? { kind: "faction" as const, name: faction.name, data: faction }
    : null;

  if (!detected) return null;

  async function handleSave() {
    if (!detected) return;
    setStatus("saving");
    try {
      if (detected.kind === "npc") {
        await api.npcs.create({
          campaignId,
          name: detected.data.name,
          description: detected.data.description,
          authorType: "assistant",
        });
        setEditPath("/npcs");
      } else if (detected.kind === "location") {
        await api.locations.create({
          campaignId,
          name: detected.data.name,
          description: detected.data.description,
          authorType: "assistant",
        });
        setEditPath("/locations");
      } else {
        await api.factions.create({
          campaignId,
          name: detected.data.name,
          description: detected.data.description,
          authorType: "assistant",
        });
        setEditPath("/factions");
      }
      setSavedName(detected.name);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const labels = {
    npc: { btn: "Guardar NPC", icon: UserPlus, color: "purple" },
    location: { btn: "Guardar Localización", icon: MapPin, color: "blue" },
    faction: { btn: "Guardar Facción", icon: Users, color: "amber" },
  } as const;
  const cfg = labels[detected.kind];
  const Icon = cfg.icon;

  if (status === "saved") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
        <Check size={12} />
        {detected.kind === "npc" ? "NPC" : detected.kind === "location" ? "Localización" : "Facción"} guardado:{" "}
        <span className="font-medium">{savedName}</span>
        <Link href={editPath} className="ml-1 underline hover:text-emerald-300">
          Editar →
        </Link>
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
        <AlertCircle size={12} />
        Error al guardar. Inténtalo de nuevo.
      </p>
    );
  }

  const colorMap: Record<string, string> = {
    purple: "bg-purple-900/40 border-purple-700 text-purple-300 hover:bg-purple-900/70",
    blue: "bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/70",
    amber: "bg-amber-900/40 border-amber-700 text-amber-300 hover:bg-amber-900/70",
  };

  return (
    <button
      onClick={handleSave}
      disabled={status === "saving"}
      className={clsx(
        "mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors disabled:opacity-50",
        colorMap[cfg.color]
      )}
    >
      <Icon size={12} />
      {status === "saving" ? "Guardando..." : cfg.btn}
    </button>
  );
}

// ─── SaveSessionButton ────────────────────────────────────────────────────────

function SaveSessionButton({ content, campaignId }: { content: string; campaignId: string }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedTitle, setSavedTitle] = useState("");

  const parsed = parseSessionSummaryFromResponse(content);
  if (!parsed) return null;

  async function handleSave() {
    if (!parsed) return;
    setStatus("saving");
    try {
      // Calculamos el siguiente número de sesión
      const sessions = await api.sessions.list(campaignId);
      const maxNum = sessions.reduce((m, s) => Math.max(m, s.sessionNumber), 0);

      await api.sessions.create({
        campaignId,
        title: parsed.title,
        summary: parsed.summary,
        sessionNumber: maxNum + 1,
        authorType: "assistant",
      });
      setSavedTitle(parsed.title);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  if (status === "saved") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
        <Check size={12} />
        Sesión guardada: <span className="font-medium">{savedTitle}</span>
        <Link href="/sessions" className="ml-1 underline hover:text-emerald-300">
          Editar →
        </Link>
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
        <AlertCircle size={12} />
        Error al guardar la sesión. Inténtalo de nuevo.
      </p>
    );
  }

  return (
    <button
      onClick={handleSave}
      disabled={status === "saving"}
      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-rose-900/40 border border-rose-700 text-rose-300 rounded-lg hover:bg-rose-900/70 transition-colors disabled:opacity-50"
    >
      <Bookmark size={12} />
      {status === "saving" ? "Guardando..." : "Guardar resumen"}
    </button>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  contextChunks?: ContextChunk[];
  tokensUsed?: number;
  model?: string;
  mode?: AssistantMode;
  campaignId?: string;
  toolsUsed?: string[];
}

function MessageBubble({ message, contextChunks, tokensUsed, model, mode, campaignId, toolsUsed }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={clsx("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={clsx(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1",
          isUser ? "bg-stone-700" : "bg-amber-900"
        )}
      >
        {isUser ? (
          <User size={14} className="text-stone-300" />
        ) : (
          <Shield size={14} className="text-amber-400" />
        )}
      </div>

      <div className={clsx("flex-1 max-w-2xl", isUser && "flex justify-end")}>
        {!isUser && mode && (
          <p className="text-xs text-stone-600 mb-1 flex items-center gap-1">
            <span className={MODE_CONFIG[mode]?.color}>{MODE_CONFIG[mode]?.label}</span>
            {model && <span className="text-stone-700">· {model}</span>}
            {tokensUsed && <span className="text-stone-700">· {tokensUsed} tokens</span>}
          </p>
        )}
        <div
          className={clsx(
            "rounded-xl px-4 py-3",
            isUser
              ? "bg-stone-800 text-stone-200"
              : "bg-stone-900 border border-stone-800"
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-dnd text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && mode === "designer" && campaignId && (
          <DesignerSaveButton content={message.content} campaignId={campaignId} />
        )}

        {!isUser && mode === "session_director" && campaignId && (
          <SaveSessionButton content={message.content} campaignId={campaignId} />
        )}

        {!isUser && toolsUsed && toolsUsed.length > 0 && (
          <ToolsBadge tools={toolsUsed} />
        )}

        {!isUser && contextChunks && contextChunks.length > 0 && (
          <ContextPanel chunks={contextChunks} />
        )}
      </div>
    </div>
  );
}

interface ExtendedMessage extends ChatMessage {
  id: string;
  contextChunks?: ContextChunk[];
  tokensUsed?: number;
  model?: string;
  mode?: AssistantMode;
  toolsUsed?: string[];
}

function ChatInterface() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { chatMode, setChatMode, activeCampaign } = useAppStore();

  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || loading) return;

    const userMsg: ExtendedMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const payload = messages
        .concat(userMsg)
        .map(({ role, content }) => ({ role, content }));

      const result: ChatResponse = await api.chat.send({
        campaignId: effectiveCampaignId,
        mode: chatMode,
        messages: payload,
      });

      const assistantMsg: ExtendedMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.content,
        contextChunks: result.contextChunks,
        tokensUsed: result.tokensUsed,
        model: result.model,
        mode: result.mode,
        toolsUsed: result.toolsUsed,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const code = err.code ?? "";
      if (code === "INSUFFICIENT_CREDITS") {
        setError("💳 Sin crédito en el proveedor de IA. Ve a Settings → recarga tu cuenta.");
      } else if (code === "INVALID_API_KEY") {
        setError("🔑 API key inválida. Ve a Settings → verifica tu clave.");
      } else if (code === "RATE_LIMITED") {
        setError("⏱ Límite de peticiones alcanzado. Espera unos segundos e inténtalo de nuevo.");
      } else {
        setError(err.message ?? "Error inesperado. Revisa el terminal del backend.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="border-b border-stone-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-semibold text-stone-100">Campaign Assistant</h1>
            {effectiveCampaignId && (
              <p className="text-xs text-stone-500 mt-0.5">
                Context: {activeCampaign?.title ?? effectiveCampaignId}
              </p>
            )}
            {!effectiveCampaignId && (
              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                <AlertCircle size={12} />
                No campaign selected — responses won't use campaign context
              </p>
            )}
            {/* Tools disponibles para el modo activo */}
            {(MODE_TOOLS[chatMode] ?? []).length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Wrench size={10} className="text-stone-600" />
                {(MODE_TOOLS[chatMode] ?? []).map((tool) => (
                  <span key={tool} className="text-xs text-stone-600 bg-stone-800 px-1.5 py-0.5 rounded font-mono">
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
            >
              Clear history
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <Bot size={48} className="text-stone-700 mx-auto mb-4" />
              <p className="text-stone-500">Select a mode and start the conversation</p>
              <p className="text-stone-600 text-sm mt-1">
                The assistant uses your campaign documents as context
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              contextChunks={msg.contextChunks}
              tokensUsed={msg.tokensUsed}
              model={msg.model}
              mode={msg.mode}
              campaignId={effectiveCampaignId}
              toolsUsed={msg.toolsUsed}
            />
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-900 flex items-center justify-center shrink-0">
                <Shield size={14} className="text-amber-400" />
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-amber-600 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800 rounded-lg px-4 py-3">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-stone-800 p-4 shrink-0">
          <div className="flex items-end gap-3">
            <ModeSelector value={chatMode} onChange={setChatMode} />
            <div className="flex-1 bg-stone-900 border border-stone-700 rounded-xl focus-within:border-amber-600 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about rules, NPCs, session prep... (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="w-full bg-transparent px-4 py-3 text-stone-100 placeholder-stone-600 focus:outline-none resize-none text-sm"
                style={{ maxHeight: "200px", overflowY: "auto" }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="p-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors shrink-0"
              aria-label="Send"
            >
              <Send size={16} className="text-stone-950" />
            </button>
          </div>
          <p className="text-xs text-stone-700 mt-2 text-center">
            All AI actions are logged. Context retrieved from indexed campaign documents.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatInterface />
    </Suspense>
  );
}
