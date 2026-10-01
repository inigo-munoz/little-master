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

- [x] **Estado**: cerrada
- **Defecto**: el schema tenía 6 `@@index` en total, en `EntityRelation`,
  `ChangeLog` e `Issue`. SQLite no indexa claves foráneas por su cuenta, así
  que el resto de filtros eran escaneos completos. `DocumentChunk` no tenía
  ninguno, ni en `documentId`, y es la tabla más caliente.
- **Criterio**: cada índice justificado por una consulta real (`file:line`) y
  demostrado con `EXPLAIN QUERY PLAN`. Nada especulativo.
- **Ruta**: delegada (preparación + escritura: inventario de consultas en todo
  el backend antes de tocar el schema).
- **Resultado**: 10 índices nuevos y 1 reemplazado. Los compuestos van
  ordenados para que el `ORDER BY` lo sirva el índice, así que desaparece
  también el sort temporal, no solo el escaneo.
- **Evidencia reproducida por el padre** (no solo reportada), sobre una base
  de 6000 `DocumentChunk` y 4000 `ChangeLog`:

  | Consulta | Antes | Después |
  | --- | --- | --- |
  | chunks de un doc sin embedding, ordenados | `SCAN` + temp b-tree | `SEARCH ... USING INDEX` |
  | `count` por documento (N+1 de srd.ts) | `SCAN` | `SEARCH ... USING COVERING INDEX` |
  | cascade al borrar un `Document` | `SCAN` | `SEARCH ... USING INDEX` |
  | changelog por campaña, reciente primero | `SEARCH` + temp b-tree | `SEARCH`, sin temp b-tree |
  | **`search()` de cada mensaje de chat** | `SCAN` | **`SCAN`** |

- **Negativo honesto**: `search()` sigue siendo un escaneo completo, y no es un
  olvido. La mayoría de chunks son globales (`campaignId` NULL), así que la
  rama `OR campaignId IS NULL` devuelve casi toda la tabla y ningún índice
  ayuda. Su coste real es el `findMany` sin `take` que carga todos los
  `embeddingJson`: eso es una reescritura de consulta, no un índice.
- **Decisión migración vs `db push`**: no se añade fichero de migración. Nada
  aplica migraciones — la app, el Dockerfile, el `global-setup` de tests y la
  documentación usan `db push`; el único `prisma migrate` es un script manual.
  El directorio no tiene baseline y ya está desviado, así que un fichero nuevo
  sería peso muerto que da falsa confianza.
- **Checks observados**: backend 123/123; typecheck 6 verdes; `db push` **sin**
  `--accept-data-loss` sobre una copia poblada → exit 0 y las 6000 filas
  intactas (verificado por el padre). La base real del usuario no se tocó.
- **Fuera de alcance deliberado**: las restricciones `UNIQUE`. Las candidatas
  son `Player(campaignId, name)` y `Session(campaignId, sessionNumber)`, por
  las carreras de check-then-create. Se dejan porque una `UNIQUE` puede fallar
  al aplicarse contra una base del usuario que ya tenga duplicados, y con el
  arranque fail-fast de `ddbecc0` eso impediría abrir la app. Es una decisión
  suya, con ese riesgo explícito.
- **Commit**: `77dc5d1` (rama `perf/db-indexes`)

### U2 — `AppShell` montado en cada página

- [ ] **Estado**: en curso, delegada (rama `refactor/appshell-in-layout`)
- **Defecto**: `app/layout.tsx` solo renderiza `{children}`, y las 14 páginas
  envuelven su propio return en `<AppShell>`. Cada cambio de ruta remonta el
  splash "Iniciando…", relanza el health check contra el backend y pierde el
  estado local del `Sidebar`.
- **Comprobado antes de delegar**: son 14 de 15 páginas. La excepción,
  `app/page.tsx`, es un redirect de 10 líneas a `/campaigns` que devuelve
  `null`; envolverlo es inocuo y hasta preferible a una página en blanco.
  `AppShell` ya es `"use client"`, así que `layout.tsx` puede seguir siendo
  server component y conservar su export de `metadata`.
- **Riesgo de verificación**: el frontend **no tiene tests de componentes** —
  los 176 verdes son de funciones puras de `lib/`. No ejercitan este cambio.
  El check que vale aquí es `next build`, que detecta los errores de frontera
  cliente/servidor.
- **Commit**: _(pendiente)_

### U3 — Accesibilidad del frontend

Troceada en dos, porque son problemas distintos: uno es mecánico y el otro
pide una primitiva compartida.

**Superficie medida**: 73 `<label>` en 16 ficheros, 121 controles de
formulario, 21 overlays de modal en 15 ficheros.

#### U3a — Etiquetas sin control asociado

