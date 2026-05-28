"use client";

import { type CharacterFormProps } from "./player-types";
import { SectionTitle, Field, Input } from "./player-ui";

export function BackstoryTab({ form, set }: CharacterFormProps) {
  return (
          <div className="space-y-6">
            <SectionTitle>Personalidad</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Rasgos de personalidad">
                <textarea value={form.traits ?? ""} onChange={e => set("traits", e.target.value)} rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </Field>
              <Field label="Ideales">
                <textarea value={form.ideals ?? ""} onChange={e => set("ideals", e.target.value)} rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </Field>
              <Field label="Vínculos">
                <textarea value={form.bonds ?? ""} onChange={e => set("bonds", e.target.value)} rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </Field>
              <Field label="Defectos">
                <textarea value={form.flaws ?? ""} onChange={e => set("flaws", e.target.value)} rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </Field>
            </div>

            <SectionTitle>Historia</SectionTitle>
            <textarea value={form.backstory ?? ""} onChange={e => set("backstory", e.target.value)} rows={8}
              placeholder="Historia del personaje..."
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />

            <SectionTitle>Apariencia</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              {([ ["age","Edad"],["height","Altura"],["weight","Peso"],["eyes","Ojos"],["skin","Piel"],["hair","Cabello"] ] as [string,string][]).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input value={form[k] as string | undefined} onChange={v => set(k, v)} />
                </Field>
              ))}
            </div>
            <Field label="Descripción física">
              <textarea value={form.appearance ?? ""} onChange={e => set("appearance", e.target.value)} rows={4}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
            </Field>

            <SectionTitle>Notas adicionales</SectionTitle>
            <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} rows={4}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>
  );
}
