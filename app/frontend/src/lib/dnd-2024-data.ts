/**
 * Datos oficiales del Player's Handbook D&D 2024.
 * Fuente de verdad para todos los desplegables de la ficha de personaje.
 */

export const DND_CLASSES: Record<string, string[]> = {
  "Bárbaro":    ["Senda del Berserker", "Senda del Corazón Salvaje", "Senda del Árbol del Mundo", "Senda del Zelote"],
  "Bardo":      ["Colegio de la Danza", "Colegio del Glamour", "Colegio del Saber", "Colegio del Valor"],
  "Clérigo":    ["Dominio de la Vida", "Dominio de la Luz", "Dominio del Engaño", "Dominio de la Guerra"],
  "Druida":     ["Círculo de la Tierra", "Círculo de la Luna", "Círculo del Mar", "Círculo de las Estrellas"],
  "Guerrero":   ["Maestro de Batalla", "Campeón", "Caballero Arcano", "Guerrero Psíquico"],
  "Monje":      ["Guerrero de las Cuatro Estaciones", "Guerrero de la Mano Abierta", "Guerrero de las Sombras", "Guerrero de los Elementos"],
  "Paladín":    ["Juramento de Devoción", "Juramento de Gloria", "Juramento de los Ancestros", "Juramento de la Venganza"],
  "Explorador": ["Bestia de Compañía", "Cazador", "Viajante del Feérico", "Acechador de la Oscuridad"],
  "Pícaro":     ["Asesino", "Ladrón", "Embaucador Arcano", "Maestro del Alma"],
  "Hechicero":  ["Origen Aberrante", "Origen Dracónico", "Origen del Reloj Cósmico", "Magia Salvaje"],
  "Brujo":      ["El Archifae", "El Gran Antiguo", "El Celestial", "El Señor Infernal"],
  "Mago":       ["Escuela de Adivinación", "Escuela de Evocación", "Escuela de Ilusión", "Escuela de Transmutación"],
};

export const DND_SPECIES = [
  "Aasimar", "Dracónido", "Enano", "Elfo", "Gnomo",
  "Goliath", "Mediano", "Humano", "Orco", "Tiefling",
] as const;

/** Linajes / variantes para las especies que los tienen en el PHB 2024. */
export const DND_SPECIES_VARIANTS: Record<string, string[]> = {
  "Dracónido": [
    "Negro (ácido)", "Azul (rayo)", "Bronce (rayo)",
    "Cobre (ácido)", "Dorado (fuego)", "Latón (fuego)",
    "Plata (frío)", "Rojo (fuego)", "Blanco (frío)", "Verde (veneno)",
  ],
  "Elfo": [
    "Alto Elfo", "Elfo del Bosque", "Drow",
  ],
  "Gnomo": [
    "Gnomo de las Rocas", "Gnomo del Bosque",
  ],
  "Goliath": [
    "Ascendencia de Nube (Gigante de Nubes)",
    "Ascendencia de Fuego (Gigante de Fuego)",
    "Ascendencia de Escarcha (Gigante de Escarcha)",
    "Ascendencia de Colina (Gigante de Colina)",
    "Ascendencia de Piedra (Gigante de Piedra)",
    "Ascendencia de Tormenta (Gigante de Tormenta)",
  ],
  "Tiefling": [
    "Linaje de Asmodeo", "Linaje de Mefistófeles", "Linaje de Zariel",
  ],
};

export const DND_BACKGROUNDS = [
  "Acólito", "Artesano", "Charlatán", "Comerciante",
  "Criminal", "Erudito", "Ermitaño", "Campesino",
  "Gladiador", "Guardia", "Marinero", "Marginado",
  "Noble", "Peregrino", "Soldado", "Viajero",
] as const;

export const DND_ALIGNMENTS = [
  "Legal Bueno", "Neutral Bueno", "Caótico Bueno",
  "Legal Neutral", "Neutral Verdadero", "Caótico Neutral",
  "Legal Malvado", "Neutral Malvado", "Caótico Malvado",
] as const;

// Dado de golpe por clase (PHB 2024)
export const HIT_DIE_BY_CLASS: Record<string, number> = {
  "Bárbaro":    12,
  "Guerrero":   10,
  "Paladín":    10,
  "Explorador": 10,
  "Bardo":       8,
  "Clérigo":     8,
  "Druida":      8,
  "Monje":       8,
  "Pícaro":      8,
  "Brujo":       8,
  "Hechicero":   6,
  "Mago":        6,
};

