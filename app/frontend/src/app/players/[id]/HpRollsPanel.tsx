"use client";
import React from "react";
import {
  HpRollEntry,
  PlayerClassEntry,
  calcHpMaxFromRolls,
  abilityModifier,
} from "../../../lib/player-calcs";
import { HIT_DIE_BY_CLASS } from "../../../lib/dnd-2024-data";

interface HpRollsPanelProps {
  hpRolls: HpRollEntry[];
  classes: PlayerClassEntry[];
  conScore: number;
  useAverage: boolean;
  onRollsChange: (rolls: HpRollEntry[]) => void;
  onMethodChange: (useAverage: boolean) => void;
}

export function HpRollsPanel({
  hpRolls,
  classes,
  conScore,
  useAverage,
  onRollsChange,
  onMethodChange,
}: HpRollsPanelProps) {
  // Lista ordenada de hit dice por nivel
  const hitDicePerLevel: number[] = [];
  for (const cls of classes) {
    const hitDie = HIT_DIE_BY_CLASS[cls.class] ?? 8;
    for (let i = 0; i < cls.level; i++) hitDicePerLevel.push(hitDie);
  }

  const conMod = abilityModifier(conScore);
  const hpMax = calcHpMaxFromRolls(hpRolls, classes, conScore, useAverage);

  function getRoll(level: number): HpRollEntry | undefined {
    return hpRolls.find(r => r.level === level);
  }

  function updateRoll(level: number, rawValue: string) {
    const value = parseInt(rawValue) || 1;
    const existing = hpRolls.find(r => r.level === level);
    if (existing) {
      onRollsChange(hpRolls.map(r => r.level === level ? { ...r, value, rolled: true } : r));
    } else {
      onRollsChange([...hpRolls, { level, value, rolled: true }]);
    }
  }

  if (hitDicePerLevel.length === 0) {
    return (
      <p className="text-xs text-stone-500 italic">
        Añade al menos una clase para ver el registro de HP.
      </p>
    );
  }

  // Calcular filas con totales acumulados para mostrar
  let running = 0;
  type Row = { level: number; hitDie: number; method: string; dieDisplay: string; total: number };
  const rows: Row[] = [];

  for (let lvl = 1; lvl <= hitDicePerLevel.length; lvl++) {
    const hitDie = hitDicePerLevel[lvl - 1] ?? 8;
    let dieValue: number;
    let method: string;
    let dieDisplay: string;

    if (lvl === 1) {
      dieValue = hitDie;
      method = "Máximo (auto)";
      dieDisplay = `${hitDie}`;
    } else if (useAverage) {
      dieValue = Math.floor(hitDie / 2) + 1;
      method = `Media d${hitDie}`;
      dieDisplay = `${dieValue}`;
    } else {
      const roll = getRoll(lvl);
      dieValue = roll?.value ?? 0;
      method = `Dado d${hitDie}`;
      dieDisplay = roll ? `${roll.value}` : "—";
    }

    const contribution = Math.max(1, dieValue + conMod);
    running += contribution;
    rows.push({ level: lvl, hitDie, method, dieDisplay, total: running });
  }

  return (
    <div className="space-y-3">
      {/* Toggle método */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-400 mr-1">Método nv.2+:</span>
        {[
          { label: "Media", value: true },
          { label: "Tirar dado", value: false },
        ].map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onMethodChange(opt.value)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              useAverage === opt.value
                ? "bg-stone-700 border border-amber-500 text-amber-400"
                : "bg-stone-800 border border-stone-700 text-stone-500 hover:text-stone-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tabla de niveles */}
      <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-4 px-3 py-1.5 bg-stone-800 text-xs text-stone-500 uppercase tracking-wider">
          <span>Nivel</span>
          <span>Método</span>
          <span>Dado</span>
          <span>Total</span>
        </div>
        {rows.map(row => (
          <div
            key={row.level}
            className="grid grid-cols-4 px-3 py-2 border-t border-stone-800 items-center"
          >
            <span className={row.level === 1 ? "text-amber-400 font-bold text-sm" : "text-stone-400 text-sm"}>
              {row.level}
            </span>
            <span className="text-stone-400 text-xs">{row.method}</span>
            <span>
              {row.level > 1 && !useAverage ? (
                <input
                  type="number"
                  min={1}
                  max={row.hitDie}
                  value={getRoll(row.level)?.value ?? ""}
                  placeholder="—"
                  onChange={e => updateRoll(row.level, e.target.value)}
                  className="w-14 bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-stone-100 text-xs text-center focus:outline-none focus:border-amber-500"
                />
              ) : (
                <span className="text-stone-300 text-sm">{row.dieDisplay}</span>
              )}
            </span>
            <span className="text-stone-100 font-bold text-sm">{row.total}</span>
          </div>
        ))}
      </div>

      {/* HP Máx total */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-stone-400">HP Máx calculado:</span>
        <span className="text-amber-400 font-bold text-xl">{hpMax}</span>
        <span className="text-xs text-stone-500">
          (CON {conMod >= 0 ? "+" : ""}{conMod} por nivel)
        </span>
      </div>
    </div>
  );
}
