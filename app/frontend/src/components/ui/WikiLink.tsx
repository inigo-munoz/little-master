"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { api } from "../../lib/api";
import { DetailModal, type ModalEntity } from "./DetailModal";

const TYPE_STYLES: Record<string, { badge: string; label: string }> = {
  npc: { badge: "bg-stone-800 text-stone-300", label: "NPC" },
  player: { badge: "bg-amber-900 text-amber-400", label: "Jugador" },
  session: { badge: "bg-amber-900 text-amber-500", label: "Sesión" },
  location: { badge: "bg-emerald-900 text-emerald-400", label: "Localización" },
  faction: { badge: "bg-purple-900 text-purple-400", label: "Facción" },
};

interface WikiLinkProps {
  name: string;
  campaignId: string;
}

export function WikiLink({ name, campaignId }: WikiLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const [modalEntity, setModalEntity] = useState<ModalEntity | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const { data } = useSWR(
    hovered ? `wiki-${campaignId}-${name}` : null,
    () => api.wiki.search(campaignId, name)
  );

  const results = Array.isArray(data) ? data : [];
  const primary = results[0];
  const styles = primary ? (TYPE_STYLES[primary.type] ?? TYPE_STYLES.npc) : null;

  function handleMouseEnter() {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
    }
    setHovered(true);
  }

  async function handleClick() {
    if (!primary || loadingModal) return;
    setHovered(false);
    setLoadingModal(true);
    try {
      // Los tipos de api.ts son estructuralmente compatibles con los de ModalEntity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cast = (type: string, d: unknown): ModalEntity => ({ type, data: d } as any);
      let entity: ModalEntity | null = null;
      if (primary.type === "npc")           entity = cast("npc",      await api.npcs.get(primary.id));
      else if (primary.type === "player")   entity = cast("player",   await api.players.get(primary.id));
      else if (primary.type === "session")  entity = cast("session",  await api.sessions.get(primary.id));
      else if (primary.type === "location") entity = cast("location", await api.locations.get(primary.id));
      else if (primary.type === "faction")  entity = cast("faction",  await api.factions.get(primary.id));
      if (entity) setModalEntity(entity);
    } finally {
      setLoadingModal(false);
    }
  }

  const popover = (
    <div
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        transform: "translateX(-50%)",
        zIndex: 99999,
        width: "15rem",
      }}
      className="rounded-lg border border-stone-700 bg-stone-900 p-3 shadow-2xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!data ? (
        <span className="text-xs text-stone-500 italic">Buscando…</span>
      ) : !primary ? (
        <span className="text-xs text-stone-500 italic">
          Sin resultados para &ldquo;{name}&rdquo;
        </span>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-1">
            {styles && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${styles.badge}`}>
                {styles.label}
              </span>
            )}
            <span className="text-sm font-semibold text-stone-100 truncate">
              {primary.name}
            </span>
          </div>
          <p className="text-xs text-stone-400 line-clamp-3 mb-2">{primary.summary}</p>
          <p className="text-xs text-stone-500 italic">Click para abrir ficha</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <span
        ref={anchorRef}
        className="text-amber-400 underline decoration-dotted cursor-pointer hover:text-amber-300"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
      >
        {loadingModal ? "…" : name}
      </span>
      {mounted && hovered && createPortal(popover, document.body)}
      {mounted && modalEntity && createPortal(
        <DetailModal
          entity={modalEntity}
          campaignId={campaignId}
          onClose={() => setModalEntity(null)}
        />,
        document.body
      )}
    </>
  );
}
