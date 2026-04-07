const SESSION_HEADINGS = /^##\s+(Session Overview|Resumen de sesión|Overview)\s*$/im;

export function parseSessionSummaryFromResponse(
  content: string
): { title: string; summary: string } | null {
  if (content.length < 200) return null;

  const headingMatch = content.match(SESSION_HEADINGS);
  if (!headingMatch) return null;

  // Extraemos el título: primera línea no vacía después del heading
  const afterHeading = content.slice(headingMatch.index! + headingMatch[0].length);
  const lines = afterHeading.split("\n");
  const titleLine = lines.find((l) => l.trim().length > 0)?.trim() ?? "Resumen de sesión";

  // Eliminamos prefijos markdown del título si los tiene
  const title = titleLine.replace(/^#+\s*/, "").replace(/^\*\*/, "").replace(/\*\*$/, "").trim();

  return { title, summary: content.trim() };
}
