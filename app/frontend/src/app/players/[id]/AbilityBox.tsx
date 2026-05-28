"use client";

import { abilityModifier } from "../../../lib/player-calcs";
import { ABILITIES } from "./player-types";

export function AbilityBox({
  ability, value, featBonus = 0, onChange,
  saveFromClass, hasSave, saveTotal, saveSourceClass, onSaveToggle,
}: {
  ability: typeof ABILITIES[number];
  value: number | null | undefined;
  featBonus?: number;
  onChange: (v: number | null) => void;
  saveFromClass?: boolean;
  hasSave?: boolean;
  saveTotal?: number;
  saveSourceClass?: string;
  onSaveToggle?: (checked: boolean) => void;
}) {
  const baseScore = value ?? 10;
  const finalScore = Math.min(30, Math.max(1, baseScore + featBonus));
  const m = abilityModifier(finalScore);
  const modStr = m >= 0 ? `+${m}` : `${m}`;
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 text-center">
      <p className="text-xs text-amber-500 font-bold uppercase mb-1">{ability.label}</p>
      <p className="text-2xl font-bold text-stone-100 mb-1">{modStr}</p>
      <input
        type="number"
        value={value ?? ""}
        min={1} max={30}
        onChange={e => onChange(e.target.value === "" ? null : parseInt(e.target.value))}
        className="w-full bg-stone-900 border border-stone-600 rounded px-1 py-0.5 text-stone-300 text-sm text-center focus:outline-none focus:border-amber-500"
        placeholder="—"
      />
      {featBonus !== 0 && (
        <p className="text-xs text-stone-500 mt-0.5">{baseScore} + {featBonus} = {finalScore}</p>
      )}
      {onSaveToggle !== undefined && (
        <div className="mt-2 pt-2 border-t border-stone-700 flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={hasSave ?? false}
            disabled={saveFromClass}
            onChange={e => onSaveToggle(e.target.checked)}
            className={`${saveFromClass ? "accent-sky-500" : "accent-amber-500"} disabled:cursor-default`}
            title={saveSourceClass ? `Competencia de clase: ${saveSourceClass}` : "Tirada de salvación"}
          />
          <span className="text-[10px] text-stone-400 flex-1 text-left">Salvación</span>
          {saveFromClass && (
            <span className="text-[10px] font-bold bg-sky-900/60 text-sky-300 px-1 rounded" title={`Clase: ${saveSourceClass}`}>C</span>
          )}
          <span className={`text-xs font-mono font-bold ${hasSave ? "text-amber-400" : "text-stone-500"}`}>
            {(saveTotal ?? 0) >= 0 ? `+${saveTotal}` : saveTotal}
          </span>
        </div>
      )}
    </div>
  );
}
