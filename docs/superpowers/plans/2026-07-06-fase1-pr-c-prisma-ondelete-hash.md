# Fase 1 · PR-C — onDelete Prisma + hash de versión core-rules + fix `--force` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make three backend integrity fixes: (1) explicit `onDelete` on the three Prisma relations that lack it, with a versioned migration; (2) replace the hardcoded core-rules seed version with a content hash so edited rule files actually re-seed; (3) stop `phb-import-cli --force` from deleting the private Monster Manual documents.

**Architecture:** The DB is synced from `schema.prisma` via `prisma db push` at runtime (`server.ts`) and in tests (`vitest.config.ts` global-setup). Versioned migrations under `prisma/migrations/` are kept as a historical/PostgreSQL trail. So the `onDelete` change takes effect via the schema; the migration file is generated read-only with `prisma migrate diff` (touches no real DB). The hash fix computes a sha256 over the rule files' contents; when it differs from the stored `AppSetting`, the previous core-rules documents are deleted and re-imported. The `--force` fix narrows the PHB delete filter to exclude MM documents (`title startsWith "MM 2024"`).

**Tech Stack:** Prisma 5 + SQLite, Node `crypto`/`fs`, TypeScript.

## Global Constraints

- `onDelete` choices must match the schema's existing pattern: required parent → `Cascade`; optional FK → `SetNull`.
- Do NOT run `prisma migrate dev` (it would touch the user's dev DB). Generate the migration SQL with `prisma migrate diff` only.
- Verification = `pnpm typecheck` green + backend suite green (the global-setup `db push --force-reset` applies the new schema to the test DB automatically).
- Conventional commits, no AI attribution. Spanish (neutral) comments to match these files.
- MM documents use `sourceType: "official"` with titles starting `"MM 2024"`; PHB documents use `sourceType: "official"` with other titles. This is the only discriminator available.

---

### Task 1: Explicit `onDelete` on three relations + versioned migration

**Files:**
- Modify: `app/backend/prisma/schema.prisma` (lines 37, 230, 305)
- Create: `app/backend/prisma/migrations/20260706000000_add_ondelete_constraints/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `Campaign.user` → `onDelete: Cascade`; `CampaignRule.ruleSource` → `onDelete: SetNull`; `AssistantRun.llmConfig` → `onDelete: SetNull`.

- [ ] **Step 1: Edit `Campaign.user` (line 37)**

```prisma
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
```

- [ ] **Step 2: Edit `CampaignRule.ruleSource` (line 230)**

```prisma
  ruleSource RuleSource? @relation(fields: [sourceId], references: [id], onDelete: SetNull)
```

- [ ] **Step 3: Edit `AssistantRun.llmConfig` (line 305)**

```prisma
  llmConfig LlmConfig? @relation(fields: [llmConfigId], references: [id], onDelete: SetNull)
```

- [ ] **Step 4: Validate the schema**

Run:
```bash
cd app/backend && pnpm exec prisma validate && pnpm exec prisma generate >/dev/null && cd ../..
```
Expected: "The schema at prisma/schema.prisma is valid 🚀".

- [ ] **Step 5: Generate the migration SQL (read-only, no DB touched)**

Run:
```bash
cd app/backend && pnpm exec prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > /tmp/ondelete.sql && cd ../.. && cat /tmp/ondelete.sql
```
Expected: SQL that recreates `Campaign`, `CampaignRule` and `AssistantRun` with `PRAGMA foreign_keys=OFF; CREATE TABLE ..._new (...); INSERT ...; DROP TABLE ...; ALTER TABLE ... RENAME ...; PRAGMA foreign_keys=ON;` — the FK constraints now carrying the new `ON DELETE` clauses.

If `migrate diff --from-migrations` errors (shadow DB), fall back to `--from-schema-datamodel` against a copy of the schema WITHOUT the three edits; if that is impractical, hand-write the migration following the exact pattern in `prisma/migrations/20260603000000_location_parent_set_null/migration.sql` using the full column lists from `schema.prisma` for the three tables.

- [ ] **Step 6: Save the generated SQL as a migration**

```bash
mkdir -p app/backend/prisma/migrations/20260706000000_add_ondelete_constraints
cp /tmp/ondelete.sql app/backend/prisma/migrations/20260706000000_add_ondelete_constraints/migration.sql
```
Then prepend a header comment to the migration explaining intent:
```sql
-- Add explicit ON DELETE behaviour to three relations that previously used the
-- Prisma default (restrict-like):
--   Campaign.user       -> ON DELETE CASCADE  (deleting a user removes their campaigns)
--   CampaignRule.source -> ON DELETE SET NULL (deleting a rule source detaches the rule)
--   AssistantRun.config -> ON DELETE SET NULL (deleting an LLM config keeps run history)
-- SQLite requires recreating each table to change FK behaviour.
```

- [ ] **Step 7: Verify typecheck and backend tests (test DB gets the new schema via db push)**

Run:
```bash
pnpm typecheck
cd app/backend && pnpm test && cd ../..
```
Expected: typecheck green; 93/93 backend tests pass (global-setup runs `prisma db push --force-reset`, applying the new `onDelete` schema to the test DB).

- [ ] **Step 8: Commit**

```bash
git add app/backend/prisma/schema.prisma app/backend/prisma/migrations/20260706000000_add_ondelete_constraints/
git commit -m "fix(db): add explicit onDelete to Campaign.user, CampaignRule and AssistantRun"
```

---

### Task 2: Content-hash version for the core-rules seed

**Files:**
- Modify: `app/backend/src/db/seed-core-rules.ts`

**Interfaces:**
- Consumes: the rule files in `<seedDir>/core-rules/` (`dm_encounter_rules.md`, `gpt_reglas_dm.md`).
- Produces: `seedCoreRulesIfNeeded` that stores a sha256 content hash in `AppSetting["core_rules_version"]` and re-imports when the hash changes.

- [ ] **Step 1: Add crypto/fs imports and a hash helper**

At the top of `seed-core-rules.ts`, extend the imports and remove the hardcoded constant:

Change the import block to add `readFile` and `createHash`:
```ts
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { prisma } from "./prisma.js";
```

Delete the line `const CURRENT_RULES_VERSION = "1.0";` and, after the `RULE_DOCS` array, add:
```ts
/**
 * Hash sha256 del contenido de los archivos de reglas presentes en seedRulesDir.
 * Se usa como marker de versión: si el contenido cambia, el hash cambia y el
 * seed vuelve a importar. Incluye el nombre de archivo para que reordenar o
 * renombrar también invalide el marker.
 */
async function computeRulesHash(seedRulesDir: string): Promise<string> {
  const hash = createHash("sha256");
  for (const meta of RULE_DOCS) {
    const src = join(seedRulesDir, meta.filename);
    if (existsSync(src)) {
      hash.update(meta.filename);
      hash.update(await readFile(src));
    }
  }
  return hash.digest("hex");
}
```

- [ ] **Step 2: Replace the version check with the hash check + re-seed cleanup**

Replace the block from `const existing = await prisma.appSetting.findUnique(...)` through the `console.log("[seed] Seeding DM core rules...")` line (currently lines 49-58) with:

```ts
  const currentHash = await computeRulesHash(seedRulesDir);

  const existing = await prisma.appSetting.findUnique({
    where: { key: "core_rules_version" },
  });

  if (existing?.value === currentHash) {
    console.log(`[seed] Core rules already seeded (hash ${currentHash.slice(0, 12)}…), skipping`);
    return;
  }

  // El contenido cambió (o es la primera vez): si ya había reglas importadas,
  // borrarlas para reimportar la versión nueva. Solo toca los documentos de
  // core-rules (homebrew_external con los títulos conocidos), nunca contenido del usuario.
  if (existing) {
    await prisma.document.deleteMany({
      where: {
        sourceType: "homebrew_external",
        title: { in: RULE_DOCS.map((r) => r.title) },
      },
    });
    console.log("[seed] Core rules hash changed — reimportando versión nueva");
  }

  console.log(`[seed] Seeding DM core rules (hash ${currentHash.slice(0, 12)}…)...`);
```

- [ ] **Step 3: Store the hash instead of the constant**

At the end of the function, change the `upsert` value from `CURRENT_RULES_VERSION` to `currentHash`:
```ts
  await prisma.appSetting.upsert({
    where: { key: "core_rules_version" },
    update: { value: currentHash },
    create: { key: "core_rules_version", value: currentHash },
  });
```

- [ ] **Step 4: Verify typecheck**

Run:
```bash
pnpm typecheck
```
Expected: green. (No unit test covers this seed path; it only runs with a real `seedDir`. The change is verified by typecheck + the reasoning that the hash now drives re-seed.)

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/db/seed-core-rules.ts
git commit -m "fix(seed): version core rules by content hash instead of constant"
```

---

### Task 3: Stop `phb-import-cli --force` from deleting MM documents

**Files:**
- Modify: `app/backend/src/db/phb-import-cli.ts` (line 40)

**Interfaces:**
- Consumes: nothing.
- Produces: `--force` deletes only PHB documents (`sourceType: "official"` whose title does NOT start with `"MM 2024"`).

- [ ] **Step 1: Narrow the delete filter**

Replace line 40:
```ts
    const deleted = await prisma.document.deleteMany({ where: { sourceType: "official" } });
```
with:
```ts
    // Solo documentos PHB: excluye los del Monster Manual (title "MM 2024 …"),
    // que también usan sourceType "official" y no debe borrar un --force de PHB.
    const deleted = await prisma.document.deleteMany({
      where: { sourceType: "official", NOT: { title: { startsWith: "MM 2024" } } },
    });
```

- [ ] **Step 2: Verify typecheck**

Run:
```bash
pnpm typecheck
```
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add app/backend/src/db/phb-import-cli.ts
git commit -m "fix(cli): phb-import --force no longer deletes Monster Manual documents"
```

---

## Self-Review

**Spec coverage:**
- Item #7 (H19 onDelete) → Task 1, three relations + migration. ✅
- Item #10 (H20 hash core-rules) → Task 2. ✅
- Item #6 colateral (phb --force borra MM) → Task 3. ✅

**Placeholder scan:** No TBD/TODO. Full code shown for every edit. The migration SQL is generated (Step 5) with a documented fallback.

**Type/name consistency:** `computeRulesHash(seedRulesDir: string): Promise<string>` is defined in Task 2 Step 1 and called in Step 2. `currentHash` used consistently across Steps 2-3. `AppSetting` key `"core_rules_version"` unchanged (only its value semantics change: constant → hash).

## Notes for execution

- Branch already created: `feat/fase1-pr-c-prisma-ondelete-hash` (from `main`).
- Touches backend + DB schema → run a fresh-context adversarial review of the diff BEFORE the PR, with special attention to the migration SQL and the re-seed delete filter (must not touch user content).
- No unit test covers the seed or the CLIs (they run via `main()`/`process.exit`); Task 3's fix is defensive. A follow-up could extract the delete filters into testable pure helpers — out of scope here.
- Frontend tests won't run locally (Node 20.18); rely on typecheck + backend suite + CI.
