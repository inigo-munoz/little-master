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

// Armas PHB 2024
export type WeaponAbility = "strength" | "dexterity" | "finesse";
export type WeaponCategory = "simple-melee" | "simple-ranged" | "martial-melee" | "martial-ranged";
export interface WeaponData {
  label: string;
  damageDice: string;
  damageType: "cortante" | "perforante" | "contundente" | "—";
  ability: WeaponAbility;
  category: WeaponCategory;
  mastery?: string;
  properties?: string;
}

// Maestrías de arma (PHB 2024)
export const WEAPON_MASTERIES: Record<string, { name: string; description: string }> = {
  cleave:  { name: "Cortar",      description: "Si impactas con esta arma, puedes realizar un ataque adicional contra otra criatura dentro de tu alcance con la misma arma. El daño es igual al dado del arma sin modificadores." },
  graze:   { name: "Rozar",       description: "Si fallas la tirada de ataque, el objetivo recibe daño igual a tu modificador de característica (mínimo 0) del tipo de daño del arma." },
  nick:    { name: "Rápido",      description: "Si usas esta arma en combate con dos armas, el ataque adicional de la propiedad Ligera no requiere Acción Adicional." },
  push:    { name: "Empujar",     description: "Si impactas con esta arma, puedes empujar al objetivo hasta 3 m (10 ft) en línea recta alejándose de ti." },
  sap:     { name: "Debilitar",   description: "Si impactas con esta arma, el objetivo tiene Desventaja en su próxima tirada de ataque antes del inicio de tu siguiente turno." },
  slow:    { name: "Ralentizar",  description: "Si impactas con esta arma, la velocidad del objetivo se reduce 3 m (10 ft) hasta el inicio de tu siguiente turno." },
  topple:  { name: "Derribar",    description: "Si impactas con esta arma, el objetivo debe superar una salvación de Constitución (CD = 8 + bonif. competencia + mod. característica) o quedar Derribado." },
  vex:     { name: "Hostigar",    description: "Si impactas con esta arma, tienes Ventaja en tu próxima tirada de ataque contra ese mismo objetivo antes de que finalice tu siguiente turno." },
};

