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

- [x] **Estado**: cerrada
- **Defecto**: `app/backend/src/services/obsidian.service.ts:397-403` borraba el
  NPC con el mismo nombre *antes* de comprobar si el player ya existía. En el
  segundo import el NPC desaparecía y el player se salteaba, así que no quedaba
  ninguno de los dos. Tampoco limpiaba `entityRelation` ni escribía changelog.
- **Ruta**: delegada (2 archivos no triviales: servicio + test nuevo).
- **Evidencia del trigger**: writer trigger — toca `obsidian.service.ts` y crea
  `obsidian.service.test.ts`.
- **Criterio de aceptación**: reimportar el mismo vault dos veces deja el player
  presente; la migración NPC→player solo borra el NPC cuando el player se crea
  de verdad, y en ese caso limpia sus relaciones y registra el cambio.
- **Solución**: se comprueba el player primero, y la migración NPC→player corre
  dentro de una sola `prisma.$transaction` que crea el player, registra el
  cambio y borra las `entityRelation` antes de borrar el NPC. No se reutilizó
  `deleteWithChangeLog` porque abre su propia transacción y no puede unirse
  atómicamente a la creación del player; se replican sus tres pasos dentro de
  la transacción existente.
- **Checks observados**:
  - `cd app/backend && pnpm test`: 16 archivos, **96 tests en verde**
    (línea base 15 / 93; los 3 nuevos explican la diferencia).
  - `pnpm typecheck` desde la raíz: verde en los 5 workspaces.
  - **RED verificado por el padre**: con el servicio revertido al código con el
    bug y los tests nuevos intactos, fallan 2 de 3. El decisivo
    ("does not delete the NPC ... when the player import is skipped") falla con
    `expected null not to be null`, o sea que el NPC había sido borrado. El
    primer test pasa contra el código viejo porque no hay NPC en juego: vale
    como guarda, pero el que atrapa el defecto es el tercero.
- **Commit**: `75611e1`
- **Deuda detectada y NO arreglada** (fuera de alcance): `parseFrontmatter`
  devuelve `Record<string, any>`; y `findFirst` por campaña+nombre sin índice
  único deja la puerta abierta a players duplicados en imports concurrentes
  — la transacción no lo arregla, haría falta un índice único.

### T2 — `db push --accept-data-loss` en cada arranque, con el error tragado

- [x] **Estado**: cerrada
- **Defecto**: `app/backend/src/server.ts:127-143`. El comentario afirmaba que
  el flag "solo añade columnas, nunca borra" y es falso. El `catch` solo
  logueaba, así que el servidor arrancaba contra un schema desincronizado.
- **Alcance**: mitigación inmediata. Adoptar migraciones Prisma de verdad sigue
  siendo trabajo aparte.
- **Ruta**: **inline** (1 archivo ya entendido, sin investigación pendiente).
- **Solución**: se quita `--accept-data-loss` y el fallo se propaga.
  `bootstrap().catch()` ya hacía `log.fatal` + `exit(1)`, así que no hizo falta
  maquinaria nueva. Las rutas "no hay schema" y "no hay CLI de Prisma" se
  dejan NO fatales a propósito —  un build empaquetado puede no traer el CLI—
  pero ahora dicen explícitamente que el schema no se sincronizó.
- **Checks observados**:
  - `pnpm typecheck`: verde en los 5 workspaces.
  - `cd app/backend && pnpm test`: 16 archivos, 96 tests verdes (sin regresión;
    **ningún test ejecuta `initDatabase`**, así que esto prueba ausencia de
    regresión, no que T2 funcione).
  - **Verificación funcional real contra SQLite poblada** (lo que sí prueba T2):
    - DB nueva, push sin el flag → exit 0, sincroniza.
    - Misma DB otra vez → exit 0, "already in sync".
    - Borrar una columna con 1 fila no nula → **exit 1**, nombra la columna y
      el recuento, sin colgarse ni pedir input interactivo.
  - Ese exit 1 sube por `execSync` → `initDatabase` → `bootstrap().catch` →
    `fatal` + `exit(1)`.
- **Commit**: `ddbecc0`
- **Incidente durante la tarea**: al preparar la prueba destructiva se ejecutó
  `sd` sobre `prisma/schema.prisma` creyendo que solo escribía a stdout; `sd`
  edita en sitio y borró la línea `name String` del schema real. Restaurado
  de inmediato con `git checkout --` y verificado antes de seguir. La prueba
  se rehízo sobre una copia en el scratchpad. Sin impacto en los commits.

