import { z } from "zod";
import { config as loadDotenv } from "dotenv";

loadDotenv();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("127.0.0.1"),

  // Database
  DATABASE_URL: z.string().default("file:../../../data/dnd-assistant.db"),

  // Encryption key for API keys stored in DB.
  // In production this should come from OS keychain — for MVP it's an env var.
  // Generate with: openssl rand -hex 32
  ENCRYPTION_KEY: z
    .string()
    .min(32, "ENCRYPTION_KEY must be at least 32 chars — generate with: openssl rand -hex 32"),

  // Data paths
  DATA_DIR: z.string().default("../../../data"),
  DOCUMENTS_DIR: z.string().default("../../../data/documents"),
  LOGS_DIR: z.string().default("../../../data/logs"),

  // MCP server
  MCP_SERVER_URL: z.string().default("http://127.0.0.1:3002"),

  // CORS - only allow local frontend
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

function parseEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment configuration:");
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = typeof env;
