"use client";

import {
  abilityModifier,
  proficiencyBonus,
  totalLevel,
  finalAbilityScore,
  expertiseSlotsFromClasses,
  expertiseSlotsFromFeats,
  skillProficiencySlots,
  type PlayerClassEntry,
  type FeatEntry,
} from "../../../lib/player-calcs";
import {
  CLASS_SKILLS_OPTIONS,
} from "../../../lib/dnd-2024-data";
import { ABILITIES, SKILLS, type CharacterFormProps } from "./player-types";
import { SectionTitle } from "./player-ui";

interface SkillsTabProps extends CharacterFormProps {
  classes: PlayerClassEntry[];
  feats: FeatEntry[];
  bgSkills: string[];
  speciesSkills: string[];
  species: string;
}

export function SkillsTab({ form, set, classes, feats, bgSkills, speciesSkills, species }: SkillsTabProps) {
  function parseJson<T>(v: string, fallback: T): T {
    try { return JSON.parse(v); } catch { return fallback; }
  }

  const level = totalLevel(classes) || 1;
  const pb = proficiencyBonus(level);

  const finalStr = finalAbilityScore(form.strength     ?? 10, "strength",     feats);
  const finalDex = finalAbilityScore(form.dexterity    ?? 10, "dexterity",    feats);
  const finalCon = finalAbilityScore(form.constitution ?? 10, "constitution", feats);
  const finalInt = finalAbilityScore(form.intelligence ?? 10, "intelligence", feats);
  const finalWis = finalAbilityScore(form.wisdom       ?? 10, "wisdom",       feats);
  const finalCha = finalAbilityScore(form.charisma     ?? 10, "charisma",     feats);

  const finalScoreMap: Record<string, number> = {
    strength: finalStr, dexterity: finalDex, constitution: finalCon,
    intelligence: finalInt, wisdom: finalWis, charisma: finalCha,
  };

  const skillProfs: string[] = parseJson(form.skillProficiencies ?? "[]", []);
  const skillExpert: string[] = parseJson(form.skillExpertise ?? "[]", []);
  const expertiseSlots = expertiseSlotsFromClasses(classes) + expertiseSlotsFromFeats(feats);

  const totalSkillSlots = skillProficiencySlots(classes, feats, species);
  const lockedSkills = new Set([...bgSkills, ...speciesSkills]);
  const usedSkillSlots = skillProfs.filter(s => !lockedSkills.has(s)).length;
  const remainingSlots = totalSkillSlots - usedSkillSlots;

  const classSkillOptions = new Set<string>(
    classes.flatMap(c => CLASS_SKILLS_OPTIONS[c.class] ?? [])
  );

  return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <SectionTitle>Habilidades</SectionTitle>
              <span className="text-xs text-stone-500">Bono prof. +{pb}</span>
            </div>
            {totalSkillSlots > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className={remainingSlots < 0 ? "text-red-400 font-medium" : remainingSlots > 0 ? "text-amber-400" : "text-emerald-400"}>
                  Competencias: {usedSkillSlots}/{totalSkillSlots}
                  {remainingSlots > 0 && ` · ${remainingSlots} disponible${remainingSlots > 1 ? "s" : ""}`}
                  {remainingSlots < 0 && ` · ${Math.abs(remainingSlots)} de más`}
                </span>
                {expertiseSlots > 0 && (
                  <span className="text-stone-500">
                    Maestría: {skillExpert.length}/{expertiseSlots}
                  </span>
                )}
              </div>
            )}
            <div className="space-y-1">
              {SKILLS.map(s => {
                const fromBg      = bgSkills.includes(s.key);
                const fromSpecies = speciesSkills.includes(s.key);
                const isLocked    = fromBg || fromSpecies;
                const hasPro      = isLocked || skillProfs.includes(s.key);
                const isManualPro = !isLocked && skillProfs.includes(s.key);
                const canAddPro   = isManualPro || isLocked || remainingSlots > 0;
                const hasExp      = skillExpert.includes(s.key);
                const usedSlots   = skillExpert.length;
                const canAddExp   = hasPro && (hasExp || usedSlots < expertiseSlots);

                const abilScore = finalScoreMap[s.ability] ?? 10;
                const abilMod   = abilityModifier(abilScore);
                const bonus     = hasExp ? pb * 2 : hasPro ? pb : 0;
                const total     = abilMod + bonus;
                const foundAbil = ABILITIES.find(a => a.key === s.ability);

                const proAccent = fromBg      ? "accent-amber-500"
                                : fromSpecies ? "accent-emerald-500"
                                : hasPro      ? "accent-sky-400"
                                : "accent-stone-500";

                const rowBg = hasExp  ? "bg-amber-950/40 border border-amber-800/50"
                            : hasPro  ? "bg-stone-800/60"
                            : "hover:bg-stone-800/40";

                const nameColor = hasExp  ? "text-amber-300 font-medium"
                                : hasPro  ? "text-stone-200"
                                : "text-stone-400";

                const bonusColor = hasExp ? "text-amber-300" : hasPro ? "text-amber-400" : "text-stone-500";

                return (
                  <div key={s.key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${rowBg}`}>
                    {/* Checkbox de competencia */}
                    <input
                      type="checkbox"
                      checked={hasPro}
                      disabled={isLocked || (!hasPro && !canAddPro)}
                      onChange={e => {
                        if (e.target.checked) {
                          set("skillProficiencies", JSON.stringify([...skillProfs, s.key]));
                        } else {
                          set("skillProficiencies", JSON.stringify(skillProfs.filter(k => k !== s.key)));
                          set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== s.key)));
                        }
                      }}
                      className={`${proAccent} disabled:opacity-70 cursor-pointer disabled:cursor-default`}
                      title={fromBg ? "Trasfondo" : fromSpecies ? "Especie" : !hasPro && !canAddPro ? `Sin slots disponibles (${usedSkillSlots}/${totalSkillSlots})` : "Competencia"}
                    />

                    {/* Checkbox de maestría — siempre visible, deshabilitado si no corresponde */}
                    <input
                      type="checkbox"
                      checked={hasExp}
                      disabled={!canAddExp}
                      onChange={e => {
                        if (e.target.checked) {
                          set("skillExpertise", JSON.stringify([...skillExpert, s.key]));
                          if (!hasPro) set("skillProficiencies", JSON.stringify([...skillProfs, s.key]));
                        } else {
                          set("skillExpertise", JSON.stringify(skillExpert.filter(k => k !== s.key)));
                        }
                      }}
                      className="accent-amber-400 disabled:opacity-20 cursor-pointer disabled:cursor-default"
                      title={
                        !hasPro             ? "Requiere competencia en esta habilidad primero"
                        : expertiseSlots === 0  ? "Requiere Pícaro nv.1, Bardo nv.3 o dote Skill Expert"
                        : !hasExp && usedSlots >= expertiseSlots ? `Sin slots disponibles (${usedSlots}/${expertiseSlots} usados)`
                        : "Maestría (bonif. competencia × 2)"
                      }
                    />

                    {/* Nombre de la habilidad */}
                    <span className={`text-sm flex-1 ${nameColor}`}>{s.label}</span>

                    {/* Badges de origen */}
                    <div className="flex items-center gap-1">
                      {fromBg && (
                        <span className="text-[10px] font-bold bg-amber-900/60 text-amber-300 px-1 rounded" title="Trasfondo">T</span>
                      )}
                      {fromSpecies && (
                        <span className="text-[10px] font-bold bg-emerald-900/60 text-emerald-300 px-1 rounded" title="Especie">E</span>
                      )}
                      {classSkillOptions.has(s.key) && (
                        <span className="text-[10px] font-bold bg-sky-900/60 text-sky-300 px-1 rounded" title="Opción de clase">C</span>
                      )}
                    </div>

                    <span className="text-xs text-stone-600 w-7 text-right">{foundAbil?.label}</span>
                    <span className={`text-sm font-mono font-bold w-8 text-right ${bonusColor}`}>
                      {total >= 0 ? `+${total}` : total}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-stone-600 pt-1 border-t border-stone-800">
              <span><span className="text-amber-300 font-bold">T</span> = trasfondo</span>
              <span><span className="text-emerald-300 font-bold">E</span> = especie</span>
              <span><span className="text-sky-300 font-bold">C</span> = opción de clase</span>
              {expertiseSlots > 0 && <span>★ = maestría ({skillExpert.length}/{expertiseSlots})</span>}
            </div>
          </div>
  );
}
