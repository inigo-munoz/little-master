# Fase 1 · PR-A — CI en PRs + Checksums SHA256 + CONTRIBUTING Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pull-request CI workflow, publish SHA256 checksums with every release (documenting that binaries are unsigned), and add a CONTRIBUTING guide — the public-facing hardening slice of Phase 1.

**Architecture:** Three independent additions. (1) A new `.github/workflows/ci.yml` that mirrors the existing `test` job from `release.yml` but triggers on `pull_request` and `push` to `main`, adding a lint step. (2) A checksum-generation step inside the existing `release` job of `release.yml`, plus a README verification section. (3) A root `CONTRIBUTING.md`. None of these touch application source, so this slice is a self-contained PR that branches from `main`.

**Tech Stack:** GitHub Actions, pnpm 9, Node 22, `sha256sum` (coreutils), Markdown.

## Global Constraints

- GitHub Actions MUST stay pinned to full commit SHAs with a version comment (CN-06 convention already in `release.yml`). Reuse the exact SHAs already present: `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4`, `pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4`, `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4`.
- `PNPM_VERSION: "9.0.0"`, `NODE_VERSION: "22"` — copied verbatim from `release.yml`.
- Least privilege: workflow-level `permissions: contents: read`.
- No binary signing in this phase — the README must say binaries are unsigned and tell users to verify checksums instead.
- Documentation/prose in Spanish (neutral) to match the existing README; identifiers, YAML keys and commit messages in English. Conventional commits, NO AI attribution.
- Test commands (verbatim from repo): `pnpm typecheck`, `pnpm lint`, `pnpm test` (per app, via `working-directory`).

---

### Task 1: PR CI workflow (`ci.yml`)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: existing repo scripts `pnpm typecheck`, `pnpm lint` (root, `--recursive`), and per-app `pnpm test`.
- Produces: a `CI` workflow with a single `test` job that runs on every PR and on push to `main`.

- [ ] **Step 1: Verify the CI commands pass locally first**

Run (from repo root):
```bash
pnpm install --frozen-lockfile
pnpm --filter backend exec prisma generate
pnpm typecheck
pnpm lint
```
Expected: all four succeed. If `pnpm lint` errors because a package lacks a `lint` script, that's fine — `pnpm --recursive` skips packages without the script; a real lint error must be fixed before wiring CI (a red CI on first PR is a bad first impression).

- [ ] **Step 2: Verify the test commands pass locally**

Run:
```bash
cd app/frontend && pnpm test && cd ../..
cd app/backend  && pnpm test && cd ../..
```
Expected: ~176 frontend + ~102 backend tests PASS. (Frontend needs Node ≥20.19 or ≥22.12.)

- [ ] **Step 3: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

# Least privilege: this workflow only reads the repo.
permissions:
  contents: read

env:
  PNPM_VERSION: "9.0.0"
  NODE_VERSION: "22"

jobs:
  test:
    name: Typecheck, lint & test
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          persist-credentials: false

      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        working-directory: app/backend
        run: pnpm exec prisma generate

      - run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Test frontend
        working-directory: app/frontend
        run: pnpm test

      - name: Test backend
        working-directory: app/backend
        run: pnpm test