- [x] **Estado**: cerrada
- **Defecto**: `rg htmlFor` devolvía 0 en todo `src`. Un lector de pantalla no
  anunciaba el nombre de ningún campo, y hacer clic en la etiqueta no enfocaba
  su input.
- **Cambio de enfoque respecto al plan**: en vez de un barrido guiado por
  `rg`, se **activa la regla de lint** `jsx-a11y/label-has-associated-control`
  en `error`. `eslint-plugin-jsx-a11y` ya estaba instalado de forma transitiva
  vía `eslint-config-next`; `next/core-web-vitals` simplemente no activa esa
  regla. Dos ventajas: la herramienta da la lista exacta en vez de mi estimación,
  y el defecto queda **impedido para siempre** en vez de arreglado una vez.
- **Objetivo verificable**: lint pasa de **60 errores en 13 ficheros** a 0, con
  la regla todavía en `error`. (De los 73 labels, 13 ya cumplían porque
  envuelven su control.)
- **Riesgo vigilado**: ids duplicados. Varias páginas renderizan más de un
  formulario y repiten nombres de campo (`name`, `description`, `tags`); dos
  elementos con el mismo id serían un defecto peor que el original.
  **Verificado por el padre**: 50 ids literales, 0 repetidos en todo `src`, y
  57 `htmlFor` para 57 controles. Los componentes que se renderizan más de una
  vez (`SessionRow`, `RelationsPanel`) usan `useId`; los controles por fila de
  `encounter` van indexados por id de monstruo.
- **Dos arreglos del padre sobre el trabajo del writer**:
  1. En `settings` había puesto `aria-label={g.type}` en un `<label>` para
     contentar a la regla. Eso **sustituye** el nombre accesible por la clave
     cruda del enum (`npc`) en vez del texto legible que ya está dentro: es
     empeorar la accesibilidad para callar al linter. Se cambió a asociación
     explícita con `htmlFor` (el input sigue anidado, así que no cambia nada
     visual) y se subió `depth: 3` en la regla, porque el navegador calcula el
     nombre recorriendo todo el subárbol mientras la regla solo mira 2 niveles.
  2. Tres etiquetas apuntaban con `htmlFor` a controles **condicionales**
     (subclase de jugador, resumen y notas de sesión), así que en el otro
     estado el `htmlFor` quedaba colgando de un id inexistente. Ahora en ese
     estado se renderiza un `<span>` con las mismas clases (todas llevan
     `block`, así que no cambia el layout).
- **Checks observados**: lint **0 errores** con la regla en `error` y sin
  comentarios de desactivación (queda el warning de base del `any` en el e2e);
  `next build` compila y genera las 18 páginas; typecheck 6 verdes; 176 tests.
- **Commit**: `44e7bf8`

#### U3b-1 — Primitiva de modal (2 modales compartidos)

- [x] **Estado**: cerrada
- **Decisión de base**: el usuario delegó la elección. Se eligió **Radix
  Dialog** frente a (a) trampa de foco a mano y (b) `<dialog>` nativo. Razones:
  la trampa de foco es un problema de **corrección** y el proyecto no tiene un
  solo test de componentes que atrape una regresión ahí; Radix viene sin
  estilos, así que las clases Tailwind pasan literales; y el `<dialog>` nativo
  habría forzado reescribir el overlay en los 22 sitios por su top-layer y
  `::backdrop`. El argumento "sería la primera dependencia de UI" **se
  verificó y no se sostenía**: ya hay `lucide-react`, `react-markdown`,
  `clsx`, `swr` y `zustand`.
- **Troceado deliberado**: primero la primitiva sobre los 2 modales
  compartidos. Si estaba mal, mejor descubrirlo en 2 sitios que en 22.
- **Comprobado antes de delegar**: de los 22 `fixed inset-0`,
  `chat/page.tsx:96` **no es un modal** — es un captador de clic-fuera de un
  dropdown. Convertirlo en diálogo habría sido un error.