### T3 — La clave de OpenRouter viaja a api.openai.com

- [x] **Estado**: cerrada
- **Defecto**: `packages/llm-providers/src/providers/factory.ts:22` devolvía
  `new OpenAIProvider(...)` para `openrouter`, y `openai.provider.ts:3`
  hardcodeaba `https://api.openai.com/v1`. Agravaba el fallo que
  `llmConfig.service.ts:127` sí valide la clave contra openrouter.ai: "Test key"
  daba verde y el chat fallaba con un `INVALID_API_KEY` engañoso.
- **Alcance**: solo la mitigación de la fuga. El OpenRouter completo (catálogo
  de modelos, precios, adaptador propio) sigue siendo el feature de Fase 2 con
  su decisión A/B/C pendiente.
- **Ruta**: delegada (writer trigger: provider + factory + test + config + CI).
- **Solución**: `OpenAIProvider` acepta un tercer parámetro `baseUrl` con el
  valor de OpenAI por defecto, así que los call sites existentes no cambian
  (verificados: `embedding.service.ts:62` y `:69` siguen yendo a OpenAI). Los
  cuatro caminos de request lo respetan: `generateText`, `embedText`,
  `listModels` y `validateKey`. El factory pasa `https://openrouter.ai/api/v1`.
- **Harness nuevo**: `packages/llm-providers` no tenía `tsconfig.json`, ni
  script `test`, ni `typecheck`, ni un solo test. Un guard ahí dentro no se
  habría ejecutado nunca, y CI corre frontend y backend como pasos explícitos
  (no hay script `test` en la raíz). Se añade vitest + tsconfig + ambos scripts
  y un paso en `ci.yml`.
- **Checks observados**:
  - `cd packages/llm-providers && pnpm test`: 1 archivo, 2 tests verdes.
  - `cd app/backend && pnpm test`: 16 archivos, 96 verdes (sin cambio).
  - `pnpm typecheck`: **6** workspaces verdes (antes 5; llm-providers ahora
    entra al chequeo), 0 errores.
  - **RED verificado**: con el cambio del factory revertido, el test de
    openrouter falla con `expected 'api.openai.com' to be 'openrouter.ai'`.
- **Commit**: `a702493`
- **Deuda detectada y NO arreglada**: los mensajes de error del provider siguen
  diciendo "openai" aunque esté hablando con OpenRouter (cosmético, pertenece
  al adaptador de Fase 2); y `llmConfig.service.ts:113` tiene su propio `fetch`
  a `api.openai.com/v1/models` al margen del provider.

### T4 — `disposition` y `npcSpecies` se aceptan y se descartan

- [x] **Estado**: cerrada
- **Defecto**: ambos campos existen en `schema.prisma` y en el Zod de
  `app/backend/src/routes/npcs.ts`, pero `npc.service.ts` no los mencionaba ni
  en `create` ni en `update`. La API respondía 201 y no guardaba nada.
- **Hallazgo adicional**: eran **tres** campos, no dos. `sourceType` también se
  descartaba: la ruta POST lo fija explícitamente a `"campaign"` y el servicio
  lo ignoraba. Hoy no se nota porque el default de Prisma coincide, pero
  cualquier otro valor se perdía en silencio.
- **Ruta**: **inline**. Writer trigger no disparado: una vez leído el servicio
  y el Zod de la ruta, es un cambio mecánico (añadir campos) más casos en un
  fichero de tests que ya existía.
- **Decisión**: `sourceType` se añade solo a `create`. La ruta PATCH no lo
  acepta, así que una rama en `update` sería inalcanzable; queda anotado en el
  código con el motivo.
- **Checks observados**:
  - `cd app/backend && pnpm test`: 16 archivos, **99 tests verdes** (96 → 99).
  - `pnpm typecheck`: 6 workspaces verdes.
  - **RED verificado**: con el servicio revertido, 2 de los 3 tests nuevos
    fallan con `expected 'neutral' to be 'enemy'`, que es exactamente el
    descarte silencioso. El tercero (default neutral) pasa contra el código
    viejo porque el default coincide: es guarda, no regresión.
- **Nota de idioma**: los tests se escribieron en castellano para seguir el
  estilo del fichero `npcs.test.ts` existente, no el default en inglés.
- **Commit**: `0bfed6c`

### T5 — Ollama y `log_change` prometen y fallan

