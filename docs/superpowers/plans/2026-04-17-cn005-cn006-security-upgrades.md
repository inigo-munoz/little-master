# CN-005 / CN-006 — Security Dependency Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate active CVEs by upgrading Next.js 14→15.5.15 (5+ CVEs incl. SSRF + path traversal) and Fastify 4→5.8.5 + plugins (3 CVEs).

**Architecture:** Two independent package-version bumps plus any TypeScript/API fixes they surface. No feature changes. Frontend stays on React 18 (compatible with Next.js 15). Backend and MCP server both get Fastify 5.

**Tech Stack:** Next.js 15.5.15, React 18.3, Fastify 5.8.5, @fastify/cors 10, @fastify/helmet 12, @fastify/sensible 6, @fastify/multipart 9, pnpm workspaces, TypeScript strict mode, Vitest.

---

## Files Modified

| File | Change |
|------|--------|
| `app/frontend/package.json` | `next` ^14.2.3 → 15.5.15 |
| `app/backend/package.json` | `fastify` ^4.27.0 → 5.8.5; cors 9→10; helmet 11→12; multipart 8→9; sensible 5→6 |
| `app/mcp-server/package.json` | `fastify` ^4.27.0 → 5.8.5; cors 9→10 |
| `app/backend/src/server.ts` | Fix any Fastify 5 API changes |
| `app/backend/src/middleware/errorHandler.ts` | Fix any Fastify 5 type changes |
| `app/mcp-server/src/index.ts` | Fix any Fastify 5 API changes |
| Any route file with type errors | Fix as surfaced by typecheck |

---

## Task 1: CN-005 — Actualizar Next.js 14 → 15.5.15

**Files:**
- Modify: `app/frontend/package.json`

- [ ] **Step 1: Actualizar la versión de Next.js en package.json**

En `app/frontend/package.json`, cambiar:
```json
"next": "^14.2.3",
```
por:
```json
"next": "15.5.15",
```
(sin `^` para fijar la versión exacta y evitar que pnpm resuelva una versión diferente)

- [ ] **Step 2: Instalar dependencias**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm install
```
Expected: Instala sin errores. Puede advertir sobre peer deps de React 19 — es esperado, React 18 es compatible con Next.js 15.

- [ ] **Step 3: Typecheck del frontend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm typecheck
```
Expected: 0 errores. Si hay errores, ver sección de fixes habituales al final de este task.

**Fixes habituales en Next.js 15:**

- `params` en Server Components es ahora `Promise<{id:string}>` — necesita `await params`. **Nuestro caso:** todas las páginas son `"use client"` y usan `useParams()`, por lo que este cambio NO aplica.
- `fetch()` ya no cachea por defecto — no aplica (usamos SWR + api.ts).
- Si `next/navigation` o `next/headers` dan errores de tipo, actualizar imports según mensajes de error.

- [ ] **Step 4: Build del frontend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm build
```
Expected: Build exitoso, sin errores. Puede haber warnings de "Dynamic server usage" — aceptables.

- [ ] **Step 5: Tests del frontend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/frontend"
pnpm test
```
Expected: 46 tests en verde.

- [ ] **Step 6: Commit CN-005**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/frontend/package.json pnpm-lock.yaml
git commit -m "fix(security): actualizar Next.js 14 → 15.5.15 (CN-005)

