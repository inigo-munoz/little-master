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
