"use client";

import { useEffect } from "react";
import { X, Shield, Heart, Star, Users, MapPin, Swords, ScrollText } from "lucide-react";
import { clsx } from "clsx";
import { StatusBadge, SourceBadge } from "./Badge";
import { WikiMarkdown } from "./WikiMarkdown";
import { RelationsPanel } from "./RelationsPanel";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ModalEntity =
  | { type: "npc"; data: NpcData }
  | { type: "player"; data: PlayerData }
  | { type: "session"; data: SessionData }
  | { type: "location"; data: LocationData }
  | { type: "faction"; data: FactionData };

interface StatBlockEntry { name: string; description: string; }

interface NpcData {
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
  status: string;
  tags: string;
  createdAt: string;
  // Stat block
  armorClass?: number | null;
  hitPoints?: string | null;
  speed?: string | null;
  strength?: number | null;
  dexterity?: number | null;
  constitution?: number | null;
  intelligence?: number | null;
  wisdom?: number | null;
  charisma?: number | null;
  savingThrows?: string | null;
  skills?: string | null;
  resistances?: string | null;
  immunities?: string | null;
  senses?: string | null;
  languages?: string | null;
  challengeRating?: string | null;
  traits?: StatBlockEntry[] | string | null;
  actions?: StatBlockEntry[] | string | null;
  bonusActions?: StatBlockEntry[] | string | null;
  reactions?: StatBlockEntry[] | string | null;
  npcType?: string | null;
  npcClass?: string | null;
  npcLevel?: number | null;
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
  campaignId,
}: {
  entity: ModalEntity;
  onClose: () => void;
  campaignId?: string;
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
          {entity.type === "player" && <PlayerDetail data={entity.data} campaignId={campaignId} />}
          {entity.type === "npc" && <NpcDetail data={entity.data} campaignId={campaignId} />}
          {entity.type === "session" && <SessionDetail data={entity.data} campaignId={campaignId} />}
          {entity.type === "location" && <LocationDetail data={entity.data} campaignId={campaignId} />}
          {entity.type === "faction" && <FactionDetail data={entity.data} campaignId={campaignId} />}
        </div>
      </div>
    </div>
  );
}

// ─── Entity-specific content ──────────────────────────────────────────────────
function PlayerDetail({ data, campaignId }: { data: PlayerData; campaignId?: string }) {
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
            <WikiMarkdown campaignId={campaignId}>{data.notes}</WikiMarkdown>
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

    result.push(line);
  }

  return result.join("\n").trim();
}


function parseEntries(raw: StatBlockEntry[] | string | null | undefined): StatBlockEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as StatBlockEntry[]; } catch { return []; }
}