Elimina 5+ CVEs activos incluyendo SSRF y path traversal en Next.js ^14.x.
Páginas usan useParams() (client components) — sin cambios de API necesarios."
```

---

## Task 2: CN-006 — Actualizar Fastify 4 → 5 en el backend

**Files:**
- Modify: `app/backend/package.json`
- Modify: `app/backend/src/server.ts` (si hay cambios de API)
- Modify: `app/backend/src/middleware/errorHandler.ts` (si hay cambios de tipos)
- Modify: cualquier `app/backend/src/routes/*.ts` con errores de tipo

- [ ] **Step 1: Actualizar versiones en package.json del backend**

En `app/backend/package.json`, reemplazar el bloque de dependencias de Fastify:
```json
"@fastify/cors": "^9.0.1",
"@fastify/helmet": "^11.1.1",
"@fastify/multipart": "^8.3.1",
"@fastify/sensible": "^5.5.0",
...
"fastify": "^4.27.0",
```
por:
```json
"@fastify/cors": "^10.0.0",
"@fastify/helmet": "^12.0.0",
"@fastify/multipart": "^9.0.0",
"@fastify/sensible": "^6.0.0",
...
"fastify": "^5.8.5",
```

- [ ] **Step 2: Instalar dependencias**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm install
```
Expected: Instala sin errores de resolución.

- [ ] **Step 3: Typecheck del backend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend"
pnpm typecheck
```
Expected: 0 errores. Si hay errores, aplicar los fixes de la sección siguiente.

**Fixes habituales en Fastify 5:**

a) **`reply.send()` ya no retorna `FastifyReply`** — retorna `void`. El patrón `return reply.status(X).send(Y)` sigue siendo válido (`.status()` aún retorna `FastifyReply`; solo `.send()` retorna void). Si TypeScript se queja de que una función route retorna `void` en lugar del tipo esperado, cambiar el handler de:
```typescript
// Antes (funciona pero TypeScript puede quejarse en v5)
return reply.send(data);
// Después
reply.send(data); return;
// O mejor: retornar el dato directamente
return data;
```

b) **`FastifyPluginAsync` — sin cambios.** El tipo sigue siendo el mismo.

c) **`setErrorHandler` — sin cambios de firma.** La firma `(error, request, reply) => void` sigue igual.

d) **`@fastify/sensible` v6** — La API `reply.notFound()`, `reply.badRequest()` etc. sigue igual.

e) **`@fastify/multipart` v9** — La API `request.file()` y `request.files()` sigue igual.

- [ ] **Step 4: Fix de errores de tipo (si los hay)**

Aplicar los fixes descritos en Step 3 archivo por archivo según los mensajes de error de TypeScript. Si hay errores en routes, buscar el patrón y corregir.

- [ ] **Step 5: Tests del backend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend"
pnpm test
```
Expected: 116 tests en verde (misma cuenta que antes de la migración).

- [ ] **Step 6: Verificar que el servidor arranca**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/backend"
timeout 8 npx tsx src/server.ts 2>&1 | head -20
```
Expected: Línea con `Backend running at http://127.0.0.1:3001` sin errores de inicialización de plugins.

- [ ] **Step 7: Commit CN-006 backend**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/backend/package.json pnpm-lock.yaml
# Añadir también cualquier .ts modificado:
# git add app/backend/src/...
git commit -m "fix(security): actualizar Fastify 4 → 5.8.5 + plugins en backend (CN-006)

Elimina 3 CVEs activos en Fastify ^4.x.
cors 9→10, helmet 11→12, multipart 8→9, sensible 5→6."
```

---

## Task 3: CN-006 — Actualizar Fastify 4 → 5 en el mcp-server

**Files:**
- Modify: `app/mcp-server/package.json`
- Modify: `app/mcp-server/src/index.ts` (si hay cambios de API)

- [ ] **Step 1: Actualizar versiones en package.json del mcp-server**

En `app/mcp-server/package.json`, reemplazar:
```json
"@fastify/cors": "^9.0.1",
...
"fastify": "^4.27.0",
```
por:
```json
"@fastify/cors": "^10.0.0",
...
"fastify": "^5.8.5",
```

- [ ] **Step 2: Instalar dependencias**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
pnpm install
```
Expected: Sin errores.

- [ ] **Step 3: Typecheck del mcp-server**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/mcp-server"
pnpm typecheck
```
Expected: 0 errores. Aplicar los mismos fixes que en Task 2 si los hay.

- [ ] **Step 4: Verificar que el mcp-server arranca**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant/app/mcp-server"
timeout 5 npx tsx src/index.ts 2>&1 | head -10
```
Expected: Línea con `MCP server running at http://127.0.0.1:3002` sin errores.

- [ ] **Step 5: Commit CN-006 mcp-server**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add app/mcp-server/package.json pnpm-lock.yaml
# git add app/mcp-server/src/index.ts  (si fue modificado)
git commit -m "fix(security): actualizar Fastify 4 → 5.8.5 + cors en mcp-server (CN-006)"
```

---

## Task 4: Actualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Actualizar sección "Estado del proyecto" en CLAUDE.md**

En `CLAUDE.md`, en la sección `### Pendientes conocidos`, marcar como resueltos:

```markdown
- ~~**CN-005**~~ — ✅ Resuelto: Next.js actualizado a 15.5.15
- ~~**CN-006**~~ — ✅ Resuelto: Fastify actualizado a 5.8.5
```

Y actualizar el conteo de tests del backend si cambió.

- [ ] **Step 2: Commit CLAUDE.md**

```bash
cd "/media/inigo/Loki/Mis Repos/dnd-assistant"
git add CLAUDE.md
git commit -m "docs: marcar CN-005 y CN-006 como resueltos en CLAUDE.md"
```
