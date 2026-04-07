"use client";

import { useState, Suspense } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { Users, Shield, Heart, Star, X, Plus } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";
import { DetailModal, type ModalEntity } from "../../components/ui/DetailModal";
import { StatusBadge } from "../../components/ui/Badge";
import { useAppStore } from "../../store/app.store";

interface Player {
  id: string;
  campaignId: string;
  name: string;
  playerName?: string | null;
  class?: string | null;
  race?: string | null;
  level: number;
  hp?: number | null;
  ac?: number | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

function PlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
  return (
    <div className="border border-stone-800 bg-stone-900 rounded-xl p-5 hover:border-stone-700 transition-colors cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-amber-900 border border-amber-700 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
              {player.name[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-stone-100">{player.name}</p>
              {player.playerName && (
                <p className="text-xs text-stone-500">Jugador: {player.playerName}</p>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={player.status} />
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        {player.class && (
          <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
            {player.class}
          </span>
        )}
        {player.race && (
          <span className="text-xs bg-stone-800 text-stone-400 border border-stone-700 px-2 py-0.5 rounded">
            {player.race}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-stone-800 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Star size={11} className="text-amber-400" />
            <span className="text-xs text-stone-500">Nivel</span>
          </div>
          <p className="text-lg font-bold text-amber-400">{player.level}</p>
        </div>
        {player.hp !== null && player.hp !== undefined && (
          <div className="bg-stone-800 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Heart size={11} className="text-red-400" />
              <span className="text-xs text-stone-500">HP</span>
            </div>
            <p className="text-lg font-bold text-red-400">{player.hp}</p>
          </div>
        )}
        {player.ac !== null && player.ac !== undefined && (
          <div className="bg-stone-800 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Shield size={11} className="text-blue-400" />
              <span className="text-xs text-stone-500">CA</span>
            </div>
            <p className="text-lg font-bold text-blue-400">{player.ac}</p>
          </div>
        )}
      </div>

      {player.notes && (
        <p className="text-xs text-stone-500 mt-3 line-clamp-2">{player.notes}</p>
      )}
    </div>
  );
}

function PlayersContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const { activeCampaign } = useAppStore();
  const effectiveCampaignId = campaignId ?? activeCampaign?.id;

  const [selected, setSelected] = useState<ModalEntity | null>(null);
  const swrKey = effectiveCampaignId ? `/players/${effectiveCampaignId}` : null;
  const { data: players, isLoading } = useSWR(swrKey, async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001"}/api/players?campaignId=${effectiveCampaignId}`
    );
    const json = await res.json();
    return json.data as Player[];
  });

  const active = players?.filter(p => p.status === "active") ?? [];
  const inactive = players?.filter(p => p.status !== "active") ?? [];

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Users size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-stone-100">Jugadores</h1>
          {players && (
            <span className="text-stone-600 text-sm ml-1">({players.length})</span>
          )}
        </div>

        {!effectiveCampaignId && (
          <div className="border border-amber-800 bg-amber-950/30 rounded-lg p-4 text-amber-400 text-sm">
            Selecciona una campaña para ver sus jugadores.
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-40 bg-stone-900 rounded-xl animate-pulse border border-stone-800" />
            ))}
          </div>
        )}

        {players?.length === 0 && !isLoading && (
          <div className="text-center py-16 border border-stone-800 rounded-xl">
            <Users size={40} className="text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500">No hay jugadores registrados</p>
            <p className="text-stone-600 text-sm mt-1">
              Importa tu vault de Obsidian desde Settings para añadirlos automáticamente
            </p>
          </div>
        )}

        {active.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">
              Activos ({active.length})
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {active.map(p => <PlayerCard key={p.id} player={p} onClick={() => setSelected({ type: "player", data: p })} />)}
            </div>
          </div>
        )}

        {inactive.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">
              Inactivos / Retirados ({inactive.length})
            </h2>
            <div className="grid grid-cols-2 gap-4 opacity-60">
              {inactive.map(p => <PlayerCard key={p.id} player={p} onClick={() => setSelected({ type: "player", data: p })} />)}
            </div>
          </div>
        )}
      </div>
      {selected && <DetailModal entity={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

export default function PlayersPage() {
  return <Suspense><PlayersContent /></Suspense>;
}
