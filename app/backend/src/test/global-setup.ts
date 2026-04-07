import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const TEST_DB_URL = "file:/tmp/dnd-assistant-test.db";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function setup() {
  // Aplica el schema de Prisma a la DB de test antes de que arranque cualquier suite.
  // --skip-generate: el cliente ya está generado; solo sincronizamos la DB.
  execSync("npx prisma db push --skip-generate --force-reset", {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "pipe",
  });
}
