import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/triple-slash-reference": "off",
      "react/no-unescaped-entities": "warn",
      // Accesibilidad: una etiqueta sin control asociado no se anuncia en un
      // lector de pantalla y no enfoca su campo al hacer clic. En error, para
      // que no vuelva a colarse.
      // depth 3: el navegador calcula el nombre accesible recorriendo todo el
      // subárbol de la etiqueta, pero la regla solo mira 2 niveles por defecto.
      // Subirlo evita el falso positivo en etiquetas cuyo texto va anidado
      // (settings: checkbox + <div><div><span>texto), sin tener que inventar
      // un aria-label que SUSTITUIRÍA ese texto por una clave interna.
      "jsx-a11y/label-has-associated-control": ["error", { depth: 3 }],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
    ],
  },
];

export default eslintConfig;