- [x] **T5-A — Ollama**: cerrada (`2d3ca15`)
- [x] **T5-B — atribución del changelog**: cerrada (`98fcf1f`)
- **Decisión del usuario (tomada)**: se eligió **arreglar la atribución
  completa**, no la opción barata. No se recorta.

#### T5-A — Ollama

- **Defecto**: `factory.ts:23` lanzaba un `Error` plano para `ollama`, que
  `errorHandler.ts` convertía en un 500 genérico, pese a que la UI lo ofrece.
- **Hecho verificable en esta máquina**: Ollama está instalado y corriendo con
  `gemma3:4b`, y `GET localhost:11434/v1/models` responde en formato OpenAI.
  No es una afirmación de la documentación: se comprobó.
- **Solución**: una línea, ahora que `OpenAIProvider` acepta `baseUrl`.
- **Segundo defecto, encontrado SOLO por el smoke test**: `listModels` filtraba
  el catálogo a ids que empiezan por `gpt-4`, `gpt-3.5` u `o1`. Ese allowlist es
  específico de OpenAI, así que devolvía `[]` tanto para Ollama (`gemma3:4b`)
  como para **OpenRouter** (`anthropic/claude-3.5-sonnet`, `openai/gpt-4o`).
  O sea: el fix de T3 tapaba la fuga pero habría dejado el selector de modelos
  vacío. El test con `fetch` stubbeado no podía verlo. Ahora el filtro solo se
  aplica cuando la base URL es la de OpenAI.
- **Lección**: los tests de routing con `fetch` stubbeado prueban a dónde va la
  petición, no que el proveedor funcione. Para un backend real, smoke test.
- **Checks observados**: llm-providers 6/6; backend 99/99; typecheck 6 verdes.
  Contra el Ollama real: `listModels` devuelve `gemma3:4b` y `generateText`
  devuelve `"PONG\n"`.
- **Falso positivo propio**: el primer smoke test imprimió `res.text` y dio
  `undefined`; el provider devuelve `content`. El fallo era del script, no del
  código. Corregido antes de sacar ninguna conclusión.

#### T5-B — atribución del changelog

- **Defecto A**: el tool `log_change` del MCP llama `POST /api/changelog`, pero
  `routes/changeLog.ts` solo registra dos rutas `GET`. 404 garantizado. El body
  que manda ya tiene la forma correcta, incluido `authorType: "ai"`.
- **Defecto B (el de fondo)**: `POST /api/npcs:83` **sí** acepta `authorType`,
  así que las creaciones de la IA se atribuyen bien. Es el **PATCH** el que
  fuerza `"user"` — `npcs.ts:120` y lo mismo en `relations`, `sessions`,
  `locations`, `players`, `encounters` y `campaignRules`. Además el `reason`
  que manda `update_entity` lo descarta Zod en silencio por no ser `.strict()`.
  Resultado: el changelog atribuye al usuario lo que editó la IA.
- **Ruta**: delegada (writer trigger: 7 rutas, servicios y tests), más un cierre
  inline del padre en el MCP.
- **Solución**: nueva ruta `POST /api/changelog` validada con los schemas
  compartidos (`EntityTypeSchema`, `AuthorTypeSchema`), con 404 explícito si la
  campaña no existe en vez del 500 que daría la FK. La convención de
  `POST /api/npcs` se extrae a un helper compartido
  (`routes/changelogAttribution.ts`: `AttributionFields` + `resolveAttribution`)
  y se aplica a los PATCH de npcs, sessions, locations, factions, players,
  campaigns y al toggle de campaignRules. El default sigue siendo `"user"`.
- **Hueco que el writer dejó abierto y cerró el padre**: `update_entity` del MCP
  no mandaba `authorType`. El backend ya sabía honrarlo, pero el único llamador
  que edita como IA no lo pedía, así que el defecto habría sobrevivido al fix.
  Causa: mi brief decía "toca el mcp-server solo si la forma de la llamada lo
  necesita de verdad" y lo necesitaba. `authorType` se aplica **después** del
  spread de `updates`, para que un payload no pueda hacerse pasar por `"user"`.
- **Checks observados**:
  - backend: 18 archivos, **123 tests verdes** (99 → 123).
  - mcp-server: **24 verdes** (22 → 24).
  - llm-providers: 6 verdes. frontend: 176 verdes (con Node 22).
  - `pnpm typecheck`: 6 workspaces verdes.
  - **RED verificado dos veces**: el writer revirtió sus 10 ficheros fuente y
    obtuvo 16 fallos / 8 pases (los 8 son las guardas de retrocompatibilidad,
    que deben pasar). El padre revirtió la línea del MCP y obtuvo
    `expected undefined to be 'assistant'` y `expected 'user' to be 'assistant'`
    — este último es el guard anti-suplantación.
