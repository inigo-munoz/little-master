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
