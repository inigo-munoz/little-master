# Bloqueantes de la revisión general (2026-10-01)

## Objetivo

Corregir los cinco bloqueantes confirmados por la revisión general de código del
2026-10-01, en orden de riesgo decreciente, empezando por los que destruyen datos
del usuario.

## Problema

`pnpm typecheck` está verde y 269 tests pasan, pero la auditoría encontró dos
defectos de pérdida de datos activos y una fuga de credenciales al proveedor
equivocado. Ningún test los detecta porque las áreas afectadas
(`obsidian.service.ts`, `crypto/encryption.ts`, el factory de proveedores) no
tienen cobertura alguna.

## Por qué ahora

Lo que pierde datos es irreversible; la deuda arquitectónica no. Además, el
refactor de la capa Zod muerta toca todas las rutas del backend, así que
hacerlo antes obligaría a rebasar cada fix de bloqueante contra ese diff.

## Alcance autorizado

Los cinco bloqueantes listados abajo. **Fuera de alcance**: la capa Zod muerta
de `@dnd/domain` (19 schemas), los índices que faltan en Prisma, la
accesibilidad del frontend, el traslado de `AppShell` a `layout.tsx` y la
descomposición de `routes/srd.ts`. Todo eso queda registrado en la revisión y
se decide por separado.

## Restricciones

- Rama: `fix/bloqueantes-revision-2026-10` (desde `main` en `bc0713c`).
- Un work-unit commit por tarea, Conventional Commits, sin atribución de AI.
- Push, PR y merge quedan fuera: son decisión del usuario.
- Artefactos técnicos en inglés; conversación en castellano.

## Modo TDD

- **Resuelto**: TDD no está configurado en el proyecto (no hay ajuste de
  proyecto ni de sesión que lo active). Se aplican **checks funcionales
  ordinarios**, no ciclo RED→GREEN obligatorio.
- **Excepción acordada con el usuario**: la tarea T1 lleva tests de regresión
  sí o sí, porque el bug llegó hasta aquí precisamente por la ausencia de
  cobertura en `obsidian.service.ts`.
- **Runner**: `pnpm test` desde `app/backend` (vitest 4, DB SQLite real en
  `/tmp/dnd-assistant-test.db`, `fileParallelism: false`).
- **Node**: la suite del frontend exige Node 22 (`.nvmrc`). El Node por defecto
  de la máquina es 20.18.0 y rompe el arranque de vitest.

## Checks aplicables

Por tarea, en este orden:

1. `cd app/backend && pnpm test` (o la suite del área tocada)
2. `pnpm typecheck` desde la raíz
3. `cd app/frontend && pnpm lint` si la tarea toca frontend

## Receipt-driven development

Leído con `gentle-ai review mode status` el 2026-10-01: **off** (decidido por
el ajuste global). No se inicia ni se propone revisión nativa; rigen los checks
ordinarios de arriba.

## Tareas

### T1 — El import de Obsidian borra NPCs homónimos

- [ ] **Estado**: pendiente
- **Defecto**: `app/backend/src/services/obsidian.service.ts:397-403` borra el
  NPC con el mismo nombre *antes* de comprobar si el player ya existe. En el
  segundo import el NPC desaparece y el player se saltea, así que no queda
  ninguno de los dos. Tampoco limpia `entityRelation` ni escribe changelog.
- **Ruta**: delegada (2 archivos no triviales: servicio + test nuevo).
- **Evidencia del trigger**: writer trigger — toca `obsidian.service.ts` y crea
  `obsidian.service.test.ts`.
- **Criterio de aceptación**: reimportar el mismo vault dos veces deja el player
  presente; la migración NPC→player solo borra el NPC cuando el player se crea
  de verdad, y en ese caso limpia sus relaciones y registra el cambio.
- **Checks**: `pnpm test` en backend + `pnpm typecheck`.
- **Commit**: _(pendiente)_

### T2 — `db push --accept-data-loss` en cada arranque, con el error tragado

- [ ] **Estado**: pendiente
- **Defecto**: `app/backend/src/server.ts:127-143`. El comentario afirma que el
  flag "solo añade columnas, nunca borra" y es falso. El `catch` solo loguea,
  así que el servidor arranca contra un schema desincronizado.
- **Alcance**: mitigación inmediata (quitar el flag destructivo y hacer que el
  fallo aborte el arranque). Adoptar migraciones Prisma de verdad es un trabajo
  aparte, no entra aquí.
- **Ruta**: a decidir al abrirla.
- **Commit**: _(pendiente)_

### T3 — La clave de OpenRouter viaja a api.openai.com

- [ ] **Estado**: pendiente
- **Defecto**: `packages/llm-providers/src/providers/factory.ts:22` devuelve
  `new OpenAIProvider(...)` para `openrouter`, y `openai.provider.ts:3`
  hardcodea `https://api.openai.com/v1`. Agrava el fallo que
  `llmConfig.service.ts:127` sí valide la clave contra openrouter.ai: "Test key"
  da verde y el chat falla con un `INVALID_API_KEY` engañoso.
- **Alcance**: override de base URL en el provider. La implementación completa
  de OpenRouter (catálogo de modelos, precios) es el feature de Fase 2 y no
  entra aquí.
- **Ruta**: a decidir al abrirla.
- **Commit**: _(pendiente)_

### T4 — `disposition` y `npcSpecies` se aceptan y se descartan

- [ ] **Estado**: pendiente
- **Defecto**: ambos campos existen en `schema.prisma` y en el Zod de
  `app/backend/src/routes/npcs.ts`, pero `npc.service.ts` no los menciona ni en
  `create` ni en `update`. La API responde 201 y no guarda nada.
- **Ruta**: a decidir al abrirla.
- **Commit**: _(pendiente)_

### T5 — Ollama y `log_change` prometen y fallan

- [ ] **Estado**: pendiente
- **Defecto A**: `factory.ts:23` lanza un `Error` plano para `ollama`, que
  `errorHandler.ts` convierte en un 500 genérico, pese a que la UI lo ofrece.
- **Defecto B**: el tool `log_change` del MCP llama `POST /api/changelog`, pero
  `app/backend/src/routes/changeLog.ts` solo registra dos rutas `GET`.
- **Decisión pendiente del usuario**: arreglar o retirar de la UI. Se plantea al
  abrir la tarea.
- **Commit**: _(pendiente)_

## Entrega

- **Estrategia**: `ask-on-risk` (por defecto).
- **Previsión**: ~420 líneas autoras (adiciones + borrados), justo en el límite
  de ~400. La previsión es gruesa; en lugar de bloquear al usuario con la
  pregunta de encadenado antes de escribir una línea, se plantea cuando el
  recuento real cruce el presupuesto.
- **Recuento real**: 0.
- **Cortes de slice**: ninguno todavía.

## Progreso

Documento creado el 2026-10-01, antes de la primera escritura de código.
Ninguna tarea cerrada.

## Siguiente paso

Abrir T1.
