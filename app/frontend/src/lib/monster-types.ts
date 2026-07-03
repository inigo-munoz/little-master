export function crToNumber(cr: string): number {
  if (cr === "1/8") return 0.125;
  if (cr === "1/4") return 0.25;
  if (cr === "1/2") return 0.5;
  return parseFloat(cr) || 0;
}

export function formatCR(cr: string, xp: number): string {
  return `${cr} (${xp.toLocaleString("es-ES")} XP)`;
}