- **Estructura**: `Dialog.Content` va anidado dentro de `Dialog.Overlay`. No se
  asumió que fuera válido: está documentado por Radix ("Move the Dialog.Content
  inside Dialog.Overlay to enable scrolling"), consultado vía context7.
- **Verificación en navegador** (lo único que podía cerrar la duda, porque no
  hay tests de componentes), contra una **copia** de la base real:
  - El árbol de accesibilidad reporta `dialog` con nombre "Adjutora Maelis".
    Antes era un `div` anónimo.
  - Escape cierra. ✅ Clic en el fondo cierra. ✅
  - Tras 3 tabulaciones el foco sigue dentro (termina en "Añadir"): **trampa de
    foco confirmada**.
  - Consola limpia: la supresión con `aria-describedby={undefined}` funciona.
  - Aspecto equivalente, centrado correcto.
- **Hallazgo colateral que valida T2**: en modo dev el CLI de Prisma no se
  resuelve, así que `initDatabase` **nunca sincroniza el schema** y salta el
  mensaje nuevo. Si esas rutas se hubieran hecho fatales, `pnpm dev` quedaría
  roto. La decisión de dejarlas no fatales era correcta.
- **Checks**: `next build` 18 páginas; lint 0 errores; typecheck 6; 176 tests.
- **No verificado**: diálogos anidados (`WikiLink` abre un `DetailModal` dentro
  de otro). El NPC usado no tenía relaciones. Queda para U3b-2.
- **Commit**: `dbe94b4`

#### U3b-2 — Migrar los 19 modales inline de las páginas

- [x] **Estado**: cerrada. Troceada en dos tandas para validar antes de fanout.
- **Tanda A** (`5351f7d`): 11 modales de formulario de entidad en 8 ficheros.
- **Tanda B** (`5ca1bec`): 8 modales complejos — `encounter` (3),
  `players/detail` (4), `SpellsTab` (1).
- **Resultado**: solo quedan dos `fixed inset-0` en todo `src`: la propia
  primitiva y el captador de clic-fuera del dropdown de chat, que no es un
  modal.
- **Defecto arreglado de paso**: el `onKeyDown` sobre un `div` no enfocable de
  `encounter`, cuyo handler de Escape no podía dispararse nunca. Borrado, no
  portado.

**Regresiones del writer corregidas por el padre, todas en la primitiva y no
sitio a sitio** (la primitiva crece solo para conservar lo que ya existía):

| Regresión | Causa | Arreglo |
| --- | --- | --- |
| descripción de issues más pequeña y apagada | `subtitle` solo admitía `string` | `subtitle` acepta `ReactNode` |
| badges de documents salen del header a una franja | idem | idem, pasa su marcado |
| buscador de hechizos pierde el `autoFocus` | Radix mueve el foco al abrir | `initialFocusRef` vía `onOpenAutoFocus` |
| hoja inferior en móvil pasa a centrada | overlay con `items-center` fijo | prop `align`, que **sustituye** la clase (dos `items-*` las resuelve el orden del CSS, no el de la cadena) |

**Diferencias aceptadas a propósito** (mejoras, no regresiones): los modales de
campañas e issues ganan una X para cerrar que no tenían; el título de las
confirmaciones pasa de `h3` a `h2` vía `Dialog.Title`; y el fondo del
buscador de hechizos pasa de `bg-black/60` al `/70` compartido, diferencia
imperceptible que además unifica los overlays.

**Verificado en navegador** (contra copia de la base real, la original
intacta): el visor de documentos reporta `dialog` con los badges de vuelta
bajo el título; dentro del formulario de facciones los cinco campos reportan
su nombre accesible, o sea que las etiquetas de U3a sobrevivieron a que les
movieran el marcado; y la confirmación de guardar ficha reporta `dialog` con
**nombre y descripción** accesibles, lo que valida el cableado de
`hasDescription` + `ModalDescription`.

**NO verificado en navegador, dicho sin adornos**: los dos arreglos de
`SpellsTab` (foco inicial y hoja inferior) están comprobados solo leyendo. No
se pudo llegar al modal porque la ficha oculta su pestaña de Magia para ese
personaje — la ficha carga "Bardo" en el desplegable aunque el personaje sea
Mago. **Eso es un bug previo** (el `formInitialized` que ya señaló la
auditoría del frontend), no introducido aquí, y queda anotado sin perseguir.
Tampoco se verificaron los diálogos anidados de `WikiLink`.
- **Defecto**: `rg 'role="dialog"'` y `rg aria-modal` devuelven 0. Ningún
  modal se anuncia como diálogo, ninguno atrapa ni restaura el foco. El de
  `encounter/page.tsx:962` además pone `onKeyDown` en un `div` no enfocable,
  así que su handler de Escape no puede dispararse nunca.
- **Enfoque previsto**: una primitiva compartida, no 21 parches. Ya existen
  `ConfirmModal` y `DetailModal` como punto de partida, y ambos ya manejan
  Escape con un listener a nivel de documento, que es la forma correcta.
- **Commit**: _(pendiente)_

### U4 — Capa Zod muerta de `@dnd/domain`

- [x] **Estado**: cerrada. **Commit**: `097b53f` (rama `refactor/zod-domain-layer`)
- **Dato**: 23 schemas exportados; solo `AssistantModeSchema` se ejecuta en
  runtime (`routes/chat.ts:14`). Tres más se consumen solo como tipo
  (`CreateNpc`, `CreateCampaign`, `LlmProvider`) y sus rutas revalidan con un
  `z.object` inline al lado. Los 19 restantes no se referencian desde ningún
  sitio. El frontend se redeclara a mano `Session`, `Npc` y `LlmConfigPublic`
  en `lib/api.ts`.
- **Decisión del usuario**: opción **mixta** — conectar los tres que ya se
  importaban como tipo (donde hay drift demostrado) y borrar los 19 sin
  referencias. Era la que más valor daba por diff.
- **Resultado**: `packages/domain/src/entities/index.ts` pasa de **359 a 105
  líneas**; quedan 4 schemas exportados. Diff total: 5 ficheros, **+27/−333**.
- **La conexión compone, no sustituye**, para que lo de transporte se quede en
  la ruta: `POST /npcs` usa
  `CreateNpcSchema.omit({sourceType}).extend({authorType, traits, actions, ...})`
  porque la ruta acepta entradas de stat block en string u objeto y las
  normaliza. `POST /campaigns` usa `CreateCampaignSchema` directo.
- **Premisa mía que resultó FALSA, y el writer la corrigió**: le dije que
  `LlmProviderSchema` sin `openai-codex` era drift a arreglar. Fue a mirarlo:
  las rutas de clave **hoy rechazan** `openai-codex` con 400, porque Codex se
  configura por `/oauth/*`. Añadirlo al enum y conectar sin más habría
  **ampliado** la API. Resuelto con
  `LlmProviderSchema.exclude(["openai-codex"])`: el tipo cuadra con
  `SupportedProvider` y la superficie HTTP queda idéntica. Verificado por el
  padre contra `git show HEAD:` del fichero anterior.
- **Relajación deliberada y aceptada**: el dominio marca los opcionales como
  `.optional().nullable()` y las rutas solo `.optional()`, así que un `null`
  explícito en un campo opcional de NPC o campaña ahora pasa donde antes daba
  400. **Ensancha, no estrecha**: ningún llamador existente se rompe, los
  servicios ya hacen `?? null`, y los campos obligatorios no cambian. Se
  acepta porque la regla que se dio era precisamente "si la API acepta algo
  hoy, que lo siga aceptando; se ensancha el schema, no se estrecha la ruta".
- **También borrado de `@dnd/shared`** lo que no tenía ningún consumidor:
  `AUTHORITY_MAP`, `SourceMetaSchema`, `ApiSuccessSchema`, `ApiErrorSchema`,
  `PaginationQuerySchema` y `PaginatedResponseSchema`. Los enums se conservan
  porque los usan los schemas supervivientes y el backend. El `ApiError` del
  frontend es una clase local, no el tipo borrado.
- **Checks observados**: backend 123, mcp-server 24, llm-providers 6, frontend
  176, typecheck 6 workspaces, lint sin cambios. **Ningún test se tocó.**
- **Verificado por el padre**: ningún schema borrado se referencia en `app/` ni
  `packages/` (barrido `rg -w` de los 19 nombres).

## Entrega

- **Estrategia**: una rama por tarea, apiladas. Evita repetir el problema de la
  tanda anterior, que acabó en 884 líneas en una sola rama.
- **Recuento real**: una rama por tarea, todas locales:
  `perf/db-indexes` (`77dc5d1`), `refactor/appshell-in-layout` (`d5c7aae`),
  `a11y/form-labels` (`44e7bf8`), `a11y/modal-dialog-semantics` (`dbe94b4`).

## Progreso

Documento creado el 2026-10-01. U1 delegada.

## Estado final

Las cuatro tareas cerradas, en cinco ramas apiladas y **locales**:

| Rama | Commit | Qué |
| --- | --- | --- |
| `perf/db-indexes` | `77dc5d1` | 11 índices con evidencia de `EXPLAIN` |
| `refactor/appshell-in-layout` | `d5c7aae` | el shell monta una sola vez |
| `a11y/form-labels` | `44e7bf8` | 60 → 0, con la regla en `error` |
| `a11y/modal-dialog-semantics` | `dbe94b4`, `5351f7d`, `5ca1bec` | primitiva + los 19 modales |
| `refactor/zod-domain-layer` | `097b53f` | 3 conectados, 19 borrados |

## Siguiente paso

Decisión del usuario: abrir PRs (una rama por asunto, ya separadas) o seguir
con lo que la revisión dejó fuera de alcance — `routes/srd.ts` con 650 líneas
de parsing dentro de un fichero de rutas, el `findMany` sin `take` de
`embedding.service.ts`, el N+1 de `buildDocumentList`, los dos vocabularios de
`authorType`, y el bug previo del `formInitialized` en la ficha de personaje
(carga la clase equivocada y esconde la pestaña de Magia).
