import type { StatBlockEntry } from "./api";

/**
 * Parses a stat-block entries field (traits/actions/bonusActions/reactions),
 * which may arrive as an already-parsed array or as a JSON-encoded string
 * (e.g. from a raw DB row). Returns [] for empty/invalid input.
 */
export function parseStatBlockEntries(
  raw: StatBlockEntry[] | string | null | undefined
): StatBlockEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw) as StatBlockEntry[];
  } catch {
    return [];
  }
}

export function crToNumber(cr: string): number {
  if (cr === "1/8") return 0.125;
  if (cr === "1/4") return 0.25;
  if (cr === "1/2") return 0.5;
  return parseFloat(cr) || 0;
}

export function formatCR(cr: string, xp: number): string {
  return `${cr} (${xp.toLocaleString("es-ES")} XP)`;
}

/**
 * Parses an XP string like "22,000 XP", "1,800" or "700 XP" into a number.
 * Strips thousands separators and the " XP" suffix; returns 0 if no digits.
 */
export function xpToNumber(xp: string): number {
  const digits = xp.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
