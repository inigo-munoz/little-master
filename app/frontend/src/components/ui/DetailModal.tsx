"use client";

import { useEffect } from "react";
import { X, Shield, Heart, Star, Users, MapPin, Swords, ScrollText } from "lucide-react";
import { clsx } from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { StatusBadge, SourceBadge } from "./Badge";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ModalEntity =
  | { type: "npc"; data: NpcData }
  | { type: "player"; data: PlayerData }
  | { type: "session"; data: SessionData }
  | { type: "location"; data: LocationData }
  | { type: "faction"; data: FactionData };

interface NpcData {
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
  status: string;
  tags: string;
  createdAt: string;
}

interface PlayerData {
  id: string;
  name: string;
  playerName?: string | null;
  class?: string | null;
  race?: string | null;
  level: number;
  hp?: number | null;
  ac?: number | null;
  status: string;
  notes?: string | null;
}

interface SessionData {
  id: string;
  title: string;
  sessionNumber: number;
  summary?: string | null;
  notes?: string | null;
  playedAt?: string | null;
}

interface LocationData {
  id: string;
  name: string;
  description?: string | null;
  tags: string;
}

interface FactionData {
  id: string;
  name: string;
  description?: string | null;
  alignment?: string | null;
  disposition: string;
  tags: string;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function DetailModal({
  entity,
  onClose,
}: {
  entity: ModalEntity;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <EntityIcon entity={entity} />
            <div>
              <h2 className="font-semibold text-stone-100 text-lg">{getTitle(entity)}</h2>
              <p className="text-xs text-stone-500">{getSubtitle(entity)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {entity.type === "player" && <PlayerDetail data={entity.data} />}
          {entity.type === "npc" && <NpcDetail data={entity.data} />}
          {entity.type === "session" && <SessionDetail data={entity.data} />}
          {entity.type === "location" && <LocationDetail data={entity.data} />}
          {entity.type === "faction" && <FactionDetail data={entity.data} />}
        </div>
      </div>
    </div>
  );
}

// ─── Entity-specific content ──────────────────────────────────────────────────
function PlayerDetail({ data }: { data: PlayerData }) {
  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox icon={<Star size={14} className="text-amber-400" />} label="Nivel" value={data.level} color="text-amber-400" />
        {data.hp != null && <StatBox icon={<Heart size={14} className="text-red-400" />} label="HP máx" value={data.hp} color="text-red-400" />}
        {data.ac != null && <StatBox icon={<Shield size={14} className="text-blue-400" />} label="CA" value={data.ac} color="text-blue-400" />}
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-4">
        {data.class && <InfoField label="Clase" value={data.class} />}
        {data.race && <InfoField label="Raza" value={data.race} />}
        {data.playerName && <InfoField label="Jugador" value={data.playerName} />}
        <InfoField label="Estado" value={<StatusBadge status={data.status} />} />
      </div>

      <a href={`/players/${data.id}`} className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 text-amber-400 text-sm font-medium rounded-lg transition-colors">
        Abrir ficha completa D&amp;D 2024 →
      </a>

      <div className="hidden">
      </div>

      {/* Notes */}
      {data.notes && (
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wider mb-2">Notas</p>
          <div className="prose-dnd text-sm bg-stone-950 rounded-lg p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.notes}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function extractRelationships(description: string | null): { allies: string[]; enemies: string[] } {
  if (!description) return { allies: [], enemies: [] };
  const allies: string[] = [];
  const enemies: string[] = [];
  const lines = description.split("\n");
  for (const line of lines) {
    if (line.startsWith("Allies:")) {
      allies.push(...line.slice(7).split(",").map(s => s.trim()).filter(Boolean));
    }
    if (line.startsWith("Enemies:")) {
      enemies.push(...line.slice(8).split(",").map(s => s.trim()).filter(Boolean));
    }
  }
  // Deduplicate
  return {
    allies: [...new Set(allies)].slice(0, 6),
    enemies: [...new Set(enemies)].slice(0, 6),
  };
}

function cleanNpcDescription(description: string | null): string {
  if (!description) return "";

  const skipPrefixes = [">", "```", "INPUT[", "BUTTON["];
  const skipContains = [":::internal-link", "mermaid", "flowchart", "dv.paragraph", "Template_", "tabbed-box", "no-h clean"];
  const emptyFields = ["Estado:", "Raza:", "Genero:", "G\u00e9nero:", "Edad:", "Afiliacion:", "Afiliaci\u00f3n:"];

  const lines = description.split("\n");
  const result: string[] = [];
  let lastWasEmpty = false;

  for (const line of lines) {
    const t = line.trim();

    if (!t) {
      if (!lastWasEmpty && result.length > 0) result.push("");
      lastWasEmpty = true;
      continue;
    }
    lastWasEmpty = false;

    // Skip empty template fields (e.g. "Estado: " with nothing after)
    const isEmptyField = emptyFields.some(f => t.startsWith(f) && t.slice(f.length).trim() === "");
    if (isEmptyField) continue;

    // Skip technical content
    let skip = false;
    for (const p of skipPrefixes) if (t.startsWith(p)) { skip = true; break; }
    if (!skip) for (const s of skipContains) if (t.includes(s)) { skip = true; break; }
    if (skip) continue;

    // Remove **bold** keeping text
    let cleaned = line;
    while (cleaned.includes("**")) {
      const a = cleaned.indexOf("**");
      const b = cleaned.indexOf("**", a + 2);
      if (b === -1) break;
      cleaned = cleaned.slice(0, a) + cleaned.slice(a + 2, b) + cleaned.slice(b + 2);
    }

    // Convert headings to section dividers
    if (cleaned.trim().startsWith("#")) {
      const text = cleaned.trim().replace(/^#+\s*/, "");
      if (text && !["General", "Statblock", "Connections", "Relationships"].includes(text)) {
        result.push("\u2014 " + text + " \u2014");
      }
      continue;
    }

    result.push(cleaned);
  }

  return result.join("\n").trim();
}


function NpcDetail({ data }: { data: NpcData }) {
  let tags: string[] = [];
  try { tags = JSON.parse(data.tags); } catch {}

  const { allies, enemies } = extractRelationships(data.description ?? null);
  const cleanDesc = cleanNpcDescription(data.description ?? null);

  return (
    <div className="space-y-4">
      {/* Status + tags */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={data.status} />
        {data.role && <span className="text-xs bg-stone-800 text-stone-400 border border-stone-700 px-2 py-0.5 rounded">{data.role}</span>}
        {tags.map(t => <span key={t} className="text-xs bg-stone-800 text-stone-500 px-2 py-0.5 rounded">{t}</span>)}
      </div>

      {/* Description */}
      {cleanDesc ? (
        <div className="text-sm text-stone-300 leading-relaxed bg-stone-950 rounded-lg p-4 whitespace-pre-wrap">
          {cleanDesc}
        </div>
      ) : (
        <p className="text-stone-600 text-sm italic">Sin descripción.</p>
      )}

      {/* Relationships */}
      {(allies.length > 0 || enemies.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {allies.length > 0 && (
            <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-3">
              <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider mb-2">Aliados</p>
              <div className="flex flex-col gap-1">
                {allies.map(a => (
                  <span key={a} className="text-xs text-emerald-400/80 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-600 shrink-0" />
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
          {enemies.length > 0 && (
            <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3">
              <p className="text-xs text-red-600 font-medium uppercase tracking-wider mb-2">Enemigos</p>
              <div className="flex flex-col gap-1">
                {enemies.map(e => (
                  <span key={e} className="text-xs text-red-400/80 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-700 shrink-0" />
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionDetail({ data }: { data: SessionData }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <span className="bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded font-mono text-xs">
          Sesión {data.sessionNumber}
        </span>
        {data.playedAt && (
          <span className="text-stone-500 text-xs">
            {new Date(data.playedAt).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}
          </span>
        )}
      </div>

      {data.summary && (
        <div className="bg-stone-800 border border-stone-700 rounded-lg p-3">
          <p className="text-xs text-stone-500 mb-1">Resumen</p>
          <p className="text-sm text-stone-300">{data.summary}</p>
        </div>
      )}

      {data.notes ? (
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wider mb-2">Notas completas</p>
          <div className="prose-dnd text-sm bg-stone-950 rounded-lg p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.notes}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <p className="text-stone-600 text-sm italic">Sin notas de sesión.</p>
      )}
    </div>
  );
}

function LocationDetail({ data }: { data: LocationData }) {
  let tags: string[] = [];
  try { tags = JSON.parse(data.tags); } catch {}

  return (
    <div className="space-y-4">
      {tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {tags.map(t => <span key={t} className="text-xs bg-stone-800 text-stone-400 border border-stone-700 px-2 py-0.5 rounded">{t}</span>)}
        </div>
      )}

      {data.description ? (
        <div className="prose-dnd text-sm bg-stone-950 rounded-lg p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.description}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-stone-600 text-sm italic">Sin descripción.</p>
      )}
    </div>
  );
}

function FactionDetail({ data }: { data: FactionData }) {
  let tags: string[] = [];
  try { tags = JSON.parse(data.tags); } catch {}

  const dispositionColors: Record<string, string> = {
    allied: "text-emerald-400",
    neutral: "text-stone-400",
    hostile: "text-red-400",
    unknown: "text-stone-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={clsx("text-xs font-medium capitalize", dispositionColors[data.disposition] ?? "text-stone-500")}>
          ● {data.disposition}
        </span>
        {data.alignment && <span className="text-xs text-stone-500">{data.alignment}</span>}
        {tags.map(t => <span key={t} className="text-xs bg-stone-800 text-stone-400 border border-stone-700 px-2 py-0.5 rounded">{t}</span>)}
      </div>

      {data.description ? (
        <div className="prose-dnd text-sm bg-stone-950 rounded-lg p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.description}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-stone-600 text-sm italic">Sin descripción.</p>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-stone-800 rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">{icon}<span className="text-xs text-stone-500">{label}</span></div>
      <p className={clsx("text-2xl font-bold", color)}>{value}</p>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-stone-500 mb-0.5">{label}</p>
      <div className="text-sm text-stone-300">{value}</div>
    </div>
  );
}

function EntityIcon({ entity }: { entity: ModalEntity }) {
  const icons = {
    player: <Users size={18} className="text-amber-400" />,
    npc: <Users size={18} className="text-stone-400" />,
    session: <ScrollText size={18} className="text-amber-400" />,
    location: <MapPin size={18} className="text-emerald-400" />,
    faction: <Swords size={18} className="text-purple-400" />,
  };
  return <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center">{icons[entity.type]}</div>;
}

function getTitle(entity: ModalEntity): string {
  if (entity.type === "session") return entity.data.title;
  return entity.data.name;
}

function getSubtitle(entity: ModalEntity): string {
  const labels = { player: "Jugador", npc: "NPC", session: "Sesión", location: "Localización", faction: "Facción" };
  return labels[entity.type];
}
