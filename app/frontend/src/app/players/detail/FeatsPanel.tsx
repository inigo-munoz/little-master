"use client";
import React from "react";
import { FeatEntry, FeatStatBonus, PlayerClassEntry } from "../../../lib/player-calcs";
import {
  asiLevelsForClass,
  ORIGIN_FEATS,
  GENERAL_FEATS,
  FIGHTING_STYLE_FEATS,
  EPIC_BOON_FEATS,
} from "../../../lib/dnd-2024-data";

interface FeatsPanelProps {
  feats: FeatEntry[];
  classes: PlayerClassEntry[];
  onChange: (feats: FeatEntry[]) => void;
}

const STAT_OPTIONS: { value: FeatStatBonus["stat"]; label: string }[] = [
  { value: "strength",     label: "FUE — Fuerza" },
  { value: "dexterity",    label: "DES — Destreza" },
  { value: "constitution", label: "CON — Constitución" },
  { value: "intelligence", label: "INT — Inteligencia" },
  { value: "wisdom",       label: "SAB — Sabiduría" },
  { value: "charisma",     label: "CAR — Carisma" },
];

interface AsiSlot { classIndex: number; className: string; classLevel: number }

function buildAsiSlots(classes: PlayerClassEntry[]): AsiSlot[] {
  const slots: AsiSlot[] = [];
  for (let ci = 0; ci < classes.length; ci++) {
    const cls = classes[ci];
    if (!cls) continue;
    const asiLevels = asiLevelsForClass(cls.class);
    for (const asiLvl of asiLevels) {
      if (asiLvl <= cls.level) {
        slots.push({ classIndex: ci, className: cls.class, classLevel: asiLvl });
      }
    }
  }
  return slots.sort((a, b) =>
    a.classIndex !== b.classIndex ? a.classIndex - b.classIndex : a.classLevel - b.classLevel
  );
}

