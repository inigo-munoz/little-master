"use client";

import { useState, useRef, useCallback } from "react";
import useSWR from "swr";
import { api } from "../../lib/api";

interface WikiEntity {
  type: string;
  id: string;
  name: string;
  summary: string;
}

const TYPE_STYLES: Record<string, { badge: string; label: string }> = {
  npc: { badge: "bg-stone-800 text-stone-300 border-stone-700", label: "NPC" },
  player: { badge: "bg-amber-950/60 text-amber-400 border-amber-800/40", label: "Jugador" },
  session: { badge: "bg-amber-950/60 text-amber-500 border-amber-700/40", label: "Sesión" },
  location: { badge: "bg-emerald-950/60 text-emerald-400 border-emerald-800/40", label: "Localización" },
  faction: { badge: "bg-purple-950/60 text-purple-400 border-purple-800/40", label: "Facción" },
};

interface WikiLinkProps {
  name: string;
  campaignId: string;
}

export function WikiLink({ name, campaignId }: WikiLinkProps) {
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data } = useSWR(
    fetchEnabled ? `/wiki/${campaignId}/${name}` : null,
    () => api.wiki.search(campaignId, name)
  );

  const results: WikiEntity[] = (data as unknown as { data: WikiEntity[] } | null)?.data ?? (Array.isArray(data) ? (data as WikiEntity[]) : []);
  const primary = results[0];

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setFetchEnabled(true);
      setPopoverVisible(true);
    }, 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPopoverVisible(false);
  }, []);

  const styles = primary ? (TYPE_STYLES[primary.type] ?? TYPE_STYLES.npc) : null;

  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="text-amber-400 underline decoration-dotted decoration-amber-600 cursor-pointer hover:text-amber-300 transition-colors"
      >
        {name}
      </span>

      {popoverVisible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-60 bg-stone-900 border border-stone-700 rounded-lg shadow-xl p-3 pointer-events-none block">
          {!data ? (
            <span className="text-xs text-stone-500 italic">Buscando…</span>
          ) : !primary ? (
            <span className="text-xs text-stone-500 italic">Sin resultados para &ldquo;{name}&rdquo;</span>
          ) : (
            <span className="block">
              <span className="flex items-center gap-2 mb-1.5 flex-wrap">
                {styles && (
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-medium shrink-0 ${styles.badge}`}>
                    {styles.label}
                  </span>
                )}
                <span className="text-sm font-semibold text-stone-100 truncate">{primary.name}</span>
              </span>
              <span className="text-xs text-stone-400 block" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {primary.summary}
              </span>
              {results.length > 1 && (
                <span className="text-xs text-stone-600 mt-1.5 block">
                  +{results.length - 1} más
                </span>
              )}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
