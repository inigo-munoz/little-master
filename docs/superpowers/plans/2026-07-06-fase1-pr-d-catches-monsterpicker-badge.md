# Fase 1 · PR-D — Catches con log + MonsterPicker error + badge "mm" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give silent catches a log trace, add user-facing error handling to `MonsterPicker.handleSelect`, and render a distinct badge for private Monster Manual (`source === "mm"`) creatures in the encounter view.

**Architecture:** Frontend catches log via `console.warn/error/debug` with context; the backend `obsidian.service.ts` uses its existing pino `log`. `MonsterPicker` gains a minimal `error` state shown near the search box. The encounter view gets an `mm` badge mirroring the existing `phb` badge with a distinct color (red, to avoid blue=PHB / purple=NPC).

**Tech Stack:** React (Next.js client components), TypeScript, pino (backend).

## Global Constraints

- Only touch catches that today leave NO trace (truly silent). Catches that already surface an error to the user are out of scope.
- Backend logs go through the existing `log` (pino) in `obsidian.service.ts`; frontend uses `console.*`.
- `pnpm typecheck` + `pnpm lint` green; backend suite green.
- Conventional commits, no AI attribution. Comments in the file's existing language.

---

### Task 1: Log tag-parse failures in DetailModal

**Files:** Modify `app/frontend/src/components/ui/DetailModal.tsx` (3 identical catches at ~349/455/486)

- [ ] **Step 1: Replace all three identical silent catches (use replace_all)**

Old (appears 3×, identical):
```ts
  try { tags = JSON.parse(data.tags); } catch {}
```
New:
```ts
  try { tags = JSON.parse(data.tags); } catch { console.warn("DetailModal: tags JSON inválido, usando []", data.tags); }
```

- [ ] **Step 2: typecheck + commit**
```bash
pnpm typecheck
git add app/frontend/src/components/ui/DetailModal.tsx
git commit -m "fix(frontend): log invalid tags JSON in DetailModal instead of swallowing"
```

---

### Task 2: Log silent catches in settings

**Files:** Modify `app/frontend/src/app/settings/page.tsx` (534, 1013, 1043)

- [ ] **Step 1: Obsidian config catch (~534)**

Old: `    }).catch(() => {});` (in the `api.obsidian.getConfig()` effect)
Context-anchored replacement — replace:
```tsx
    api.obsidian.getConfig().then(({ vaultPath }) => {
      if (vaultPath) setSavedPath(vaultPath);
    }).catch(() => {});
```
with:
```tsx
    api.obsidian.getConfig().then(({ vaultPath }) => {
      if (vaultPath) setSavedPath(vaultPath);
    }).catch((err) => console.error("No se pudo cargar la config de Obsidian", err));
```

- [ ] **Step 2: OAuth status catch (~1013)**

Replace:
```tsx
    api.llmConfig.oauthStatus().then((status) => {
      setOauthStatus(status);
      if (status.model) setSelectedModel(status.model);
    }).catch(() => {});
```
with:
```tsx
    api.llmConfig.oauthStatus().then((status) => {
      setOauthStatus(status);
      if (status.model) setSelectedModel(status.model);
    }).catch((err) => console.error("No se pudo cargar el estado de OAuth", err));
```

- [ ] **Step 3: Polling catch (~1043)** — intentional, keep the intent, add a debug trace

Replace:
```tsx
        } catch { /* continue polling */ }
```
with:
```tsx
        } catch (err) { console.debug("Poll de OAuth falló, reintentando", err); }
```

- [ ] **Step 4: typecheck + lint + commit**
```bash
pnpm typecheck && pnpm lint
git add app/frontend/src/app/settings/page.tsx
git commit -m "fix(frontend): log silent catches in settings (obsidian/oauth)"
```

---

### Task 3: Log silent catches in obsidian.service (backend, pino)

**Files:** Modify `app/backend/src/services/obsidian.service.ts` (255, 347, 350, 763)

- [ ] **Step 1: readFile in scan loop (~255)** — the `.catch(() => null)` before `if (!raw) continue`

Replace the first occurrence:
```ts
    const raw = await fs.readFile(filePath, "utf-8").catch(() => null);
    if (!raw) continue;

    const { fm } = parseFrontmatter(raw);
```
with:
```ts
    const raw = await fs.readFile(filePath, "utf-8").catch((err) => {
      log.warn({ filePath, err }, "No se pudo leer el archivo durante el escaneo del vault — omitiendo");
      return null;
    });
    if (!raw) continue;

    const { fm } = parseFrontmatter(raw);
```

- [ ] **Step 2: mkdir (~347) + second readFile (~350)**

Replace:
```ts
  await fs.mkdir(documentsDir, { recursive: true }).catch(() => {});

  for (const filePath of contentFiles) {
    const raw = await fs.readFile(filePath, "utf-8").catch(() => null);
    if (!raw) continue;

    const { fm, body } = parseFrontmatter(raw);
```
with:
```ts
  await fs.mkdir(documentsDir, { recursive: true }).catch((err) => {
    log.warn({ documentsDir, err }, "No se pudo crear el directorio de documentos");
  });

  for (const filePath of contentFiles) {
    const raw = await fs.readFile(filePath, "utf-8").catch((err) => {
      log.warn({ filePath, err }, "No se pudo leer el archivo durante la importación — omitiendo");
      return null;
    });
    if (!raw) continue;

    const { fm, body } = parseFrontmatter(raw);
```