// Característica de conjuración por clase (PHB 2024)
// null = clase sin magia (Bárbaro, Guerrero base, Pícaro base)
export const SPELLCASTING_ABILITY_BY_CLASS: Record<string, "wisdom" | "intelligence" | "charisma" | null> = {
  "Bárbaro":    null,
  "Bardo":      "charisma",
  "Clérigo":    "wisdom",
  "Druida":     "wisdom",
  "Guerrero":   null,
  "Monje":      "wisdom",
  "Paladín":    "charisma",
  "Explorador": "wisdom",
  "Pícaro":     null,
  "Hechicero":  "charisma",
  "Brujo":      "charisma",
  "Mago":       "intelligence",
};

// Armaduras PHB 2024
export const ARMOR_LIST = {
  none:               { label: "Sin armadura (10 + DES)",                     baseAC: 10, type: "none",    desMax: null as number | null },
  leather:            { label: "Cuero (CA 11 + DES)",                          baseAC: 11, type: "light",   desMax: null as number | null },
  studdedLeather:     { label: "Cuero tachonado (CA 12 + DES)",                baseAC: 12, type: "light",   desMax: null as number | null },
  hide:               { label: "Pieles (CA 12 + DES máx.+2)",                  baseAC: 12, type: "medium",  desMax: 2 as number | null },
  chainShirt:         { label: "Cota de mallas ligera (CA 13 + DES máx.+2)",   baseAC: 13, type: "medium",  desMax: 2 as number | null },
  scaleMail:          { label: "Cota de escamas (CA 14 + DES máx.+2)",         baseAC: 14, type: "medium",  desMax: 2 as number | null },
  breastplate:        { label: "Coraza (CA 14 + DES máx.+2)",                  baseAC: 14, type: "medium",  desMax: 2 as number | null },
  halfPlate:          { label: "Medio arnés (CA 15 + DES máx.+2)",             baseAC: 15, type: "medium",  desMax: 2 as number | null },
  ringMail:           { label: "Cota de anillas (CA 14)",                       baseAC: 14, type: "heavy",   desMax: 0 as number | null },
  chainMail:          { label: "Cota de mallas (CA 16)",                        baseAC: 16, type: "heavy",   desMax: 0 as number | null },
  splint:             { label: "Armadura de bandas (CA 17)",                    baseAC: 17, type: "heavy",   desMax: 0 as number | null },
  plate:              { label: "Armadura de placas (CA 18)",                    baseAC: 18, type: "heavy",   desMax: 0 as number | null },
  unarmoredBarbarian: { label: "Defensa sin armadura — Bárbaro (10+DES+CON)",  baseAC: 10, type: "special", desMax: null as number | null },
  unarmoredMonk:      { label: "Defensa sin armadura — Monje (10+DES+SAB)",    baseAC: 10, type: "special", desMax: null as number | null },
} as const;

export type ArmorKey = keyof typeof ARMOR_LIST;

// Niveles con ASI/dote por clase (PHB 2024)
export const ASI_LEVELS_BY_CLASS: Record<string, number[]> = {
  "Guerrero": [4, 6, 8, 12, 14, 16, 19],
  "Pícaro":   [4, 8, 10, 12, 16, 19],
};
const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19];

export function asiLevelsForClass(className: string): number[] {
  return ASI_LEVELS_BY_CLASS[className] ?? DEFAULT_ASI_LEVELS;
}

// Velocidad base por especie (PHB 2024)
export const BASE_SPEED_BY_SPECIES: Record<string, number> = {
  "Aasimar":   30,
  "Dracónido": 30,
  "Enano":     25,
  "Elfo":      30,
  "Gnomo":     25,
  "Goliath":   35,
  "Mediano":   25,
  "Humano":    30,
  "Orco":      30,
  "Tiefling":  30,
};

export const DEFAULT_SPEED = 30;

export function baseSpeedForSpecies(species: string): number {
  return BASE_SPEED_BY_SPECIES[species] ?? DEFAULT_SPEED;
}

// Dotes que modifican la iniciativa (nombre en inglés → bonus)
export const INITIATIVE_BONUS_BY_FEAT: Record<string, number> = {
  "Alert": 5,
};

// Dotes que modifican la velocidad (nombre en inglés → bonus en ft)
export const SPEED_BONUS_BY_FEAT: Record<string, number> = {
  "Mobile": 10,
};
