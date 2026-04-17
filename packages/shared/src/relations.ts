export const RELATION_TYPES = {
  "faction-faction": [
    "aliada", "enemiga", "rival", "subordinada a",
    "controla", "alianza temporal", "infiltrada por",
  ],
  "faction-location": [
    "controla", "base de operaciones", "territorio reclamado",
    "protege", "presencia oculta", "busca acceso",
  ],
  "location-location": [
    "frontera con", "acceso a través de", "controla", "rival de",
  ],
  "npc-faction": [
    "miembro", "líder", "agente", "simpatizante",
    "enemigo", "renegado", "protegido", "patrocinado",
  ],
  "npc-location": [
    "residente", "propietario", "guardián",
    "visitante frecuente", "nacido en", "controla", "exiliado de",
  ],
  "npc-npc": [
    "aliado", "enemigo", "rival", "mentor", "aprendiz",
    "familiar", "subordinado", "superior", "patrón", "asociado",
  ],
} as const;

export type EntityRelationKind = keyof typeof RELATION_TYPES;

export function getRelationPairKey(
  typeA: string,
  typeB: string
): EntityRelationKind | null {
  const direct = `${typeA}-${typeB}` as EntityRelationKind;
  if (direct in RELATION_TYPES) return direct;
  const reversed = `${typeB}-${typeA}` as EntityRelationKind;
  if (reversed in RELATION_TYPES) return reversed;
  return null;
}
