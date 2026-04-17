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
  const key = [typeA, typeB].sort().join("-") as EntityRelationKind;
  return key in RELATION_TYPES ? key : null;
}