export const WEAPON_LIST: Record<string, WeaponData> = {
  // Armas simples cuerpo a cuerpo
  "club":          { label: "Garrote",              damageDice: "1d4",  damageType: "contundente", ability: "strength",  category: "simple-melee",   mastery: "slow",   properties: "Ligera" },
  "dagger":        { label: "Daga",                 damageDice: "1d4",  damageType: "perforante",  ability: "finesse",   category: "simple-melee",   mastery: "nick",   properties: "Ligera, Arrojadiza 20/60" },
  "greatclub":     { label: "Gran garrote",          damageDice: "1d8",  damageType: "contundente", ability: "strength",  category: "simple-melee",   mastery: "push",   properties: "A dos manos" },
  "handaxe":       { label: "Hacha de mano",         damageDice: "1d6",  damageType: "cortante",    ability: "strength",  category: "simple-melee",   mastery: "vex",    properties: "Ligera, Arrojadiza 20/60" },
  "javelin":       { label: "Jabalina",              damageDice: "1d6",  damageType: "perforante",  ability: "strength",  category: "simple-melee",   mastery: "slow",   properties: "Arrojadiza 30/120" },
  "lightHammer":   { label: "Martillo ligero",       damageDice: "1d4",  damageType: "contundente", ability: "strength",  category: "simple-melee",   mastery: "nick",   properties: "Ligera, Arrojadiza 20/60" },
  "mace":          { label: "Maza",                  damageDice: "1d6",  damageType: "contundente", ability: "strength",  category: "simple-melee",   mastery: "sap" },
  "quarterstaff":  { label: "Bastón",                damageDice: "1d6",  damageType: "contundente", ability: "strength",  category: "simple-melee",   mastery: "topple", properties: "Versátil (1d8)" },
  "sickle":        { label: "Hoz",                   damageDice: "1d4",  damageType: "cortante",    ability: "strength",  category: "simple-melee",   mastery: "nick",   properties: "Ligera" },
  "spear":         { label: "Lanza",                 damageDice: "1d6",  damageType: "perforante",  ability: "strength",  category: "simple-melee",   mastery: "slow",   properties: "Arrojadiza 20/60, Versátil (1d8)" },
  "unarmed":       { label: "Golpe desarmado",       damageDice: "1",    damageType: "contundente", ability: "strength",  category: "simple-melee" },
  // Armas simples a distancia
  "dart":          { label: "Dardo",                 damageDice: "1d4",  damageType: "perforante",  ability: "finesse",   category: "simple-ranged",  mastery: "vex",    properties: "Arrojadiza 20/60" },
  "lightCrossbow": { label: "Ballesta ligera",        damageDice: "1d8",  damageType: "perforante",  ability: "dexterity", category: "simple-ranged",  mastery: "slow",   properties: "Carga, A dos manos 80/320" },
  "shortbow":      { label: "Arco corto",             damageDice: "1d6",  damageType: "perforante",  ability: "dexterity", category: "simple-ranged",  mastery: "vex",    properties: "A dos manos 80/320" },
  "sling":         { label: "Honda",                  damageDice: "1d4",  damageType: "contundente", ability: "dexterity", category: "simple-ranged",  mastery: "slow",   properties: "30/120" },
  // Armas marciales cuerpo a cuerpo
  "battleaxe":     { label: "Hacha de batalla",       damageDice: "1d8",  damageType: "cortante",    ability: "strength",  category: "martial-melee",  mastery: "topple", properties: "Versátil (1d10)" },
  "flail":         { label: "Mangual",                 damageDice: "1d8",  damageType: "contundente", ability: "strength",  category: "martial-melee",  mastery: "sap" },
  "glaive":        { label: "Guja",                   damageDice: "1d10", damageType: "cortante",    ability: "strength",  category: "martial-melee",  mastery: "cleave", properties: "Pesada, Alcance, A dos manos" },
  "greataxe":      { label: "Hacha grande",            damageDice: "1d12", damageType: "cortante",    ability: "strength",  category: "martial-melee",  mastery: "cleave", properties: "Pesada, A dos manos" },
  "greatsword":    { label: "Espadón",                damageDice: "2d6",  damageType: "cortante",    ability: "strength",  category: "martial-melee",  mastery: "graze",  properties: "Pesada, A dos manos" },
  "halberd":       { label: "Alabarda",               damageDice: "1d10", damageType: "cortante",    ability: "strength",  category: "martial-melee",  mastery: "cleave", properties: "Pesada, Alcance, A dos manos" },
  "lance":         { label: "Lanza de caballería",    damageDice: "2d6",  damageType: "perforante",  ability: "strength",  category: "martial-melee",  mastery: "topple", properties: "Pesada, Alcance" },
  "longsword":     { label: "Espada larga",            damageDice: "1d8",  damageType: "cortante",    ability: "strength",  category: "martial-melee",  mastery: "sap",    properties: "Versátil (1d10)" },
  "maul":          { label: "Mazo de guerra",          damageDice: "2d6",  damageType: "contundente", ability: "strength",  category: "martial-melee",  mastery: "cleave", properties: "Pesada, A dos manos" },
  "morningstar":   { label: "Estrella de la mañana",  damageDice: "1d8",  damageType: "perforante",  ability: "strength",  category: "martial-melee",  mastery: "sap" },
  "pike":          { label: "Pica",                   damageDice: "1d10", damageType: "perforante",  ability: "strength",  category: "martial-melee",  mastery: "push",   properties: "Pesada, Alcance, A dos manos" },
  "rapier":        { label: "Estoque",                damageDice: "1d8",  damageType: "perforante",  ability: "finesse",   category: "martial-melee",  mastery: "vex" },
  "scimitar":      { label: "Cimitarra",              damageDice: "1d6",  damageType: "cortante",    ability: "finesse",   category: "martial-melee",  mastery: "nick",   properties: "Ligera" },
  "shortsword":    { label: "Espada corta",            damageDice: "1d6",  damageType: "perforante",  ability: "finesse",   category: "martial-melee",  mastery: "nick",   properties: "Ligera" },
  "trident":       { label: "Tridente",               damageDice: "1d8",  damageType: "perforante",  ability: "strength",  category: "martial-melee",  mastery: "topple", properties: "Arrojadiza 20/60, Versátil (1d10)" },
  "warPick":       { label: "Pico de guerra",          damageDice: "1d8",  damageType: "perforante",  ability: "strength",  category: "martial-melee",  mastery: "sap" },
  "warhammer":     { label: "Martillo de guerra",      damageDice: "1d8",  damageType: "contundente", ability: "strength",  category: "martial-melee",  mastery: "push",   properties: "Versátil (1d10)" },
  "whip":          { label: "Látigo",                 damageDice: "1d4",  damageType: "cortante",    ability: "finesse",   category: "martial-melee",  mastery: "slow",   properties: "Alcance" },
  // Armas marciales a distancia
  "blowgun":       { label: "Cerbatana",              damageDice: "1",    damageType: "perforante",  ability: "dexterity", category: "martial-ranged", mastery: "vex",    properties: "Carga 25/100" },
  "handCrossbow":  { label: "Ballesta de mano",        damageDice: "1d6",  damageType: "perforante",  ability: "dexterity", category: "martial-ranged", mastery: "vex",    properties: "Ligera, Carga 30/120" },
  "heavyCrossbow": { label: "Ballesta pesada",         damageDice: "1d10", damageType: "perforante",  ability: "dexterity", category: "martial-ranged", mastery: "push",   properties: "Pesada, Carga, A dos manos 100/400" },
  "longbow":       { label: "Arco largo",              damageDice: "1d8",  damageType: "perforante",  ability: "dexterity", category: "martial-ranged", mastery: "vex",    properties: "Pesada, A dos manos 150/600" },
  "net":           { label: "Red",                    damageDice: "—",    damageType: "—",           ability: "strength",  category: "martial-ranged",                    properties: "Especial 5/15" },
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

// Competencias de habilidad fijas por especie (PHB 2024)
// Elfo: "Keen Senses" → Percepción automática
export const FIXED_SKILL_PROFICIENCIES_BY_SPECIES: Partial<Record<string, string[]>> = {
  "Elfo": ["Perception"],
};

// Idiomas estándar y exóticos (PHB 2024)
export const STANDARD_LANGUAGES = [
  "Común", "Enano", "Élfico", "Gigante", "Gnómico", "Goblin", "Halfling", "Orco",
] as const;

export const EXOTIC_LANGUAGES = [
  "Abisal", "Celestial", "Dracónico", "Infernal", "Primordial", "Silvano", "Infracomún",
] as const;

// Idiomas fijos por especie (PHB 2024) — siempre conocidos, no elegibles
export const LANGUAGES_BY_SPECIES: Partial<Record<string, string[]>> = {
  "Aasimar":   ["Común", "Celestial"],
  "Dracónido": ["Común", "Dracónico"],
  "Enano":     ["Común", "Enano"],
  "Elfo":      ["Común", "Élfico"],
  "Gnomo":     ["Común", "Gnómico"],
  "Goliath":   ["Común", "Gigante"],
  "Mediano":   ["Común", "Mediano"],
  "Humano":    ["Común"],
  "Orco":      ["Común", "Orco"],
  "Tiefling":  ["Común", "Infernal"],
};

// Idiomas adicionales a elegir por especie (PHB 2024)
export const EXTRA_LANGUAGES_BY_SPECIES: Partial<Record<string, number>> = {
  "Humano": 1,
};

// Datos completos de trasfondos PHB 2024
export interface BackgroundData {
  feat: string;
  skillProficiencies: string[];  // Claves inglesas, coinciden con el array SKILLS de page.tsx
  toolProficiencies: string;     // Texto libre
  languages: number;             // Número de idiomas adicionales a elegir (PHB 2024: 2 para todos)
}

export const BACKGROUND_DATA: Record<string, BackgroundData> = {
  "Acólito":    { feat: "Magic Initiate",  skillProficiencies: ["Insight", "Religion"],        toolProficiencies: "Útiles de caligrafía",             languages: 2 },
  "Artesano":   { feat: "Crafter",         skillProficiencies: ["History", "Persuasion"],       toolProficiencies: "Útiles de artesano (a elegir)",    languages: 2 },
  "Charlatán":  { feat: "Skilled",         skillProficiencies: ["Deception", "SleightOfHand"],  toolProficiencies: "Kit de falsificación",             languages: 2 },
  "Comerciante":{ feat: "Lucky",           skillProficiencies: ["AnimalHandling", "Persuasion"],toolProficiencies: "Herramientas de navegante",        languages: 2 },
  "Criminal":   { feat: "Alert",           skillProficiencies: ["Deception", "Stealth"],        toolProficiencies: "Herramientas de ladrón",           languages: 2 },
  "Erudito":    { feat: "Magic Initiate",  skillProficiencies: ["Arcana", "History"],           toolProficiencies: "Útiles de caligrafía",             languages: 2 },
  "Ermitaño":   { feat: "Healer",          skillProficiencies: ["Medicine", "Religion"],        toolProficiencies: "Kit de herboristería",             languages: 2 },
  "Campesino":  { feat: "Tough",           skillProficiencies: ["AnimalHandling", "Nature"],    toolProficiencies: "Útiles de carpintero",             languages: 2 },
  "Gladiador":  { feat: "Musician",        skillProficiencies: ["Acrobatics", "Performance"],   toolProficiencies: "Instrumento musical (a elegir)",   languages: 2 },
  "Guardia":    { feat: "Alert",           skillProficiencies: ["Athletics", "Perception"],     toolProficiencies: "Set de juego (a elegir)",          languages: 2 },
  "Marinero":   { feat: "Tavern Brawler",  skillProficiencies: ["Acrobatics", "Perception"],    toolProficiencies: "Herramientas de navegante",        languages: 2 },
  "Marginado":  { feat: "Lucky",           skillProficiencies: ["Insight", "Stealth"],          toolProficiencies: "Herramientas de ladrón",           languages: 2 },
  "Noble":      { feat: "Skilled",         skillProficiencies: ["History", "Persuasion"],       toolProficiencies: "Set de juego (a elegir)",          languages: 2 },
  "Peregrino":  { feat: "Magic Initiate",  skillProficiencies: ["Stealth", "Survival"],         toolProficiencies: "Herramientas de cartógrafo",       languages: 2 },
  "Soldado":    { feat: "Savage Attacker", skillProficiencies: ["Athletics", "Intimidation"],   toolProficiencies: "Set de juego (a elegir)",          languages: 2 },
  "Viajero":    { feat: "Skilled",         skillProficiencies: ["Investigation", "Perception"],  toolProficiencies: "Útiles de caligrafía",            languages: 2 },
};

// Habilidades disponibles por clase (PHB 2024) — el jugador elige N de la lista
export const CLASS_SKILLS_OPTIONS: Record<string, string[]> = {
  "Bárbaro":    ["AnimalHandling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"],
  "Bardo":      ["Acrobatics", "AnimalHandling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "SleightOfHand", "Stealth", "Survival"],
  "Clérigo":    ["History", "Insight", "Medicine", "Persuasion", "Religion"],
  "Druida":     ["Arcana", "AnimalHandling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"],
  "Guerrero":   ["Acrobatics", "AnimalHandling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Persuasion", "Survival"],
  "Monje":      ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"],
  "Paladín":    ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"],
  "Explorador": ["AnimalHandling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"],
  "Pícaro":     ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Persuasion", "SleightOfHand", "Stealth"],
  "Hechicero":  ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"],
  "Brujo":      ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"],
  "Mago":       ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"],
};

// Cantidad de habilidades que otorga cada clase en nivel 1 (PHB 2024)
export const CLASS_SKILL_SLOTS: Record<string, number> = {
  "Bárbaro": 2, "Bardo": 3, "Clérigo": 2, "Druida": 2,
  "Guerrero": 2, "Monje": 2, "Paladín": 2, "Explorador": 3,
  "Pícaro": 4, "Hechicero": 2, "Brujo": 2, "Mago": 2,
};

// Habilidades otorgadas al multiclasear HACIA una clase (PHB 2024)
export const MULTICLASS_SKILL_SLOTS: Record<string, number> = {
  "Bardo": 1, "Explorador": 1, "Pícaro": 1,
};

// Slots de habilidad por elección de especie (PHB 2024)
export const SPECIES_SKILL_CHOICE_SLOTS: Record<string, number> = {
  "Humano": 1,
};

// Dotes de Origen (PHB 2024) — disponibles a nivel 1 y en slots ASI
export const ORIGIN_FEATS = [
  "Alert", "Crafter", "Healer", "Lucky", "Magic Initiate",
  "Musician", "Savage Attacker", "Skilled", "Tavern Brawler", "Tough",
] as const;

// Dotes Generales (PHB 2024) — requieren nivel 4+
export const GENERAL_FEATS = [
  "Actor", "Athlete", "Charger", "Crossbow Expert", "Crusher",
  "Defensive Duelist", "Dual Wielder", "Dungeon Delver", "Durable",
  "Elemental Adept", "Fey-Touched", "Grappler", "Great Weapon Master",
  "Heavily Armored", "Heavy Armor Master", "Inspiring Leader", "Keen Mind",
  "Lightly Armored", "Mage Slayer", "Martial Weapon Training",
  "Medium Armor Master", "Mobile", "Moderately Armored", "Mounted Combatant",
  "Observant", "Piercer", "Poisoner", "Polearm Master", "Resilient",
  "Ritual Caster", "Sentinel", "Shadow-Touched", "Sharpshooter", "Shield Master",
  "Skill Expert", "Skulker", "Slasher", "Speedy", "Spell Sniper", "Telekinetic", "Telepathic",
  "War Caster", "Weapon Master",
] as const;

// Dotes de Estilo de Combate (PHB 2024)
export const FIGHTING_STYLE_FEATS = [
  "Archery", "Blind Fighting", "Defense", "Dueling",
  "Great Weapon Fighting", "Interception", "Protection",
  "Thrown Weapon Fighting", "Two-Weapon Fighting", "Unarmed Fighting",
] as const;

// Bendiciones Épicas (PHB 2024) — nivel 19+
export const EPIC_BOON_FEATS = [
  "Epic Boon of Combat Prowess", "Epic Boon of Dimensional Travel",
  "Epic Boon of Energy Resistance", "Epic Boon of Fate",
  "Epic Boon of Fortitude", "Epic Boon of Irresistible Offense",
  "Epic Boon of Recovery", "Epic Boon of Skill Proficiency",
  "Epic Boon of Speed", "Epic Boon of Spell Recall",
  "Epic Boon of the Night Spirit", "Epic Boon of Truesight",
] as const;

// Todas las dotes del PHB 2024 combinadas
export const ALL_FEATS = [
  ...ORIGIN_FEATS, ...GENERAL_FEATS, ...FIGHTING_STYLE_FEATS, ...EPIC_BOON_FEATS,
] as const;

// Especies que conceden una Dote de Origen a nivel 1 (PHB 2024 — "Versátil")
export const SPECIES_WITH_ORIGIN_FEAT = new Set<string>(["Humano"]);

// Tiradas de salvación por clase (PHB 2024)
export const SAVING_THROWS_BY_CLASS: Record<string, string[]> = {
  "Bárbaro":    ["strength", "constitution"],
  "Bardo":      ["dexterity", "charisma"],
  "Clérigo":    ["wisdom", "charisma"],
  "Druida":     ["intelligence", "wisdom"],
  "Guerrero":   ["strength", "constitution"],
  "Monje":      ["strength", "dexterity"],
  "Paladín":    ["wisdom", "charisma"],
  "Explorador": ["strength", "dexterity"],
  "Pícaro":     ["dexterity", "intelligence"],
  "Hechicero":  ["constitution", "charisma"],
  "Brujo":      ["wisdom", "charisma"],
  "Mago":       ["intelligence", "wisdom"],
};

// Competencias de armadura por clase (PHB 2024)
export const ARMOR_PROFICIENCIES_BY_CLASS: Record<string, string[]> = {
  "Bárbaro":    ["Armadura ligera", "Armadura media", "Escudos"],
  "Bardo":      ["Armadura ligera"],
  "Clérigo":    ["Armadura ligera", "Armadura media", "Escudos"],
  "Druida":     ["Armadura ligera", "Armadura media", "Escudos (no metálicos)"],
  "Guerrero":   ["Armadura ligera", "Armadura media", "Armadura pesada", "Escudos"],
  "Monje":      [],
  "Paladín":    ["Armadura ligera", "Armadura media", "Armadura pesada", "Escudos"],
  "Explorador": ["Armadura ligera", "Armadura media", "Escudos"],
  "Pícaro":     ["Armadura ligera"],
  "Hechicero":  [],
  "Brujo":      ["Armadura ligera"],
  "Mago":       [],
};

// Competencias de armas por clase (PHB 2024)
export const WEAPON_PROFICIENCIES_BY_CLASS: Record<string, string[]> = {
  "Bárbaro":    ["Armas simples", "Armas marciales"],
  "Bardo":      ["Armas simples", "Espadas cortas", "Espadas largas", "Sables", "Ballestas de mano"],
  "Clérigo":    ["Armas simples"],
  "Druida":     ["Armas simples"],
  "Guerrero":   ["Armas simples", "Armas marciales"],
  "Monje":      ["Armas simples", "Espadas cortas"],
  "Paladín":    ["Armas simples", "Armas marciales"],
  "Explorador": ["Armas simples", "Armas marciales"],
  "Pícaro":     ["Armas simples", "Ballestas de mano", "Espadas cortas", "Estoques"],
  "Hechicero":  ["Dagas", "Dardos", "Hondas", "Bastones", "Ballestas ligeras"],
  "Brujo":      ["Armas simples"],
  "Mago":       ["Dagas", "Dardos", "Hondas", "Bastones", "Ballestas ligeras"],
};

// Competencias adicionales de armas por especie (si aplica)
export const WEAPON_PROFICIENCIES_BY_SPECIES: Partial<Record<string, string[]>> = {
  "Enano": ["Hachas de batalla", "Hachas de mano", "Mazas ligeras", "Mazas de guerra"],
};

// ─── Conjuración: tipos de lanzadores y tablas de espacios (PHB 2024) ─────────

export type SpellListEntry = { name: string; concentration: boolean; ritual: boolean };

export const FULL_CASTER_CLASSES = new Set(["Bardo", "Clérigo", "Druida", "Hechicero", "Mago"]);
export const HALF_CASTER_CLASSES = new Set(["Paladín", "Explorador"]);
export const PACT_MAGIC_CLASS = "Brujo";

// Subclases que confieren conjuración de 1/3 de nivel
export const THIRD_CASTER_SUBCLASSES: Partial<Record<string, string>> = {
  "Guerrero": "Caballero Arcano",
  "Pícaro":   "Embaucador Arcano",
};

// Espacios por nivel — Lanzadores plenos (índice = nivelPersonaje - 1)
export const FULL_CASTER_SLOTS: readonly (readonly number[])[] = [
  [2,0,0,0,0,0,0,0,0],
  [3,0,0,0,0,0,0,0,0],
  [4,2,0,0,0,0,0,0,0],
  [4,3,0,0,0,0,0,0,0],
  [4,3,2,0,0,0,0,0,0],
  [4,3,3,0,0,0,0,0,0],
  [4,3,3,1,0,0,0,0,0],
  [4,3,3,2,0,0,0,0,0],
  [4,3,3,3,1,0,0,0,0],
  [4,3,3,3,2,0,0,0,0],
  [4,3,3,3,2,1,0,0,0],
  [4,3,3,3,2,1,0,0,0],
  [4,3,3,3,2,1,1,0,0],
  [4,3,3,3,2,1,1,0,0],
  [4,3,3,3,2,1,1,1,0],
  [4,3,3,3,2,1,1,1,0],
  [4,3,3,3,2,1,1,1,1],
  [4,3,3,3,3,1,1,1,1],
  [4,3,3,3,3,2,1,1,1],
  [4,3,3,3,3,2,2,1,1],
] as const;

// Espacios por nivel de clase — Medio Lanzadores (índice = nivelClase - 1)
export const HALF_CASTER_SLOTS: readonly (readonly number[])[] = [
  [0,0,0,0,0],
  [2,0,0,0,0],
  [3,0,0,0,0],
  [3,0,0,0,0],
  [4,2,0,0,0],
  [4,2,0,0,0],
  [4,3,0,0,0],
  [4,3,0,0,0],
  [4,3,2,0,0],
  [4,3,2,0,0],
  [4,3,3,0,0],
  [4,3,3,0,0],
  [4,3,3,1,0],
  [4,3,3,1,0],
  [4,3,3,2,0],
  [4,3,3,2,0],
  [4,3,3,3,1],
  [4,3,3,3,1],
  [4,3,3,3,2],
  [4,3,3,3,2],
] as const;

// Magia de Pacto del Brujo (por nivel de Brujo)
export const WARLOCK_PACT_MAGIC: Record<number, { slots: number; slotLevel: number }> = {
  1:  { slots: 1, slotLevel: 1 },
  2:  { slots: 2, slotLevel: 1 },
  3:  { slots: 2, slotLevel: 2 },
  4:  { slots: 2, slotLevel: 2 },
  5:  { slots: 2, slotLevel: 3 },
  6:  { slots: 2, slotLevel: 3 },
  7:  { slots: 2, slotLevel: 4 },
  8:  { slots: 2, slotLevel: 4 },
  9:  { slots: 2, slotLevel: 5 },
  10: { slots: 2, slotLevel: 5 },
  11: { slots: 3, slotLevel: 5 },
  12: { slots: 3, slotLevel: 5 },
  13: { slots: 3, slotLevel: 5 },
  14: { slots: 3, slotLevel: 5 },
  15: { slots: 3, slotLevel: 5 },
  16: { slots: 3, slotLevel: 5 },
  17: { slots: 4, slotLevel: 5 },
  18: { slots: 4, slotLevel: 5 },
  19: { slots: 4, slotLevel: 5 },
  20: { slots: 4, slotLevel: 5 },
};

function _parseRawSpell(raw: string): SpellListEntry {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(.+?)(?:\s*\(([^)]+)\))?$/);
  const name  = (m?.[1] ?? trimmed).trim();
  const flags = m?.[2] ?? "";
  return { name, concentration: flags.includes("C"), ritual: flags.includes("R") };
}

