# Hallazgos de severidad alta de la revisión (2026-10-01)

Continuación de [`bloqueantes-revision-2026-10.md`](./bloqueantes-revision-2026-10.md),
que cerró los cinco bloqueantes. Esto ataca lo que quedó marcado como alto.

## Objetivo

Cerrar los hallazgos de severidad alta de la revisión general que no eran
bloqueantes: rendimiento de base de datos, accesibilidad del frontend, el
montaje de `AppShell`, y la decisión sobre la capa Zod muerta.

## Alcance autorizado

Las tareas U1–U4 de abajo. **Fuera de alcance**: descomponer `routes/srd.ts`
(650 líneas de parsing dentro de un fichero de rutas), reescribir el
`findMany` sin límite de `embedding.service.ts`, el N+1 de `buildDocumentList`
y los dos vocabularios de `authorType`. Todo eso queda anotado en la revisión.

## Restricciones

- Ramas apiladas, una por asunto, para que sigan siendo separables. La primera
  es `perf/db-indexes`, sobre `fix/bloqueantes-revision-2026-10`.
- Un work-unit commit por tarea, Conventional Commits, sin atribución de AI.
- Push, PR y merge siguen fuera: decisión del usuario.
- Artefactos técnicos en inglés, salvo ficheros que ya estén en castellano.

## Modo TDD

Igual que en la tanda anterior: TDD no está configurado en el proyecto, así que
rigen **checks funcionales ordinarios**, con tests de regresión donde el cambio
sea observable. Runner: `pnpm test` por workspace.

**Línea base al empezar** (en `fix/bloqueantes-revision-2026-10`):

| Suite | Verde |
| --- | --- |
| backend | 123 |
| frontend | 176 (requiere Node 22) |
| mcp-server | 24 |
| llm-providers | 6 |
| `pnpm typecheck` | 6 workspaces |

## Receipt-driven development

Sigue en **off** por ajuste global (leído el 2026-10-01). No se inicia revisión
nativa; rigen los checks de arriba.

## Tareas

### U1 — Índices de base de datos ausentes

- [ ] **Estado**: en curso, delegada
- **Defecto**: el schema tiene 6 `@@index` en total, en `EntityRelation`,
  `ChangeLog` e `Issue`. SQLite no indexa claves foráneas por su cuenta, así
  que el resto de filtros son escaneos completos. `DocumentChunk` no tiene
  ninguno, ni en `documentId`, y es la tabla más caliente: `search()` la lee
  en cada mensaje de chat.
- **Criterio**: cada índice debe estar justificado por una consulta real
  (`file:line`), y demostrado con `EXPLAIN QUERY PLAN` pasando de
  `SCAN` a `SEARCH ... USING INDEX`. Nada especulativo.
- **Fuera de alcance deliberado**: las restricciones `UNIQUE`. Las candidatas
  son `Player(campaignId, name)` y `Session(campaignId, sessionNumber)`, por
  las carreras de check-then-create. Se dejan porque una `UNIQUE` puede fallar
  al aplicarse contra una base del usuario que ya tenga duplicados, y con el
  arranque fail-fast de `ddbecc0` eso impediría abrir la app. Es una decisión
  suya, con ese riesgo explícito.
- **Commit**: _(pendiente)_

### U2 — `AppShell` montado en cada página

- [ ] **Estado**: pendiente
- **Defecto**: `app/layout.tsx` solo renderiza `{children}`, y las 14 páginas
  envuelven su propio return en `<AppShell>`. Cada cambio de ruta remonta el
  splash "Iniciando…", relanza el health check contra el backend y pierde el
  estado local del `Sidebar`.
- **Commit**: _(pendiente)_

### U3 — Accesibilidad del frontend

- [ ] **Estado**: pendiente
- **Defecto**: `rg htmlFor` devuelve 0 en todo `src`, y `rg 'role="dialog"'`
  también. Ningún control de formulario tiene etiqueta asociada, así que un
  lector de pantalla no anuncia el nombre de ningún campo y hacer clic en la
  etiqueta no enfoca su input. Ningún modal se anuncia como diálogo ni atrapa
  el foco.
- **Nota**: superficie grande y mecánica. Candidata a trocear.
- **Commit**: _(pendiente)_

### U4 — Capa Zod muerta de `@dnd/domain`

- [ ] **Estado**: **bloqueada esperando decisión del usuario**
- **Dato**: 23 schemas exportados; solo `AssistantModeSchema` se ejecuta en
  runtime (`routes/chat.ts:14`). Tres más se consumen solo como tipo
  (`CreateNpc`, `CreateCampaign`, `LlmProvider`) y sus rutas revalidan con un
  `z.object` inline al lado. Los 19 restantes no se referencian desde ningún
  sitio. El frontend se redeclara a mano `Session`, `Npc` y `LlmConfigPublic`
  en `lib/api.ts`.
- **La decisión es del usuario**, y su propia nota de memoria la tiene
  reservada: conectar los schemas a las rutas, o recortar los paquetes a solo
  tipos. No se elige por él.
- **Commit**: _(pendiente)_

## Entrega

- **Estrategia**: una rama por tarea, apiladas. Evita repetir el problema de la
  tanda anterior, que acabó en 884 líneas en una sola rama.
- **Recuento real**: 0.

## Progreso

Documento creado el 2026-10-01. U1 delegada.

## Siguiente paso

Cerrar U1 con su evidencia de `EXPLAIN QUERY PLAN`, luego U2.
