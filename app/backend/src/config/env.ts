import { z } from "zod";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { config as loadDotenv } from "dotenv";

loadDotenv();

const { values: cliArgs } = parseArgs({
  options: {
    "data-dir": { type: "string" },
    port: { type: "string" },
    "seed-dir": { type: "string" },
  },
  strict: false,
});

if (typeof cliArgs["data-dir"] === "string") {
  const d = cliArgs["data-dir"];
  process.env.DATA_DIR = d;
  process.env.DOCUMENTS_DIR = join(d, "documents");
  process.env.LOGS_DIR = join(d, "logs");
  // Prisma SQLite requires forward slashes on all platforms
  const dbPath = join(d, "dnd-assistant.db").replaceAll("\\", "/");
  process.env.DATABASE_URL = `file:${dbPath}`;
}
if (typeof cliArgs.port === "string") {
  process.env.PORT = cliArgs.port;
}
if (typeof cliArgs["seed-dir"] === "string") {
  process.env.SEED_DIR = cliArgs["seed-dir"];
}

if (!process.env.ENCRYPTION_KEY) {
  const dataDir = process.env.DATA_DIR ?? "../../../data";
  mkdirSync(dataDir, { recursive: true });
  const keyFile = join(dataDir, ".encryption-key");
  if (existsSync(keyFile)) {
    process.env.ENCRYPTION_KEY = readFileSync(keyFile, "utf-8").trim();
  } else {
    const key = randomBytes(32).toString("hex");
    writeFileSync(keyFile, key, { mode: 0o600 });
    process.env.ENCRYPTION_KEY = key;
  }
}

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

  // DNS-rebinding defense: comma-separated Host header hostnames the backend accepts.
  // Defaults to loopback only; override if fronting the service with a real hostname.
  ALLOWED_HOSTS: z.string().default("127.0.0.1,localhost,::1"),

  // Seed directory (Tauri bundles SRD content here)
  SEED_DIR: z.string().optional(),
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