export function FeatsPanel({ feats, classes, onChange }: FeatsPanelProps) {
  const slots = buildAsiSlots(classes);
  const startingFeats = feats.filter(f => f.classIndex < 0);

  function getFeat(classIndex: number, classLevel: number): FeatEntry | undefined {
    return feats.find(f => f.classIndex === classIndex && f.level === classLevel);
  }

  function ensureFeat(classIndex: number, classLevel: number): FeatEntry {
    const existing = getFeat(classIndex, classLevel);
    if (existing) return existing;
    return { name: "", classIndex, level: classLevel, statBonuses: [] };
  }

  function upsertFeat(updated: FeatEntry) {
    const exists = feats.some(f => f.classIndex === updated.classIndex && f.level === updated.level);
    if (exists) {
      onChange(feats.map(f =>
        f.classIndex === updated.classIndex && f.level === updated.level ? updated : f
      ));
    } else {
      onChange([...feats, updated]);
    }
  }

  function setFeatName(classIndex: number, classLevel: number, name: string) {
    upsertFeat({ ...ensureFeat(classIndex, classLevel), name });
  }

  function addStatBonus(classIndex: number, classLevel: number) {
    const feat = ensureFeat(classIndex, classLevel);
    upsertFeat({
      ...feat,
      statBonuses: [...feat.statBonuses, { stat: "strength", value: 1 }],
    });
  }

  function updateStatBonus(
    classIndex: number,
    classLevel: number,
    bi: number,
    patch: Partial<FeatStatBonus>
  ) {
    const feat = ensureFeat(classIndex, classLevel);
    upsertFeat({
      ...feat,
      statBonuses: feat.statBonuses.map((b, idx) => idx === bi ? { ...b, ...patch } : b),
    });
  }

  function removeStatBonus(classIndex: number, classLevel: number, bi: number) {
    const feat = ensureFeat(classIndex, classLevel);
    upsertFeat({
      ...feat,
      statBonuses: feat.statBonuses.filter((_, idx) => idx !== bi),
    });
  }

  if (slots.length === 0 && startingFeats.length === 0) {
    return (
      <p className="text-xs text-stone-500 italic">
        Los slots de dote aparecen al alcanzar nivel 4 en cualquier clase.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Dotes de inicio: trasfondo (classIndex -1) y especie (classIndex -2) */}
      {startingFeats.length > 0 && (
        <>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Dotes de inicio</p>
          {startingFeats.map(feat => {
            const isBackground = feat.classIndex === -1;
            const label = isBackground ? "Trasfondo" : "Especie";
            const badgeClass = isBackground
              ? "bg-amber-900/60 text-amber-300"
              : "bg-emerald-900/60 text-emerald-300";

            return (
              <div key={`start-${feat.classIndex}`} className="bg-stone-900 border border-stone-800 rounded-lg p-3 flex items-center gap-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${badgeClass}`}>
                  {label}
                </span>
                {isBackground ? (
                  <span className="text-stone-300 text-xs flex-1">{feat.name || "—"}</span>
                ) : (
                  <select
                    value={feat.name}
                    onChange={e => setFeatName(-2, 0, e.target.value)}
                    className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="">— Elige dote de Origen —</option>
                    {(ORIGIN_FEATS as readonly string[]).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
          {slots.length > 0 && <div className="border-b border-stone-800 pt-1" />}
        </>
      )}

      {/* Slots de ASI/dote por nivel de clase */}
      {slots.map(slot => {
        const feat = getFeat(slot.classIndex, slot.classLevel);
        const key = `${slot.classIndex}-${slot.classLevel}`;

        return (
          <div key={key} className="bg-stone-900 border border-stone-800 rounded-lg p-3 space-y-2">
            {/* Cabecera del slot */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-500 shrink-0">
                {slot.className} nv.{slot.classLevel}
              </span>
              <select
                value={feat?.name ?? ""}
                onChange={e => setFeatName(slot.classIndex, slot.classLevel, e.target.value)}
                className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="">— Elige dote o ASI —</option>
                <option value="Mejora de Característica">Mejora de Característica (+2 / +1+1)</option>
                <optgroup label="Dotes de Origen">
                  {(ORIGIN_FEATS as readonly string[]).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </optgroup>
                <optgroup label="Dotes Generales">
                  {(GENERAL_FEATS as readonly string[]).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </optgroup>
                <optgroup label="Estilo de Combate">
                  {(FIGHTING_STYLE_FEATS as readonly string[]).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </optgroup>
                <optgroup label="Bendiciones Épicas (nv. 19+)">
                  {(EPIC_BOON_FEATS as readonly string[]).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Bonos de stat */}
            {feat?.statBonuses.map((bonus, bi) => (
              <div key={bi} className="flex items-center gap-2 pl-4">
                <select
                  value={bonus.value}
                  onChange={e => updateStatBonus(slot.classIndex, slot.classLevel, bi, { value: parseInt(e.target.value) as 1 | 2 })}
                  className="w-14 bg-stone-800 border border-stone-700 rounded px-1 py-1 text-stone-100 text-xs"
                >
                  <option value={1}>+1</option>
                  <option value={2}>+2</option>
                </select>
                <select
                  value={bonus.stat}
                  onChange={e => updateStatBonus(slot.classIndex, slot.classLevel, bi, { stat: e.target.value as FeatStatBonus["stat"] })}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs"
                >
                  {STAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button
                  onClick={() => removeStatBonus(slot.classIndex, slot.classLevel, bi)}
                  className="text-stone-500 hover:text-red-400 text-xs transition-colors shrink-0"
                  aria-label="Eliminar bono"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Añadir bono */}
            <button
              onClick={() => addStatBonus(slot.classIndex, slot.classLevel)}
              className="pl-4 text-xs text-stone-500 hover:text-stone-300 transition-colors"
            >
              + Bono de característica
            </button>
          </div>
        );
      })}
    </div>
  );
}
