"use client";
import React from "react";
import { PlayerClassEntry, totalLevel, proficiencyBonus } from "../../../lib/player-calcs";
import { DND_CLASSES, HIT_DIE_BY_CLASS } from "../../../lib/dnd-2024-data";

interface ClassesPanelProps {
  classes: PlayerClassEntry[];
  onChange: (classes: PlayerClassEntry[]) => void;
}

export function ClassesPanel({ classes, onChange }: ClassesPanelProps) {
  const classNames = Object.keys(DND_CLASSES).sort();
  const level = totalLevel(classes);
  const pb = proficiencyBonus(level || 1);
  const hitDiceStr = classes
    .map(c => `${c.level}d${HIT_DIE_BY_CLASS[c.class] ?? 8}`)
    .join(" + ") || "—";

  function updateClass(index: number, field: keyof PlayerClassEntry, value: string | number) {
    const updated = classes.map((c, i) => {
      if (i !== index) return c;
      const entry = { ...c, [field]: value };
      // Limpiar subclase si el nivel baja de 3
      if (field === "level" && typeof value === "number" && value < 3) {
        entry.subclass = "";
      }
      return entry;
    });
    onChange(updated);
  }

  function addClass() {
    onChange([...classes, { class: "Guerrero", level: 1, subclass: "" }]);
  }

  function removeClass(index: number) {
    onChange(classes.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {classes.map((cls, i) => {
        const subclasses = DND_CLASSES[cls.class] ?? [];
        const showSubclass = cls.level >= 3;

        return (
          <div
            key={`${cls.class}-${i}`}
            className="grid gap-2 items-center"
            style={{ gridTemplateColumns: "1fr 64px 160px 24px" }}
          >
            {/* Clase */}
            <select
              value={cls.class}
              onChange={e => updateClass(i, "class", e.target.value)}
              className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            >
              {classNames.map(cn => <option key={cn} value={cn}>{cn}</option>)}
            </select>

            {/* Nivel */}
            <input
              type="number"
              min={1}
              max={20}
              value={cls.level}
              onChange={e => updateClass(i, "level", Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-100 text-sm text-center focus:outline-none focus:border-amber-500"
            />

            {/* Subclase */}
            {showSubclass ? (
              <select
                value={cls.subclass}
                onChange={e => updateClass(i, "subclass", e.target.value)}
                className="bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">— Subclase —</option>
                {[...subclasses, "Homebrew / Otra"].map(sc => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-stone-500 italic px-1">(subclase a nv.3)</p>
            )}

            {/* Botón eliminar — solo si hay más de una clase */}
            {classes.length > 1 ? (
              <button
                onClick={() => removeClass(i)}
                className="text-stone-500 hover:text-red-400 transition-colors text-sm leading-none"
                title="Eliminar clase"
                aria-label="Eliminar clase"
              >
                ✕
              </button>
            ) : (
              <div />
            )}
          </div>
        );
      })}

      {/* Añadir clase */}
      <button
        onClick={addClass}
        className="w-full border border-dashed border-stone-700 rounded py-2 text-xs text-stone-500 hover:text-stone-300 hover:border-stone-500 transition-colors"
      >
        + Añadir clase
      </button>

      {/* Totales */}
      <div className="flex gap-4 border-t border-stone-800 pt-2">
        <span className="text-xs text-stone-400">
          Nivel total: <span className="text-amber-400 font-bold">{level || "—"}</span>
        </span>
        <span className="text-xs text-stone-400">
          Bon. Comp.: <span className="text-amber-400 font-bold">+{pb}</span>
        </span>
        <span className="text-xs text-stone-400">
          Dados de vida: <span className="text-amber-400">{hitDiceStr}</span>
        </span>
      </div>
    </div>
  );
}
