"use client";

import { useState } from "react";
import { api } from "../../../lib/api";
import { type SpellFullData } from "../../../lib/api";
import {
  PACT_MAGIC_CLASS,
  WARLOCK_PACT_MAGIC,
  SPELL_LISTS_BY_CLASS,
  isClassSpellcaster,
  type SpellListEntry,
} from "../../../lib/dnd-2024-data";
import {
  type PlayerClassEntry,
  type SpellEntry,
  calcSuggestedSpellSlots,
} from "../../../lib/player-calcs";
import { type CharacterFormProps, type SlotEntry, parseSlotData } from "./player-types";

interface SpellsTabProps extends CharacterFormProps {
  classes: PlayerClassEntry[];
  calcDC: number | null;
  calcAttack: number | null;
}

export function SpellsTab({ form, set, classes, calcDC, calcAttack }: SpellsTabProps) {
  const [spellModalOpen, setSpellModalOpen] = useState(false);
  const [spellModalClass, setSpellModalClass] = useState("");
  const [spellModalLevel, setSpellModalLevel] = useState(0);
  const [spellSearch, setSpellSearch] = useState("");
  const [expandedSpellId, setExpandedSpellId] = useState<string | null>(null);
  const [spellDetailCache, setSpellDetailCache] = useState<Record<string, SpellFullData | null>>({});

  function parseJson<T>(v: string, fallback: T): T {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  const HALF_CASTER_CLASSES_SET = new Set(["Paladín", "Explorador"]);
  const spells: SpellEntry[] = parseJson(form.spells ?? "[]", []);
  const slotData = parseSlotData(form.spellSlots ?? "{}");

  const warlockEntry  = classes.find(c => c.class === PACT_MAGIC_CLASS);
  const pactMagic     = warlockEntry ? (WARLOCK_PACT_MAGIC[warlockEntry.level] ?? null) : null;

  const mainSpellClass = (() => {
    const fc = classes.find(c => SPELL_LISTS_BY_CLASS[c.class]?.[1] !== undefined && !HALF_CASTER_CLASSES_SET.has(c.class));
    if (fc) return fc.class;
    const hc = classes.find(c => HALF_CASTER_CLASSES_SET.has(c.class));
    if (hc) return hc.class;
    if (warlockEntry) return PACT_MAGIC_CLASS;
    return classes.find(c => isClassSpellcaster(c.class, c.subclass))?.class ?? "";
  })();

  async function toggleSpellExpand(spell: SpellEntry) {
    if (expandedSpellId === spell.id) {
      setExpandedSpellId(null);
      return;
    }
    setExpandedSpellId(spell.id);
    if (!(spell.name in spellDetailCache)) {
      const data = await api.spells.lookup(spell.name);
      setSpellDetailCache(prev => ({ ...prev, [spell.name]: data }));
    }
  }

  function addSpell(entry: SpellListEntry, level: number) {
    if (spells.some(s => s.name === entry.name && s.level === level)) return;
    const newSpell: SpellEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: entry.name,
      level,
      concentration: entry.concentration,
      ritual: entry.ritual,
    };
    set("spells", JSON.stringify([...spells, newSpell]));
  }

  function removeSpell(id: string) {
    set("spells", JSON.stringify(spells.filter(s => s.id !== id)));
  }

  function getSlot(key: string): SlotEntry {
    return slotData[key] ?? { max: 0, used: 0 };
  }

  function setSlot(key: string, used: number, max?: number) {
    const current = getSlot(key);
    const newMax  = max !== undefined ? max : current.max;
    const newUsed = Math.max(0, Math.min(newMax, used));
    const next = { ...slotData, [key]: { max: newMax, used: newUsed } };
    set("spellSlots", JSON.stringify(next));
  }

  function toggleBubble(key: string, bubbleIdx: number) {
    const current = getSlot(key);
    const newUsed = bubbleIdx < current.used ? bubbleIdx : bubbleIdx + 1;
    setSlot(key, newUsed);
  }

  function syncRegularSlots() {
    const suggested = calcSuggestedSpellSlots(classes);
    const next: Record<string, SlotEntry> = { ...slotData };
    for (const [lvl, max] of Object.entries(suggested)) {
      next[lvl] = { max, used: Math.min(slotData[lvl]?.used ?? 0, max) };
    }
    set("spellSlots", JSON.stringify(next));
  }

  function syncPactSlots() {
    if (!pactMagic) return;
    const next = { ...slotData, pact: { max: pactMagic.slots, used: Math.min(slotData["pact"]?.used ?? 0, pactMagic.slots) } };
    set("spellSlots", JSON.stringify(next));
  }

  function getSpellsForModal(): SpellListEntry[] {
    const classesToSearch = spellModalClass
      ? [spellModalClass]
      : Object.keys(SPELL_LISTS_BY_CLASS);
    const seen = new Set<string>();
    const all: SpellListEntry[] = [];
    for (const cls of classesToSearch) {
      for (const entry of (SPELL_LISTS_BY_CLASS[cls]?.[spellModalLevel] ?? [])) {
        if (!seen.has(entry.name)) { seen.add(entry.name); all.push(entry); }
      }
    }
    const q = spellSearch.trim().toLowerCase();
    const filtered = q ? all.filter(e => e.name.toLowerCase().includes(q)) : all;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
          <div className="space-y-5">

            {/* Barra de estadísticas de conjuración */}
            <div className="flex items-center gap-3 bg-stone-800/60 border border-stone-700 rounded-lg p-3">
              <div className="flex-1">
                <p className="text-[10px] text-stone-500 mb-0.5 uppercase tracking-wide">Caract. conjuración</p>
                <select
                  value={form.spellcastingAbility ?? ""}
                  onChange={e => set("spellcastingAbility", e.target.value || null)}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">Auto</option>
                  <option value="intelligence">INT — Inteligencia</option>
                  <option value="wisdom">SAB — Sabiduría</option>
                  <option value="charisma">CAR — Carisma</option>
                </select>
              </div>
              <div className="text-center min-w-[48px]">
                <p className="text-[10px] text-stone-500 uppercase tracking-wide">CD</p>
                <p className="text-xl font-bold text-amber-400">{calcDC ?? "—"}</p>
              </div>
              <div className="text-center min-w-[48px]">
                <p className="text-[10px] text-stone-500 uppercase tracking-wide">Ataque</p>
                <p className="text-xl font-bold text-amber-400">
                  {calcAttack !== null ? (calcAttack >= 0 ? `+${calcAttack}` : calcAttack) : "—"}
                </p>
              </div>
            </div>

            {/* Magia de Pacto (Brujo) */}
            {pactMagic && (() => {
              const pact = getSlot("pact");
              return (
                <div className="bg-stone-900 border border-violet-800/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Magia de Pacto</span>
                    <span className="text-xs text-stone-500">espacios nv.{pactMagic.slotLevel}</span>
                    <button
                      onClick={syncPactSlots}
                      className="ml-auto text-xs text-stone-500 hover:text-violet-400 transition-colors"
                      title="Sincronizar según nivel de Brujo"
                    >
                      ↺ Sincronizar
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: pact.max }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => toggleBubble("pact", i)}
                        title={i < pact.used ? "Recuperar espacio" : "Gastar espacio"}
                        className={`w-5 h-5 rounded-full border-2 transition-colors ${
                          i < pact.used
                            ? "border-violet-600 bg-transparent"
                            : "border-violet-400 bg-violet-400"
                        }`}
                      />
                    ))}
                    <button onClick={() => setSlot("pact", pact.used, pact.max + 1)} className="text-stone-500 hover:text-stone-300 text-xs ml-1" aria-label="Añadir espacio de pacto">+</button>
                    {pact.max > 0 && (
                      <button onClick={() => setSlot("pact", Math.min(pact.used, pact.max - 1), pact.max - 1)} className="text-stone-500 hover:text-stone-300 text-xs" aria-label="Quitar espacio de pacto">−</button>
                    )}
                    <span className="text-xs text-stone-500 ml-1">{pact.max - pact.used}/{pact.max}</span>
                  </div>
                </div>
              );
            })()}

            {/* Botón de sincronización de espacios normales */}
            {mainSpellClass !== PACT_MAGIC_CLASS && mainSpellClass !== "" && (
              <div className="flex justify-end">
                <button
                  onClick={syncRegularSlots}
                  className="text-xs text-stone-500 hover:text-amber-400 transition-colors"
                  title="Calcula los espacios según tus niveles de clase"
                >
                  ↺ Sincronizar espacios según nivel
                </button>
              </div>
            )}

            {/* Secciones por nivel (0 = trucos, 1–9 = niveles) */}
            {[0,1,2,3,4,5,6,7,8,9].map(lvl => {
              const spellsAtLevel = spells.filter(s => s.level === lvl);
              const slotKey = String(lvl);
              const slot = lvl > 0 ? getSlot(slotKey) : null;
              const hasSlots = slot !== null && slot.max > 0;

              if (lvl > 0 && !hasSlots && spellsAtLevel.length === 0) return null;
              if (lvl === 0 && spellsAtLevel.length === 0 && HALF_CASTER_CLASSES_SET.has(mainSpellClass)) return null;

              return (
                <div key={lvl} className="space-y-2">
                  {/* Cabecera del nivel */}
                  <div className="flex items-center gap-2 border-b border-stone-800 pb-1">
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">
                      {lvl === 0 ? "Trucos" : `Nivel ${lvl}`}
                    </span>

                    {/* Burbujas de espacios */}
                    {slot !== null && (
                      <div className="flex items-center gap-1 ml-1">
                        {Array.from({ length: slot.max }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => toggleBubble(slotKey, i)}
                            title={i < slot.used ? "Recuperar espacio" : "Gastar espacio"}
                            className={`w-4 h-4 rounded-full border-2 transition-colors ${
                              i < slot.used
                                ? "border-stone-600 bg-transparent"
                                : "border-amber-400 bg-amber-400"
                            }`}
                          />
                        ))}
                        <button onClick={() => setSlot(slotKey, slot.used, slot.max + 1)} className="text-stone-500 hover:text-stone-300 text-xs" aria-label="Añadir espacio de hechizo">+</button>
                        {slot.max > 0 && (
                          <button onClick={() => setSlot(slotKey, Math.min(slot.used, slot.max - 1), slot.max - 1)} className="text-stone-500 hover:text-stone-300 text-xs" aria-label="Quitar espacio de hechizo">−</button>
                        )}
                        {slot.max > 0 && (
                          <span className="text-[10px] text-stone-500">{slot.max - slot.used}/{slot.max}</span>
                        )}
                      </div>
                    )}

                    {/* Botón añadir hechizo */}
                    <button
                      onClick={() => {
                        setSpellModalLevel(lvl);
                        setSpellModalClass(mainSpellClass);
                        setSpellSearch("");
                        setSpellModalOpen(true);
                      }}
                      className="ml-auto text-xs text-amber-600 hover:text-amber-400 transition-colors"
                    >
                      + Añadir
                    </button>
                  </div>

                  {/* Lista de hechizos */}
                  {spellsAtLevel.length === 0 ? (
                    <p className="text-xs text-stone-600 italic pl-1">Sin hechizos</p>
                  ) : (
                    <div className="space-y-1">
                      {spellsAtLevel.map(spell => {
                        const isExpanded = expandedSpellId === spell.id;
                        const detail = spellDetailCache[spell.name];
                        return (
                          <div key={spell.id} className="rounded overflow-hidden">
                            {/* Fila compacta */}
                            <div
                              className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors ${
                                isExpanded ? "bg-stone-700" : "bg-stone-900 hover:bg-stone-800"
                              }`}
                              onClick={() => toggleSpellExpand(spell)}
                            >
                              <span className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                              <span className="text-sm text-stone-200 flex-1">{spell.name}</span>
                              {spell.concentration && (
                                <span className="text-[10px] font-bold bg-blue-900/60 text-blue-300 px-1.5 rounded" title="Concentración">C</span>
                              )}
                              {spell.ritual && (
                                <span className="text-[10px] font-bold bg-green-900/60 text-green-300 px-1.5 rounded" title="Ritual">R</span>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); removeSpell(spell.id); }}
                                className="text-stone-600 hover:text-red-400 text-xs transition-colors shrink-0"
                                aria-label="Eliminar hechizo"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Vista expandida */}
                            {isExpanded && (
                              <div className="bg-stone-950 border border-stone-700 border-t-0 rounded-b px-3 py-3 space-y-3">
                                {detail === undefined ? (
                                  <p className="text-xs text-stone-500 italic">Cargando...</p>
                                ) : detail === null ? (
                                  <p className="text-xs text-stone-500 italic">
                                    Descripción no disponible para &quot;{spell.name}&quot;.
                                  </p>
                                ) : (
                                  <>
                                    {/* Cabecera: nivel + escuela */}
                                    <div className="flex items-start gap-2 flex-wrap">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-stone-400">
                                          {detail.level === 0
                                            ? `Truco · ${detail.school}`
                                            : `Nivel ${detail.level} · ${detail.school}`}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {detail.concentration && (
                                          <span className="text-[10px] font-bold bg-blue-900/70 text-blue-300 px-1.5 py-0.5 rounded" title="Concentración">C</span>
                                        )}
                                        {detail.ritual && (
                                          <span className="text-[10px] font-bold bg-green-900/70 text-green-300 px-1.5 py-0.5 rounded" title="Ritual">R</span>
                                        )}
                                        {/Adicional/.test(detail.castingTime) && (
                                          <span className="text-[10px] font-bold bg-orange-900/70 text-orange-300 px-1.5 py-0.5 rounded" title="Acción adicional">AA</span>
                                        )}
                                        {/Reacción|reacción/.test(detail.castingTime) && (
                                          <span className="text-[10px] font-bold bg-purple-900/70 text-purple-300 px-1.5 py-0.5 rounded" title="Reacción">Rx</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Stats: tiempo, alcance, duración */}
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                      {[
                                        { label: "Tiempo", value: detail.castingTime },
                                        { label: "Alcance", value: detail.range },
                                        { label: "Duración", value: detail.duration },
                                      ].map(({ label, value }) => (
                                        <div key={label} className="bg-stone-900 rounded p-1.5">
                                          <p className="text-[9px] text-stone-500 uppercase tracking-wide mb-0.5">{label}</p>
                                          <p className="text-xs text-stone-200 leading-tight">{value}</p>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Componentes */}
                                    <div className="flex items-start gap-2 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        {detail.components.verbal && (
                                          <span className="text-[10px] font-bold bg-stone-700 text-stone-300 px-1.5 py-0.5 rounded" title="Verbal">V</span>
                                        )}
                                        {detail.components.somatic && (
                                          <span className="text-[10px] font-bold bg-stone-700 text-stone-300 px-1.5 py-0.5 rounded" title="Somático">S</span>
                                        )}
                                        {detail.components.material && (
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            detail.components.consumed
                                              ? "bg-red-900/60 text-red-300"
                                              : detail.components.hasCost
                                              ? "bg-yellow-900/60 text-yellow-300"
                                              : "bg-stone-700 text-stone-300"
                                          }`} title="Material">M</span>
                                        )}
                                      </div>
                                      {detail.components.material && detail.components.materialDesc && (
                                        <p className={`text-xs flex-1 leading-tight ${
                                          detail.components.consumed
                                            ? "text-red-300"
                                            : detail.components.hasCost
                                            ? "text-yellow-300"
                                            : "text-stone-400"
                                        }`}>
                                          {detail.components.materialDesc}
                                          {detail.components.consumed && <span className="ml-1 font-bold">✗</span>}
                                        </p>
                                      )}
                                    </div>

                                    {/* CD / Ataque hechizo (del personaje) */}
                                    {(calcDC !== null || calcAttack !== null) && (
                                      <div className="flex items-center gap-3">
                                        {calcDC !== null && (
                                          <div className="text-center">
                                            <p className="text-[9px] text-stone-500 uppercase tracking-wide">CD salvación</p>
                                            <p className="text-sm font-bold text-amber-400">{calcDC}</p>
                                          </div>
                                        )}
                                        {calcAttack !== null && (
                                          <div className="text-center">
                                            <p className="text-[9px] text-stone-500 uppercase tracking-wide">Ataque hechizo</p>
                                            <p className="text-sm font-bold text-amber-400">
                                              {calcAttack >= 0 ? `+${calcAttack}` : calcAttack}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Descripción */}
                                    {detail.description && (
                                      <p className="text-xs text-stone-300 leading-relaxed">
                                        {detail.description}
                                      </p>
                                    )}

                                    {/* Ranura superior / Mejora de truco */}
                                    {detail.higherLevels && (
                                      <div className="border-t border-stone-700 pt-2">
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">
                                          {detail.level === 0 ? "Mejora de Truco" : "En ranuras superiores"}
                                        </p>
                                        <p className="text-xs text-stone-400 leading-relaxed">{detail.higherLevels}</p>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Modal — Añadir hechizo */}
            {spellModalOpen && (() => {
              const modalSpells = getSpellsForModal();
              return (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
                  <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">

                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-800 shrink-0">
                      <h3 className="text-sm font-bold text-amber-400 flex-1">
                        Añadir hechizo — {spellModalLevel === 0 ? "Truco" : `Nivel ${spellModalLevel}`}
                      </h3>
                      <button
                        onClick={() => setSpellModalOpen(false)}
                        className="text-stone-400 hover:text-stone-200 text-lg leading-none"
                        aria-label="Cerrar"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Filtros */}
                    <div className="px-4 pt-3 pb-2 border-b border-stone-800 space-y-2 shrink-0">
                      <select
                        value={spellModalClass}
                        onChange={e => setSpellModalClass(e.target.value)}
                        aria-label="Filtrar por clase"
                        className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                      >
                        <option value="">— Todas las clases —</option>
                        {Object.keys(SPELL_LISTS_BY_CLASS).map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={spellSearch}
                        onChange={e => setSpellSearch(e.target.value)}
                        placeholder="Buscar hechizo..."
                        autoFocus
                        aria-label="Buscar hechizo"
                        className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs focus:outline-none focus:border-amber-500 placeholder-stone-600"
                      />
                    </div>

                    {/* Pestañas de nivel */}
                    <div className="flex gap-1 px-4 pt-2 pb-1 border-b border-stone-800 overflow-x-auto shrink-0">
                      {[0,1,2,3,4,5,6,7,8,9].map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => setSpellModalLevel(lvl)}
                          className={`text-xs px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                            spellModalLevel === lvl
                              ? "bg-amber-600 text-white"
                              : "text-stone-400 hover:text-stone-200"
                          }`}
                        >
                          {lvl === 0 ? "Trucos" : `Nv.${lvl}`}
                        </button>
                      ))}
                    </div>

                    {/* Lista de hechizos */}
                    <div className="overflow-y-auto flex-1 px-4 py-2 space-y-1">
                      {modalSpells.length === 0 ? (
                        <p className="text-xs text-stone-600 italic py-4 text-center">
                          {spellSearch ? "No hay hechizos que coincidan." : "No hay hechizos en esta lista."}
                        </p>
                      ) : (
                        modalSpells.map(entry => {
                          const alreadyAdded = spells.some(s => s.name === entry.name && s.level === spellModalLevel);
                          return (
                            <button
                              key={entry.name}
                              onClick={() => { addSpell(entry, spellModalLevel); }}
                              disabled={alreadyAdded}
                              className={`w-full flex items-center gap-2 text-left rounded px-2.5 py-1.5 transition-colors text-sm ${
                                alreadyAdded
                                  ? "text-stone-600 cursor-default"
                                  : "bg-stone-800 hover:bg-stone-700 text-stone-200"
                              }`}
                            >
                              <span className="flex-1">{entry.name}</span>
                              {entry.concentration && (
                                <span className="text-[10px] font-bold text-blue-400" title="Concentración">C</span>
                              )}
                              {entry.ritual && (
                                <span className="text-[10px] font-bold text-green-400" title="Ritual">R</span>
                              )}
                              {alreadyAdded && (
                                <span className="text-[10px] text-stone-600">✓</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                  </div>
                </div>
              );
            })()}

          </div>
  );
}