- [ ] **Step 3: verifyVault catch (~763)**

Replace:
```ts
  } catch {
    return { valid: false, hasTemplates: false, hasPeople: false, hasJournals: false, detectedFolders: [] };
  }
```
with:
```ts
  } catch (err) {
    log.warn({ vaultPath, err }, "No se pudo verificar el vault");
    return { valid: false, hasTemplates: false, hasPeople: false, hasJournals: false, detectedFolders: [] };
  }
```

- [ ] **Step 4: typecheck + backend tests + commit**
```bash
pnpm typecheck && (cd app/backend && pnpm test)
git add app/backend/src/services/obsidian.service.ts
git commit -m "fix(backend): log silent catches in obsidian.service"
```

---

### Task 4: User-facing error in MonsterPicker

**Files:** Modify `app/frontend/src/components/ui/MonsterPicker.tsx`

- [ ] **Step 1: Import AlertCircle**

Replace line 5:
```tsx
import { Search, X, ChevronDown, Loader2 } from "lucide-react";
```
with:
```tsx
import { Search, X, ChevronDown, Loader2, AlertCircle } from "lucide-react";
```

- [ ] **Step 2: Add error state** — after the `loadingName` state (line 26)

Replace:
```tsx
  const [loadingName, setLoadingName] = useState<string | null>(null);
```
with:
```tsx
  const [loadingName, setLoadingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
```

- [ ] **Step 3: Handle the error in handleSelect**

Replace the whole function (lines 39-52):
```tsx
  async function handleSelect(name: string) {
    setLoadingName(name);
    try {
      const detail = await api.srd.monsterDetail(name);
      if (detail) {
        onSelect(detail);
        setOpen(false);
        setSearch("");
        setCrFilter("");
      }
    } finally {
      setLoadingName(null);
    }
  }
```
with:
```tsx
  async function handleSelect(name: string) {
    setLoadingName(name);
    setError(null);
    try {
      const detail = await api.srd.monsterDetail(name);
      if (detail) {
        onSelect(detail);
        setOpen(false);
        setSearch("");
        setCrFilter("");
      }
    } catch (err) {
      console.error("MonsterPicker: no se pudo cargar el detalle del monstruo", err);
      setError(`No se pudo cargar "${name}". Intentá de nuevo.`);
    } finally {
      setLoadingName(null);
    }
  }
```

- [ ] **Step 4: Render the error** — between the search row `</div>` (line 101) and the list (line 103)

Replace:
```tsx
      </div>

      <div className="max-h-56 overflow-y-auto space-y-0.5">
```
with:
```tsx
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </p>
      )}

      <div className="max-h-56 overflow-y-auto space-y-0.5">
```

- [ ] **Step 5: typecheck + lint + commit**
```bash
pnpm typecheck && pnpm lint
git add app/frontend/src/components/ui/MonsterPicker.tsx
git commit -m "fix(frontend): show error in MonsterPicker when monster detail fails"
```

---

### Task 5: "MM 2024" badge in encounter view

**Files:** Modify `app/frontend/src/app/encounter/page.tsx` (after the two `phb` badges at ~192 and ~366)

- [ ] **Step 1: List dropdown badge (~192)**

Replace:
```tsx
                {m.source === "phb" && (
                  <span className="bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded text-xs">PHB 2024</span>
                )}
```
with:
```tsx
                {m.source === "phb" && (
                  <span className="bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded text-xs">PHB 2024</span>
                )}
                {m.source === "mm" && (
                  <span className="bg-red-900/60 text-red-300 border border-red-700/50 px-1.5 py-0.5 rounded text-xs">MM 2024</span>
                )}
```

- [ ] **Step 2: Stat block panel badge (~366)**

Replace:
```tsx
          {source === "phb" && (
            <span className="bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded text-xs">PHB 2024</span>
          )}
```
with:
```tsx
          {source === "phb" && (
            <span className="bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded text-xs">PHB 2024</span>
          )}
          {source === "mm" && (
            <span className="bg-red-900/60 text-red-300 border border-red-700/50 px-1.5 py-0.5 rounded text-xs">MM 2024</span>
          )}
```

- [ ] **Step 3: typecheck + lint + commit**
```bash
pnpm typecheck && pnpm lint
git add app/frontend/src/app/encounter/page.tsx
git commit -m "feat(frontend): show MM 2024 badge for Monster Manual creatures in encounter"
```

---

## Self-Review

**Spec coverage:** Item #4 (silent catches) → Tasks 1-3. Item #5 (MonsterPicker) → Task 4. Item #11b (badge mm) → Task 5. ✅
**Placeholder scan:** All code complete.
**Consistency:** `error`/`setError` used consistently in Task 4; `AlertCircle` imported before use. Badge classes mirror the existing `phb` badge exactly, only color changes. `mm` string matches the backend `source: "mm"` from `srd.ts`.

## Notes for execution
- Branch: `feat/fase1-pr-d-catches-monsterpicker-badge` (from main, already includes PR-A's ci.yml).
- Frontend-heavy → fresh-context review before PR.
- Frontend tests run in CI (Node 22).