- **CI**: se añade el paso de tests del mcp-server, que existían y no se
  ejecutaban en CI.
- **Deuda anotada, NO arreglada**: siguen con `"user"` hardcodeado los caminos
  de create y delete (relations, campaignRules, encounters, players, documents,
  obsidian, y los `delete` de npc/campaign/locations/factions). Hoy ninguno
  tiene ruta de IA, por eso quedan fuera. Y conviven dos vocabularios:
  `AuthorTypeSchema` es `user|ai|system` mientras las rutas aceptan
  `user|assistant`; no se unificó a propósito, para no cambiar el contrato
  público en este commit.
- **Commit**: `98fcf1f`

## Entrega

- **Estrategia**: `ask-on-risk` (por defecto).
- **Previsión**: ~420 líneas autoras (adiciones + borrados), justo en el límite
  de ~400. La previsión es gruesa; en lugar de bloquear al usuario con la
  pregunta de encadenado antes de escribir una línea, se plantea cuando el
  recuento real cruce el presupuesto.
- **Recuento real final**: **884 líneas autoras** (813 adiciones + 71 borrados
  sobre `afe0680`, excluyendo `odd/` y el lockfile). La previsión inicial fue
  de ~420, así que se desvió más del doble.
- **Por qué se desvió**: **547 de esas líneas son tests**, en 6 ficheros. El
  plan preveía tests solo para T1; acabaron llevando tests T1, T3, T4, T5-A y
  T5-B, además de dos harnesses nuevos (`packages/llm-providers` y el paso de
  CI del mcp-server) que no existían. El código de producción son ~337 líneas,
  cerca de la previsión.
- **Pregunta de encadenado**: `ask-on-risk` manda plantearla al cruzar el
  presupuesto. Se deja planteada al usuario, sin bloquear: push, PR y merge
  están fuera de alcance por decisión suya, así que la estrategia de cadena
  (`stacked-to-main` o `feature-branch-chain`) solo hace falta si decide abrir
  PR. Corte natural si lo quiere partir: T1+T2 (pérdida de datos) por un lado,
  T3+T5-A (proveedores LLM) por otro, T4+T5-B (atribución) por un tercero.
- **Cortes de slice**: ninguno todavía.

## Progreso

- 2026-10-01 — documento creado antes de la primera escritura de código.
- 2026-10-01 — **T1 cerrada** (`75611e1`). Backend 96/96 en verde, typecheck
  verde, RED verificado contra el código con el bug.
- 2026-10-01 — **T2 cerrada** (`ddbecc0`). Verificada funcionalmente contra una
  SQLite poblada, porque la suite no cubre `initDatabase`.
- 2026-10-01 — **T3 cerrada** (`a702493`). Añade de paso el primer harness de
  tests de `packages/llm-providers` y su paso en CI.
- 2026-10-01 — **T4 cerrada** (`0bfed6c`). Resultaron ser tres campos
  descartados, no dos. Backend 99/99.

- 2026-10-01 — **T5-A cerrada** (`2d3ca15`). Ollama funciona contra la instancia
  real; de paso se arregla el catálogo de modelos para todo backend que no sea
  OpenAI, defecto que el fix de T3 habría dejado vivo.
- 2026-10-01 — **T5-B cerrada** (`98fcf1f`). El usuario eligió la atribución
  completa. Cierra también el hueco del MCP que el writer había dejado abierto.

## Estado final

Las cinco tareas cerradas, 9 commits en `fix/bloqueantes-revision-2026-10`,
nada pusheado.

Suites tras el último commit:

| Suite | Resultado |
| --- | --- |
| backend | 123 verdes (base 93) |
| frontend | 176 verdes (requiere Node 22) |
| mcp-server | 24 verdes (base 22) |
| llm-providers | 6 verdes (no existía la suite) |
| `pnpm typecheck` | 6 workspaces verdes (base 5) |

## Siguiente paso

Decisión del usuario: abrir PR (y entonces elegir estrategia de cadena, ver
Entrega) o seguir con los hallazgos de severidad alta que la revisión dejó
fuera de alcance — capa Zod muerta, índices de Prisma ausentes, accesibilidad
del frontend, `AppShell` fuera de `layout.tsx`, `routes/srd.ts`.

Pendiente menor sin relación: `graphify-out/` está sin trackear y no figura en
`.gitignore`.
