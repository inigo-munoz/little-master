import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Estas vars se inyectan ANTES de que se importen los módulos en cada worker,
    // así que prisma.ts y env.ts arrancan ya con la DB de test.
    env: {
      DATABASE_URL: "file:/tmp/dnd-assistant-test.db",
      ENCRYPTION_KEY: "a".repeat(64), // 64 hex chars válidos para el schema Zod
      NODE_ENV: "test",
      DOCUMENTS_DIR: "/tmp/dnd-test-documents",
      DATA_DIR: "/tmp/dnd-test-data",
    },
    globalSetup: ["./src/test/global-setup.ts"],
    // Los tests comparten una DB SQLite — ejecutar archivos secuencialmente
    // para evitar condiciones de carrera en tablas globales (licenses, campaigns)
    fileParallelism: false,
  },
});