function _parseSpellLine(line: string): SpellListEntry[] {
  return line.split(", ").map(_parseRawSpell).filter(e => e.name.length > 0);
}

const _RAW_SPELL_LISTS: Record<string, Record<number, string>> = {
  "Bardo": {
    0: "Blade Ward, Dancing Lights, Friends, Light, Mage Hand, Mending, Message, Minor Illusion, Prestidigitation, Starry Wisp, Thunderclap, True Strike, Vicious Mockery",
    1: "Animal Friendship, Bane, Charm Person, Color Spray, Command, Comprehend Languages (R), Cure Wounds, Detect Magic (C/R), Disguise Self, Dissonant Whispers, Faerie Fire (C), Feather Fall, Healing Word, Heroism (C), Identify (R/M), Illusory Script (R/M), Longstrider, Silent Image (C), Sleep (C), Speak with Animals (R), Tasha's Hideous Laughter (C), Thunderwave, Unseen Servant (R)",
    2: "Aid, Animal Messenger (R), Blindness/Deafness, Calm Emotions (C), Cloud of Daggers (C), Crown of Madness (C), Detect Thoughts (C), Enhance Ability (C), Enlarge/Reduce (C), Enthrall (C), Heat Metal (C), Hold Person (C), Invisibility (C), Knock, Lesser Restoration, Locate Animals or Plants (R), Locate Object (C), Magic Mouth (R/M), Mirror Image, Phantasmal Force (C), See Invisibility, Shatter, Silence (C/R), Suggestion (C), Zone of Truth",
    3: "Bestow Curse (C), Clairvoyance (C/M), Dispel Magic, Fear (C), Feign Death (R), Glyph of Warding (M), Hypnotic Pattern (C), Leomund's Tiny Hut (R), Major Image (C), Mass Healing Word, Nondetection (M), Plant Growth, Sending, Slow (C), Speak with Dead, Speak with Plants, Stinking Cloud (C), Tongues",
    4: "Charm Monster, Compulsion (C), Confusion (C), Dimension Door, Fount of Moonlight (C), Freedom of Movement, Greater Invisibility (C), Hallucinatory Terrain, Locate Creature (C), Phantasmal Killer (C), Polymorph (C)",
    5: "Animate Objects (C), Awaken (M), Dominate Person (C), Dream, Geas, Greater Restoration (M), Hold Monster (C), Legend Lore (M), Mass Cure Wounds, Mislead (C), Modify Memory (C), Planar Binding (M), Raise Dead (M), Rary's Telepathic Bond (R), Scrying (C/M), Seeming, Synaptic Static, Teleportation Circle (M), Yolande's Regal Presence (C)",
    6: "Eyebite (C), Find the Path (C/M), Guards and Wards (M), Heroes' Feast (M), Mass Suggestion, Otto's Irresistible Dance (C), Programmed Illusion (M), True Seeing (M)",
    7: "Etherealness, Forcecage (C/M), Mirage Arcane, Mordenkainen's Magnificent Mansion (M), Mordenkainen's Sword (C/M), Power Word Fortify, Prismatic Spray, Project Image (C/M), Regenerate, Resurrection (M), Symbol (M), Teleport",
    8: "Antipathy/Sympathy, Befuddlement, Dominate Monster (C), Glibness, Mind Blank, Power Word Stun",
    9: "Foresight, Power Word Heal, Power Word Kill, Prismatic Wall, True Polymorph (C)",
  },
  "Clérigo": {
    0: "Guidance (C), Light, Mending, Resistance (C), Sacred Flame, Spare the Dying, Thaumaturgy, Toll the Dead, Word of Radiance",
    1: "Bane (C), Bless (C/M), Command, Create or Destroy Water, Cure Wounds, Detect Evil and Good (C), Detect Magic (C/R), Detect Poison and Disease (C/R), Guiding Bolt, Healing Word, Inflict Wounds, Protection from Evil and Good (C/M), Purify Food and Drink (R), Sanctuary, Shield of Faith (C)",
    2: "Aid, Augury (R/M), Blindness/Deafness, Calm Emotions (C), Continual Flame (M), Enhance Ability (C), Find Traps, Gentle Repose (R/M), Hold Person (C), Lesser Restoration, Locate Object (C), Prayer of Healing, Protection from Poison, Silence (C/R), Spiritual Weapon (C), Warding Bond (M), Zone of Truth",
    3: "Animate Dead, Aura of Vitality (C), Beacon of Hope (C), Bestow Curse (C), Clairvoyance (C/M), Create Food and Water, Daylight, Dispel Magic, Feign Death (R), Glyph of Warding (M), Magic Circle (M), Mass Healing Word, Meld into Stone (R), Protection from Energy (C), Remove Curse, Revivify (M), Sending, Speak with Dead, Spirit Guardians (C), Tongues, Water Walk (R)",
    4: "Aura of Life (C), Aura of Purity (C), Banishment (C), Control Water (C), Death Ward, Divination (R/M), Freedom of Movement, Guardian of Faith, Locate Creature (C), Stone Shape",
    5: "Circle of Power (C), Commune (R), Contagion, Dispel Evil and Good (C), Flame Strike, Geas, Greater Restoration (M), Hallow (M), Insect Plague (C), Legend Lore (M), Mass Cure Wounds, Planar Binding (M), Raise Dead (M), Scrying (C/M), Summon Celestial (C/M)",
    6: "Blade Barrier (C), Create Undead (M), Find the Path (C/M), Forbiddance (R/M), Harm, Heal, Heroes' Feast (M), Planar Ally, Sunbeam (C), True Seeing (M), Word of Recall",
    7: "Conjure Celestial (C), Divine Word, Etherealness, Fire Storm, Plane Shift (M), Power Word Fortify, Regenerate, Resurrection (M), Symbol (M)",
    8: "Antimagic Field (C), Control Weather (C), Earthquake (C), Holy Aura (C/M), Sunburst",
    9: "Astral Projection (M), Gate (C/M), Mass Heal, Power Word Heal, True Resurrection (M)",
  },
  "Druida": {
    0: "Druidcraft, Elementalism, Guidance (C), Mending, Message, Poison Spray, Produce Flame, Resistance (C), Shillelagh, Spare the Dying, Starry Wisp, Thorn Whip, Thunderclap",
    1: "Animal Friendship, Charm Person, Create or Destroy Water, Cure Wounds, Detect Magic (C/R), Detect Poison and Disease (C/R), Entangle (C), Faerie Fire (C), Fog Cloud (C), Goodberry, Healing Word, Ice Knife, Jump, Longstrider, Protection from Evil and Good (C/M), Purify Food and Drink (R), Speak with Animals (R), Thunderwave",
    2: "Aid, Animal Messenger (R), Augury (R/M), Barkskin, Beast Sense (C/R), Continual Flame (M), Darkvision, Enhance Ability (C), Enlarge/Reduce (C), Find Traps, Flame Blade (C), Flaming Sphere (C), Gust of Wind (C), Heat Metal (C), Hold Person (C), Lesser Restoration, Locate Animals or Plants (R), Locate Object (C), Moonbeam (C), Pass without Trace (C), Protection from Poison, Spike Growth (C), Summon Beast (C/M)",
    3: "Aura of Vitality (C), Call Lightning (C), Conjure Animals (C), Daylight, Dispel Magic, Elemental Weapon (C), Feign Death (R), Meld into Stone (R), Plant Growth, Protection from Energy (C), Revivify (M), Sleet Storm (C), Speak with Plants, Summon Fey (C/M), Water Breathing (R), Water Walk (R), Wind Wall (C)",
    4: "Blight, Charm Monster, Confusion (C), Conjure Minor Elementals (C), Conjure Woodland Beings (C), Control Water (C), Divination (R/M), Dominate Beast (C), Fire Shield, Fount of Moonlight (C), Freedom of Movement, Giant Insect (C), Grasping Vine (C), Hallucinatory Terrain, Ice Storm, Locate Creature (C), Polymorph (C), Stone Shape, Stoneskin (C/M), Summon Elemental (C/M), Wall of Fire (C)",
    5: "Antilife Shell (C), Awaken (M), Commune with Nature (R), Cone of Cold, Conjure Elemental (C), Contagion, Geas, Greater Restoration (M), Insect Plague (C), Mass Cure Wounds, Planar Binding (M), Reincarnate (M), Scrying (C/M), Tree Stride (C), Wall of Stone (C)",
    6: "Conjure Fey (C), Find the Path (C/M), Flesh to Stone (C), Heal, Heroes' Feast (M), Move Earth (C), Sunbeam (C), Transport via Plants, Wall of Thorns (C), Wind Walk",
    7: "Fire Storm, Mirage Arcane, Plane Shift (M), Regenerate, Reverse Gravity (C), Symbol (M)",
    8: "Animal Shapes, Antipathy/Sympathy, Befuddlement, Control Weather (C), Earthquake (C), Incendiary Cloud (C), Sunburst, Tsunami (C)",
    9: "Foresight, Shapechange (C/M), Storm of Vengeance (C), True Resurrection (M)",
  },
  "Paladín": {
    1: "Bless (C/M), Command, Compelled Duel (C), Cure Wounds, Detect Evil and Good (C), Detect Magic (C/R), Detect Poison and Disease (C/R), Divine Favor, Divine Smite, Heroism (C), Protection from Evil and Good (C/M), Purify Food and Drink (R), Searing Smite, Shield of Faith (C), Thunderous Smite, Wrathful Smite",
    2: "Aid, Find Steed, Gentle Repose (R/M), Lesser Restoration, Locate Object (C), Magic Weapon, Prayer of Healing, Protection from Poison, Shining Smite (C), Warding Bond (M), Zone of Truth",
    3: "Aura of Vitality (C), Blinding Smite, Create Food and Water, Crusader's Mantle (C), Daylight, Dispel Magic, Elemental Weapon (C), Magic Circle (M), Remove Curse, Revivify (M)",
    4: "Aura of Life (C), Aura of Purity (C), Banishment (C), Death Ward, Locate Creature (C), Staggering Smite",
    5: "Banishing Smite (C), Circle of Power (C), Destructive Wave, Dispel Evil and Good (C), Geas, Greater Restoration (M), Raise Dead (M), Summon Celestial (C/M)",
  },
  "Explorador": {
    1: "Alarm (R), Animal Friendship, Cure Wounds, Detect Magic (C/R), Detect Poison and Disease (C/R), Ensnaring Strike (C), Entangle (C), Fog Cloud (C), Goodberry, Hail of Thorns, Hunter's Mark (C), Jump, Longstrider, Speak with Animals (R)",
    2: "Aid, Animal Messenger (R), Barkskin, Beast Sense (C/R), Cordon of Arrows, Darkvision, Enhance Ability (C), Find Traps, Gust of Wind (C), Lesser Restoration, Locate Animals or Plants (R), Locate Object (C), Magic Weapon, Pass without Trace (C), Protection from Poison, Silence (C/R), Spike Growth (C), Summon Beast (C/M)",
    3: "Conjure Animals (C), Conjure Barrage, Daylight, Dispel Magic, Elemental Weapon (C), Lightning Arrow, Meld into Stone (R), Nondetection (M), Plant Growth, Protection from Energy (C), Revivify (M), Speak with Plants, Summon Fey (C/M), Water Breathing (R), Water Walk (R), Wind Wall (C)",
    4: "Conjure Woodland Beings (C), Dominate Beast (C), Freedom of Movement, Grasping Vine (C), Locate Creature (C), Stoneskin (C/M), Summon Elemental (C/M)",
    5: "Commune with Nature (R), Conjure Volley, Greater Restoration (M), Steel Wind Strike (M), Swift Quiver (C/M), Tree Stride (C)",
  },
  "Hechicero": {
    0: "Acid Splash, Blade Ward (C), Chill Touch, Dancing Lights (C), Elementalism, Fire Bolt, Friends (C), Light, Mage Hand, Mending, Message, Mind Sliver, Minor Illusion, Poison Spray, Prestidigitation, Ray of Frost, Shocking Grasp, Sorcerous Burst, Thunderclap, True Strike",
    1: "Burning Hands, Charm Person, Chromatic Orb (M), Color Spray, Comprehend Languages (R), Detect Magic (C/R), Disguise Self, Expeditious Retreat (C), False Life, Feather Fall, Fog Cloud (C), Grease, Ice Knife, Jump, Mage Armor, Magic Missile, Ray of Sickness, Shield, Silent Image (C), Sleep (C), Thunderwave, Witch Bolt (C)",
    2: "Alter Self (C), Arcane Vigor, Blindness/Deafness, Blur (C), Cloud of Daggers (C), Crown of Madness (C), Darkness (C), Darkvision, Detect Thoughts (C), Dragon's Breath (C), Enhance Ability (C), Enlarge/Reduce (C), Flame Blade (C), Flaming Sphere (C), Gust of Wind (C), Hold Person (C), Invisibility (C), Knock, Levitate (C), Magic Weapon, Mind Spike (C), Mirror Image, Misty Step, Phantasmal Force (C), Scorching Ray, See Invisibility, Shatter, Spider Climb (C), Suggestion (C), Web (C)",
    3: "Blink, Clairvoyance (C/M), Counterspell, Daylight, Dispel Magic, Fear (C), Fireball, Fly (C), Gaseous Form (C), Haste (C), Hypnotic Pattern (C), Lightning Bolt, Major Image (C), Protection from Energy (C), Sleet Storm (C), Slow (C), Stinking Cloud (C), Tongues, Vampiric Touch (C), Water Breathing (R), Water Walk (R)",
    4: "Banishment (C), Blight, Charm Monster, Confusion (C), Dimension Door, Dominate Beast (C), Fire Shield, Greater Invisibility (C), Ice Storm, Polymorph (C), Stoneskin (C/M), Vitriolic Sphere, Wall of Fire (C)",
    5: "Animate Objects (C), Bigby's Hand (C), Cloudkill (C), Cone of Cold, Creation, Dominate Person (C), Hold Monster (C), Insect Plague (C), Seeming, Synaptic Static, Telekinesis (C), Teleportation Circle (M), Wall of Stone (C)",
    6: "Arcane Gate (C), Chain Lightning, Circle of Death (M), Disintegrate, Eyebite (C), Flesh to Stone (C), Globe of Invulnerability (C), Mass Suggestion, Move Earth (C), Otiluke's Freezing Sphere, Sunbeam (C), True Seeing (M)",
    7: "Delayed Blast Fireball (C), Etherealness, Finger of Death, Fire Storm, Plane Shift (M), Prismatic Spray, Reverse Gravity (C), Teleport",
    8: "Demiplane, Dominate Monster (C), Earthquake (C), Incendiary Cloud (C), Power Word Stun, Sunburst",
    9: "Gate (C/M), Meteor Swarm, Power Word Kill, Time Stop, Wish",
  },
  "Brujo": {
    0: "Blade Ward (C), Chill Touch, Eldritch Blast, Friends (C), Mage Hand, Mind Sliver, Minor Illusion, Poison Spray, Prestidigitation, Thunderclap, Toll the Dead, True Strike",
    1: "Armor of Agathys, Arms of Hadar, Bane (C), Charm Person, Comprehend Languages (R), Detect Magic (C/R), Expeditious Retreat (C), Hellish Rebuke, Hex (C), Illusory Script (R/M), Protection from Evil and Good (C/M), Speak with Animals (R), Tasha's Hideous Laughter (C), Unseen Servant (R), Witch Bolt (C)",
    2: "Cloud of Daggers (C), Crown of Madness (C), Darkness (C), Enthrall (C), Hold Person (C), Invisibility (C), Mind Spike (C), Mirror Image, Misty Step, Ray of Enfeeblement (C), Spider Climb (C), Suggestion (C)",
    3: "Counterspell, Dispel Magic, Fear (C), Fly (C), Gaseous Form (C), Hunger of Hadar (C), Hypnotic Pattern (C), Magic Circle (M), Major Image (C), Remove Curse, Summon Fey (C/M), Summon Undead (C/M), Tongues, Vampiric Touch (C)",
    4: "Banishment (C), Blight, Charm Monster, Dimension Door, Hallucinatory Terrain, Summon Aberration (C/M)",
    5: "Contact Other Plane (R), Dream, Hold Monster (C), Jallarzi's Storm of Radiance (C), Mislead (C), Planar Binding (M), Scrying (C/M), Synaptic Static, Teleportation Circle (M)",
    6: "Arcane Gate (C), Circle of Death (M), Create Undead (M), Eyebite (C), Summon Fiend (C/M), Tasha's Bubbling Cauldron (M), True Seeing (M)",
    7: "Etherealness, Finger of Death, Forcecage (C/M), Plane Shift (M)",
    8: "Befuddlement, Demiplane, Dominate Monster (C), Glibness, Power Word Stun",
    9: "Astral Projection (M), Foresight, Gate (C/M), Imprisonment (M), Power Word Kill, True Polymorph (C), Weird (C)",
  },
  "Mago": {
    0: "Acid Splash, Blade Ward (C), Chill Touch, Dancing Lights (C), Elementalism, Fire Bolt, Friends (C), Light, Mage Hand, Mending, Message, Mind Sliver, Minor Illusion, Poison Spray, Prestidigitation, Ray of Frost, Shocking Grasp, Thunderclap, Toll the Dead, True Strike",
    1: "Alarm (R), Burning Hands, Charm Person, Chromatic Orb (M), Color Spray, Comprehend Languages (R), Detect Magic (C/R), Disguise Self, Expeditious Retreat (C), False Life, Feather Fall, Find Familiar (R/M), Fog Cloud (C), Grease, Ice Knife, Identify (R/M), Illusory Script (R/M), Jump, Longstrider, Mage Armor, Magic Missile, Protection from Evil and Good (C/M), Ray of Sickness, Shield, Silent Image (C), Sleep (C), Tasha's Hideous Laughter (C), Tenser's Floating Disk (R), Thunderwave, Unseen Servant (R), Witch Bolt (C)",
    2: "Alter Self (C), Arcane Lock (M), Arcane Vigor, Augury (R/M), Blindness/Deafness, Blur (C), Cloud of Daggers (C), Continual Flame (M), Crown of Madness (C), Darkness (C), Darkvision, Detect Thoughts (C), Dragon's Breath (C), Enhance Ability (C), Enlarge/Reduce (C), Flaming Sphere (C), Gentle Repose (R/M), Gust of Wind (C), Hold Person (C), Invisibility (C), Knock, Levitate (C), Locate Object (C), Magic Mouth (R/M), Magic Weapon, Melf's Acid Arrow, Mind Spike (C), Mirror Image, Misty Step, Nystul's Magic Aura, Phantasmal Force (C), Ray of Enfeeblement (C), Rope Trick, Scorching Ray, See Invisibility, Shatter, Spider Climb (C), Suggestion (C), Web (C)",
    3: "Animate Dead, Bestow Curse (C), Blink, Clairvoyance (C/M), Counterspell, Dispel Magic, Fear (C), Feign Death (R), Fireball, Fly (C), Gaseous Form (C), Glyph of Warding (M), Haste (C), Hypnotic Pattern (C), Leomund's Tiny Hut (R), Lightning Bolt, Magic Circle (M), Major Image (C), Nondetection (M), Phantom Steed (R), Protection from Energy (C), Remove Curse, Sending, Sleet Storm (C), Slow (C), Speak with Dead, Stinking Cloud (C), Summon Fey (C/M), Summon Undead (C/M), Tongues, Vampiric Touch (C), Water Breathing (R)",
    4: "Arcane Eye (C), Banishment (C), Blight, Charm Monster, Confusion (C), Conjure Minor Elementals (C), Control Water (C), Dimension Door, Divination (R/M), Evard's Black Tentacles (C), Fabricate, Fire Shield, Greater Invisibility (C), Hallucinatory Terrain, Ice Storm, Leomund's Secret Chest (M), Locate Creature (C), Mordenkainen's Faithful Hound, Mordenkainen's Private Sanctum, Otiluke's Resilient Sphere (C), Phantasmal Killer (C), Polymorph (C), Stone Shape, Stoneskin (C/M), Summon Aberration (C/M), Summon Construct (C/M), Summon Elemental (C/M), Vitriolic Sphere, Wall of Fire (C)",
    5: "Animate Objects (C), Bigby's Hand (C), Circle of Power (C), Cloudkill (C), Cone of Cold, Conjure Elemental (C), Contact Other Plane (R), Creation, Dominate Person (C), Dream, Geas, Hold Monster (C), Jallarzi's Storm of Radiance (C), Legend Lore (M), Mislead (C), Modify Memory (C), Passwall, Planar Binding (M), Rary's Telepathic Bond (R), Scrying (C/M), Seeming, Steel Wind Strike (M), Summon Dragon (C/M), Synaptic Static, Telekinesis (C), Teleportation Circle (M), Wall of Force (C), Wall of Stone (C), Yolande's Regal Presence (C)",
    6: "Arcane Gate (C), Chain Lightning, Circle of Death (M), Contingency (M), Create Undead (M), Disintegrate, Drawmij's Instant Summons (R/M), Eyebite (C), Flesh to Stone (C), Globe of Invulnerability (C), Guards and Wards (M), Magic Jar (M), Mass Suggestion, Move Earth (C), Otiluke's Freezing Sphere, Otto's Irresistible Dance (C), Programmed Illusion (M), Summon Fiend (C/M), Sunbeam (C), Tasha's Bubbling Cauldron (M), True Seeing (M), Wall of Ice (C)",
    7: "Delayed Blast Fireball (C), Etherealness, Finger of Death, Forcecage (C/M), Mirage Arcane, Mordenkainen's Magnificent Mansion (M), Mordenkainen's Sword (C/M), Plane Shift (M), Prismatic Spray, Project Image (C/M), Reverse Gravity (C), Sequester (M), Simulacrum (M), Symbol (M), Teleport",
    8: "Antimagic Field (C), Antipathy/Sympathy, Befuddlement, Clone (M), Control Weather (C), Demiplane, Dominate Monster (C), Incendiary Cloud (C), Maze (C), Mind Blank, Power Word Stun, Sunburst, Telepathy",
    9: "Astral Projection (M), Foresight, Gate (C/M), Imprisonment (M), Meteor Swarm, Power Word Kill, Prismatic Wall, Shapechange (C/M), Time Stop, True Polymorph (C), Weird (C), Wish",
  },
};

export const SPELL_LISTS_BY_CLASS: Record<string, Record<number, SpellListEntry[]>> =
  Object.fromEntries(
    Object.entries(_RAW_SPELL_LISTS).map(([cls, levels]) => [
      cls,
      Object.fromEntries(
        Object.entries(levels).map(([lvl, line]) => [
          parseInt(lvl),
          _parseSpellLine(line),
        ])
      ),
    ])
  );

export function isClassSpellcaster(className: string, subclass?: string | null): boolean {
  const ability = SPELLCASTING_ABILITY_BY_CLASS[className];
  if (ability !== null && ability !== undefined) return true;
  const thirdSub = THIRD_CASTER_SUBCLASSES[className];
  return thirdSub !== undefined && subclass === thirdSub;
}