function modStr(score: number | null | undefined): string {
  if (score == null) return "—";
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function AbilityBox({ label, score }: { label: string; score: number | null | undefined }) {
  return (
    <div className="text-center bg-stone-950 rounded p-2">
      <p className="text-xs text-amber-500 font-bold uppercase mb-0.5">{label}</p>
      <p className="text-sm font-bold text-stone-100">{score ?? "—"}</p>
      <p className="text-xs text-stone-400">{modStr(score)}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-amber-600 font-semibold shrink-0">{label}</span>
      <span className="text-stone-300">{value}</span>
    </div>
  );
}

function EntryList({ title, entries }: { title: string; entries: StatBlockEntry[] }) {
  if (!entries.length) return null;
  return (
    <div className="border-t border-red-900/40 pt-2">
      <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1.5">{title}</p>
      <div className="space-y-1.5">
        {entries.map((e, i) => (
          <p key={i} className="text-xs">
            <span className="font-semibold text-stone-200">{e.name}. </span>
            <span className="text-stone-400">{e.description}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function NpcStatBlockDisplay({ data }: { data: NpcData }) {
  const hasStats = data.armorClass != null || data.hitPoints || data.strength != null;
  if (!hasStats) return null;

  const traits = parseEntries(data.traits);
  const actions = parseEntries(data.actions);
  const bonusActions = parseEntries(data.bonusActions);
  const reactions = parseEntries(data.reactions);

  const subtitle = data.npcType === "player" && data.npcClass
    ? `${data.npcClass}${data.npcLevel ? ` nivel ${data.npcLevel}` : ""}`
    : data.npcType === "monster" ? "Monstruo" : null;

  return (
    <div className="border border-red-900/50 bg-stone-950 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-red-800/60 bg-gradient-to-r from-red-950/60 to-stone-950">
        <p className="font-bold text-stone-100">{data.name}</p>
        {subtitle && <p className="text-xs text-stone-400 italic">{subtitle}</p>}
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* CA / PG / Velocidad */}
        <div className="space-y-1">
          <StatRow label="Clase de Armadura" value={data.armorClass != null ? String(data.armorClass) : null} />
          <StatRow label="Puntos de Golpe" value={data.hitPoints} />
          <StatRow label="Velocidad" value={data.speed} />
          {data.challengeRating && <StatRow label="CR" value={data.challengeRating} />}
        </div>

        {/* Ability scores */}
        {(data.strength != null || data.dexterity != null) && (
          <div className="grid grid-cols-6 gap-1 border-t border-red-900/30 pt-2">
            <AbilityBox label="FUE" score={data.strength} />
            <AbilityBox label="DES" score={data.dexterity} />
            <AbilityBox label="CON" score={data.constitution} />
            <AbilityBox label="INT" score={data.intelligence} />
            <AbilityBox label="SAB" score={data.wisdom} />
            <AbilityBox label="CAR" score={data.charisma} />
          </div>
        )}

        {/* Secondary stats */}
        <div className="space-y-1 border-t border-red-900/30 pt-2">
          <StatRow label="Salvaciones" value={data.savingThrows} />
          <StatRow label="Habilidades" value={data.skills} />
          <StatRow label="Resistencias" value={data.resistances} />
          <StatRow label="Inmunidades" value={data.immunities} />
          <StatRow label="Sentidos" value={data.senses} />
          <StatRow label="Idiomas" value={data.languages} />
        </div>

        {/* Traits & Actions */}
        <EntryList title="Rasgos" entries={traits} />
        <EntryList title="Acciones" entries={actions} />
        <EntryList title="Acciones Adicionales" entries={bonusActions} />
        <EntryList title="Reacciones" entries={reactions} />
      </div>
    </div>
  );
}

function NpcDetail({ data, campaignId }: { data: NpcData; campaignId?: string }) {
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
        <div className="prose-dnd text-sm bg-stone-950 rounded-lg p-4">
          <WikiMarkdown campaignId={campaignId}>{cleanDesc}</WikiMarkdown>
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

      {/* Stat block */}
      <NpcStatBlockDisplay data={data} />

      {campaignId && (
        <RelationsPanel
          campaignId={campaignId}
          entityType="npc"
          entityId={data.id}
        />
      )}
    </div>
  );
}

function SessionDetail({ data, campaignId }: { data: SessionData; campaignId?: string }) {
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
            <WikiMarkdown campaignId={campaignId}>{data.notes}</WikiMarkdown>
          </div>
        </div>
      ) : (
        <p className="text-stone-600 text-sm italic">Sin notas de sesión.</p>
      )}
    </div>
  );
}

function LocationDetail({ data, campaignId }: { data: LocationData; campaignId?: string }) {
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
          <WikiMarkdown campaignId={campaignId}>{data.description}</WikiMarkdown>
        </div>
      ) : (
        <p className="text-stone-600 text-sm italic">Sin descripción.</p>
      )}

      {campaignId && (
        <RelationsPanel
          campaignId={campaignId}
          entityType="location"
          entityId={data.id}
        />
      )}
    </div>
  );
}

function FactionDetail({ data, campaignId }: { data: FactionData; campaignId?: string }) {
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
          <WikiMarkdown campaignId={campaignId}>{data.description}</WikiMarkdown>
        </div>
      ) : (
        <p className="text-stone-600 text-sm italic">Sin descripción.</p>
      )}

      {campaignId && (
        <RelationsPanel
          campaignId={campaignId}
          entityType="faction"
          entityId={data.id}
        />
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
