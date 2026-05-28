"use client";

import React from "react";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 border-b border-stone-800 pb-1">
      {children}
    </h2>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-stone-500 mb-0.5">{label}</label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, type = "text", placeholder = "" }: {
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
    />
  );
}

export function Select({ value, onChange, options, placeholder, disabled }: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: readonly string[] | string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <option value="">{placeholder ?? "—"}</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

export function NumberInput({ value, onChange, min, max }: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      onChange={e => onChange(e.target.value === "" ? null : parseInt(e.target.value))}
      className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-sm focus:outline-none focus:border-amber-500 text-center"
    />
  );
}
