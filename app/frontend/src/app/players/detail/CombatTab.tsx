"use client";

import {
  abilityModifier,
  proficiencyBonus,
  totalLevel,
  type PlayerClassEntry,
  type WeaponEntry,
} from "../../../lib/player-calcs";
import {
  WEAPON_LIST,
  WEAPON_MASTERIES,
} from "../../../lib/dnd-2024-data";
import { type CharacterFormProps, weaponOptionLabel } from "./player-types";
import { SectionTitle } from "./player-ui";

interface CombatTabProps extends CharacterFormProps {
  classes: PlayerClassEntry[];
  finalStr: number;
  finalDex: number;
}

export function CombatTab({ form, set, classes, finalStr, finalDex }: CombatTabProps) {
  function parseJson<T>(v: string, fallback: T): T {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  const level = totalLevel(classes) || 1;
  const pb = proficiencyBonus(level);
  const weapons: WeaponEntry[] = parseJson(form.weapons ?? "[]", []);

  function addWeapon() {
    const newWeapon: WeaponEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      weaponKey: "", customName: "", ability: "strength",
      magical: false, magicBonus: 0, extraDamage: false, extraDamageDesc: "",
    };
    set("weapons", JSON.stringify([...weapons, newWeapon]));
  }

  function removeWeapon(idx: number) {
    set("weapons", JSON.stringify(weapons.filter((_, i) => i !== idx)));
  }

  function updateWeapon(idx: number, patch: Partial<WeaponEntry>) {
    set("weapons", JSON.stringify(weapons.map((w, i) => i === idx ? { ...w, ...patch } : w)));
  }

  function handleWeaponSelect(idx: number, key: string) {
    const wData = key ? WEAPON_LIST[key] : null;
    const ability: "strength" | "dexterity" =
      wData?.ability === "dexterity" ? "dexterity"
      : wData?.ability === "finesse"  ? (weapons[idx]?.ability ?? "strength")
      : "strength";
    updateWeapon(idx, { weaponKey: key, ability });
  }

  return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <SectionTitle>Armas</SectionTitle>
              <button
                onClick={addWeapon}
                className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-xs text-stone-300 transition-colors"
              >
                + Añadir arma
              </button>
            </div>

            {weapons.length === 0 && (
              <p className="text-stone-500 text-sm italic text-center py-10">
                Sin armas. Pulsa «Añadir arma» para registrar la primera.
              </p>
            )}

            {weapons.map((weapon, wi) => {
              const wData  = weapon.weaponKey ? WEAPON_LIST[weapon.weaponKey] : null;
              const isFinesse = wData?.ability === "finesse";
              const strMod = abilityModifier(finalStr);
              const dexMod = abilityModifier(finalDex);
              const abilMod   = weapon.ability === "dexterity" ? dexMod : strMod;
              const magBonus  = weapon.magical ? weapon.magicBonus : 0;
              const atkBonus  = pb + abilMod + magBonus;
              const dmgMod    = abilMod + magBonus;
              const damageDice = wData?.damageDice ?? "1d6";
              const dmgStr = damageDice === "—"
                ? "—"
                : `${damageDice}${dmgMod > 0 ? "+" + dmgMod : dmgMod < 0 ? dmgMod : ""}`;
              const displayName = weapon.customName || wData?.label || "Arma personalizada";

              return (
                <div key={weapon.id} className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3">
                  {/* Cabecera: nombre y eliminar */}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-200 text-sm flex-1">{displayName}</span>
                    {wData?.properties && (
                      <span className="text-[10px] text-stone-600 italic">{wData.properties}</span>
                    )}
                    <button
                      onClick={() => removeWeapon(wi)}
                      className="text-stone-600 hover:text-red-400 text-xs transition-colors shrink-0"
                      aria-label="Eliminar arma"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Fila 1: selector de arma + nombre personalizado */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-stone-500 mb-1">Arma base</p>
                      <select
                        value={weapon.weaponKey}
                        onChange={e => handleWeaponSelect(wi, e.target.value)}
                        className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                      >
                        <option value="">— Personalizada —</option>
                        <optgroup label="Simples cuerpo a cuerpo">
                          {Object.entries(WEAPON_LIST).filter(([, d]) => d.category === "simple-melee").map(([k, d]) => (
                            <option key={k} value={k}>{weaponOptionLabel(d)}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Simples a distancia">
                          {Object.entries(WEAPON_LIST).filter(([, d]) => d.category === "simple-ranged").map(([k, d]) => (
                            <option key={k} value={k}>{weaponOptionLabel(d)}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Marciales cuerpo a cuerpo">
                          {Object.entries(WEAPON_LIST).filter(([, d]) => d.category === "martial-melee").map(([k, d]) => (
                            <option key={k} value={k}>{weaponOptionLabel(d)}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Marciales a distancia">
                          {Object.entries(WEAPON_LIST).filter(([, d]) => d.category === "martial-ranged").map(([k, d]) => (
                            <option key={k} value={k}>{weaponOptionLabel(d)}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-1">Nombre personalizado</p>
                      <input
                        type="text"
                        value={weapon.customName}
                        onChange={e => updateWeapon(wi, { customName: e.target.value })}
                        placeholder={wData?.label ?? "Ej. Espada de los Dioses"}
                        className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Fila 2: característica + stats calculados */}
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <p className="text-xs text-stone-500 mb-1">Característica</p>
                      <select
                        value={weapon.ability}
                        disabled={!isFinesse && !!weapon.weaponKey}
                        onChange={e => updateWeapon(wi, { ability: e.target.value as "strength" | "dexterity" })}
                        className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-60 disabled:cursor-default"
                        title={isFinesse ? "Finesse: elige FUE o DES" : undefined}
                      >
                        <option value="strength">FUE ({strMod >= 0 ? "+" : ""}{strMod})</option>
                        <option value="dexterity">DES ({dexMod >= 0 ? "+" : ""}{dexMod})</option>
                      </select>
                    </div>
                    <div className="flex-1 flex gap-4 justify-end">
                      <div className="text-center">
                        <p className="text-xs text-stone-500 mb-0.5">Ataque</p>
                        <p className="text-2xl font-bold text-amber-400">{atkBonus >= 0 ? "+" : ""}{atkBonus}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-stone-500 mb-0.5">Daño</p>
                        <p className="text-lg font-bold text-stone-200">{dmgStr}</p>
                        {wData?.damageType && wData.damageType !== "—" && (
                          <p className="text-[10px] text-stone-600">{wData.damageType}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modificador mágico */}
                  <div className="pt-2 border-t border-stone-800 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={weapon.magical}
                        onChange={e => updateWeapon(wi, { magical: e.target.checked, magicBonus: e.target.checked ? (weapon.magicBonus || 1) : 0 })}
                        className="accent-amber-500"
                      />
                      <span className="text-xs text-stone-400">¿Es mágica?</span>
                    </label>

                    {weapon.magical && (
                      <div className="pl-5 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-stone-500 w-24">Bonif. mágico</span>
                          <select
                            value={weapon.magicBonus}
                            onChange={e => updateWeapon(wi, { magicBonus: parseInt(e.target.value) })}
                            className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-amber-300 text-xs font-bold focus:outline-none focus:border-amber-500"
                          >
                            {[0,1,2,3].map(n => <option key={n} value={n}>+{n}</option>)}
                          </select>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={weapon.extraDamage}
                            onChange={e => updateWeapon(wi, { extraDamage: e.target.checked })}
                            className="accent-amber-500"
                          />
                          <span className="text-xs text-stone-400">¿Daño extra?</span>
                        </label>
                        {weapon.extraDamage && (
                          <input
                            type="text"
                            value={weapon.extraDamageDesc}
                            onChange={e => updateWeapon(wi, { extraDamageDesc: e.target.value })}
                            placeholder="ej. 1d6 fuego, 2d6 radiante vs no-muertos"
                            className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-300 text-xs placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Maestría */}
                  {wData?.mastery && WEAPON_MASTERIES[wData.mastery] && (
                    <div className="pt-2 border-t border-stone-800">
                      <p className="text-xs font-bold text-stone-300 mb-0.5">
                        Maestría: {WEAPON_MASTERIES[wData.mastery]!.name}
                      </p>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        {WEAPON_MASTERIES[wData.mastery]!.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
  );
}