```

- [ ] **Step 4: Validate the YAML parses**

Run:
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ci.yml OK')"
```
Expected: `ci.yml OK` (no traceback).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run typecheck, lint and tests on pull requests"
```

---

### Task 2: SHA256 checksums in releases

**Files:**
- Modify: `.github/workflows/release.yml` (add a checksum step in the `release` job before "Create GitHub Release"; add `artifacts/checksums.txt` to the release `files:` list)

**Interfaces:**
- Consumes: the `artifacts/` directory produced by the existing `download-artifact` step (`merge-multiple: true`), containing `*.deb *.rpm *.dmg *.msi *.exe`.
- Produces: a `checksums.txt` file attached to every GitHub Release, one `sha256  filename` line per installer.

- [ ] **Step 1: Add the checksum-generation step**

In `.github/workflows/release.yml`, in the `release` job, insert this step immediately AFTER the existing `- name: List artifacts` step (around line 192) and BEFORE `- name: Create GitHub Release`:

```yaml
      - name: Generate SHA256 checksums
        working-directory: artifacts
        run: |
          find . -type f \
            \( -name '*.deb' -o -name '*.rpm' -o -name '*.dmg' -o -name '*.msi' -o -name '*.exe' \) \
            -exec sha256sum {} + | sed 's|  \./|  |' > checksums.txt
          echo "=== checksums.txt ==="
          cat checksums.txt
```

- [ ] **Step 2: Attach `checksums.txt` to the release**

In the same file, in the `- name: Create GitHub Release` step, add `artifacts/checksums.txt` as the first entry of the `files:` block so it reads:

```yaml
          files: |
            artifacts/checksums.txt
            artifacts/**/*.deb
            artifacts/**/*.rpm
            artifacts/**/*.dmg
            artifacts/**/*.msi
            artifacts/**/*.exe
```

- [ ] **Step 3: Validate the YAML parses**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml')); print('release.yml OK')"
```
Expected: `release.yml OK`.

- [ ] **Step 4: Dry-run the checksum logic locally**

Simulate the artifacts layout and confirm the command produces clean `sha256  filename` lines (no `./` prefix, no absolute paths):
```bash
tmp=$(mktemp -d) && mkdir -p "$tmp/artifacts/linux" "$tmp/artifacts/win"
echo x > "$tmp/artifacts/linux/app_1.2.0_amd64.deb"
echo y > "$tmp/artifacts/win/app_1.2.0_x64.msi"
( cd "$tmp/artifacts" && find . -type f \( -name '*.deb' -o -name '*.rpm' -o -name '*.dmg' -o -name '*.msi' -o -name '*.exe' \) -exec sha256sum {} + | sed 's|  \./|  |' )
rm -rf "$tmp"
```
Expected: two lines like `2d711642...  linux/app_1.2.0_amd64.deb` — hash, two spaces, then the path WITHOUT a leading `./`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: publish SHA256 checksums with each release"
```

---

### Task 3: README verification section (unsigned binaries)

**Files:**
- Modify: `README.md` (insert a "Verificación de descargas" subsection after the installer table, currently ending at line 27, before "### Primer inicio" at line 29)

**Interfaces:**
- Consumes: the `checksums.txt` asset added in Task 2.
- Produces: user-facing instructions to verify a download and an explicit note that binaries are unsigned.

- [ ] **Step 1: Insert the verification subsection**

In `README.md`, between the installer table (line 27) and `### Primer inicio` (line 29), insert:

```markdown

### Verificación de descargas

Los instaladores **no están firmados** (aún no hay firma de código). Para verificar
que tu descarga es íntegra, cada release publica un archivo `checksums.txt` con el
hash SHA256 de cada instalador. Después de descargar, comprobá el hash:

```bash
# Linux / macOS
sha256sum -c checksums.txt --ignore-missing

# Windows (PowerShell)
Get-FileHash .\little-master_1.2.0_x64.msi -Algorithm SHA256
```

En Linux/macOS el comando debe imprimir `OK` para el archivo descargado. En Windows,
compará el hash impreso con la línea correspondiente de `checksums.txt`.

Como los binarios no están firmados, el sistema operativo puede mostrar una
advertencia de "desarrollador no identificado" en el primer inicio; es esperado.
```

- [ ] **Step 2: Verify the section renders and is placed correctly**

Run:
```bash
grep -n "Verificación de descargas" README.md
grep -n "no están firmados" README.md
```
Expected: both match, and the line number of the new heading is between the table (≤27 originally) and "Primer inicio".

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document checksum verification for unsigned installers"
```

---

### Task 4: CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md` (repo root)

**Interfaces:**
- Consumes: existing setup/dev commands (already documented in README and CLAUDE.md).
- Produces: a contributor guide covering setup, the CI gate (Task 1), the content-licensing rule, and conventional commits.

- [ ] **Step 1: Write `CONTRIBUTING.md`**

```markdown
# Contribuir a Little Master

¡Gracias por tu interés! Little Master es una app de escritorio para Game Masters,
con licencia MIT. Estas son las pautas para contribuir.

## Antes de empezar

- Abrí un issue describiendo el bug o la propuesta antes de mandar un PR grande, así
  evitamos trabajo duplicado.
- Los cambios pequeños (typos, fixes obvios) pueden ir directo a un PR.

## Setup de desarrollo

```bash
pnpm install

cd app/backend
cp .env.example .env
openssl rand -hex 32   # pegar el resultado en ENCRYPTION_KEY del .env
pnpm db:push
npx tsx src/db/setup.ts

cd ../frontend
echo 'NEXT_PUBLIC_BACKEND_URL=http://localhost:3001' > .env.local

pnpm dev   # backend + frontend en paralelo
```

Requisitos: Node.js 20.19+ o 22.12+, pnpm 9+, y Rust toolchain para compilar la app
de escritorio.

## Antes de abrir un PR

CI corre en cada pull request (`.github/workflows/ci.yml`) y debe pasar en verde.
Corré lo mismo localmente antes de pushear:

```bash
pnpm typecheck
pnpm lint
cd app/frontend && pnpm test
cd ../backend  && pnpm test
```

## Contenido y licencias

**Regla permanente e innegociable: contenido de manuales con copyright JAMÁS se
commitea.** El repositorio es público (MIT) y solo incluye el SRD 5.2.1 (CC-BY-4.0).
El contenido propio del usuario (PHB/DMG/Monster Manual) vive en `data/private/`,
que está en `.gitignore`. No subas ese contenido en un PR.

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
`docs:`, `refactor:`, `ci:`, `chore:`, etc. Un cambio lógico por commit.

## Código

- TypeScript estricto en todo el monorepo.
- El frontend nunca llama `fetch()` directo: todas las llamadas HTTP van por
  `app/frontend/src/lib/api.ts`.
- Seguí los patrones existentes del área que tocás (rutas Fastify como plugins,
  componentes con SWR + Tailwind, funciones de cálculo puras y testeables).
```

- [ ] **Step 2: Verify the file exists and mentions the key rules**

Run:
```bash
test -f CONTRIBUTING.md && echo "exists"
grep -c "data/private" CONTRIBUTING.md
grep -c "Conventional Commits" CONTRIBUTING.md
```
Expected: `exists`, and both greps return ≥1.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING guide"
```

---

## Self-Review

**Spec coverage (of the 3 items in this slice):**
- Item #1 (CI en PRs) → Task 1. ✅
- Item #2 (checksums SHA256 + README sin firma) → Tasks 2 & 3. ✅
- Item #11a (CONTRIBUTING.md) → Task 4. The "badge mm" half of item #11 is intentionally deferred to PR-D (frontend slice). ✅

**Placeholder scan:** No TBD/TODO; every YAML block, command and Markdown block is complete and copy-pasteable.

**Type/name consistency:** `checksums.txt` is the same filename in Task 2 (generation), Task 2 (release `files:`) and Task 3 (README). Action SHAs match `release.yml` verbatim. Env values (`9.0.0`, `22`) match `release.yml`.

## Notes for execution

- Branch from `main`: `git checkout -b feat/fase1-pr-a-ci-checksums`.
- This slice can't fully self-test the CI trigger until the PR is opened (that's the point — opening the PR IS the test that `ci.yml` runs). Local runs in Task 1 de-risk it.
- After the four commits, open the PR per the branch-pr / chained-pr conventions.
