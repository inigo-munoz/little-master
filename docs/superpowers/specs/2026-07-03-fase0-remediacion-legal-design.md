# Fase 0 — Remediación legal del contenido con copyright

**Fecha:** 2026-07-03
**Estado:** diseño aprobado, pendiente de plan de implementación
**Contexto:** primera fase del roadmap de publicación open source (opción A: legal primero → publicación temprana → features en abierto).

## Problema

El repositorio `github.com/inigo-munoz/little-master` es **público** y contiene contenido del Player's Handbook 2024 (copyright Wizards of the Coast):

1. `data/phb2024/` — 11 ficheros con contenido PHB completo en español (clases, especies, trasfondos, hechizos, dones, equipo, reglas, multiverso, criaturas, glosario). En el historial desde el commit `8bb0376`.
2. `data/srd/en/09_Hechizos.md` — 307 hechizos cuya prosa usa las traducciones del PHB 2024 (305 en español). Añadido ya traducido en el commit `a1b6ef8`; no existe versión limpia en el historial.
3. **Releases v1.1.16–v1.1.20** — `scripts/prepare-resources.sh` empaqueta `data/srd/en/` en los binarios de escritorio, por lo que los artefactos publicados contienen el texto PHB.

Los ficheros `data/srd/en/*.txt` provienen del SRD 5.2.1 (CC-BY-4.0) y son legítimos.

## Objetivo

Repositorio y releases públicos sin ningún contenido con copyright de WotC, manteniendo intacta la funcionalidad local del usuario (que puede seguir importando sus propios manuales de forma privada).

## Diseño

### 1. Backup previo (bloqueante)

- `git bundle` completo del repo (todas las ramas y tags) fuera del árbol de trabajo.
- Copia de `data/phb2024/` y del `09_Hechizos.md` actual a una ubicación privada fuera del repo (se reutilizarán como contenido privado local).

### 2. Seed limpio (antes de la purga)

- Nuevo generador versionado (`app/backend/src/db/srd-spells-builder.ts` + CLI) que produce un fichero de hechizos en **inglés** a partir de `data/srd/en/06_Trasfondos_y_Equipo.txt` (sección "Spell Descriptions", la única fuente SRD con descripciones completas; `04`/`05_Hechizos_*.txt` no las contienen pese a su nombre).
- El fichero generado usa un **nombre nuevo**: `data/srd/en/09_Spells.md`. Esto desacopla la purga (la ruta vieja `09_Hechizos.md` se elimina completa del historial) del fichero limpio (que se commitea con normalidad, sin coreografía post-reescritura). `SRD_SECTIONS` en `srd-import.ts` se actualiza al nuevo filename.
- Mantiene el formato que espera `parseSpellDocument` (headers `##`, línea de tipo, stats en una línea, tags `[C]`/`[Ritual]`, `*Higher Level:*`/`*Cantrip Upgrade:*`) — el parser ya es bilingüe, la rama inglesa existe.
- Header del fichero con atribución CC-BY-4.0 correcta y sin mención a traducciones PHB.
- Se añaden tests del parser de hechizos (hoy inexistentes) y del generador.
- Criterio de aceptación: los tests de backend y el smoke test de seed pasan; `GET /api/spells/Fireball` devuelve datos completos en inglés.

### 3. Purga del historial

- Herramienta: `git-filter-repo` (con backup previo en git bundle).
- Rutas a eliminar de todo el historial: `data/phb2024/` (completo) y `data/srd/en/09_Hechizos.md` (todas las versiones — el reemplazo limpio vive en la ruta nueva `09_Spells.md`, así que el filtrado por ruta no lo afecta).
- Force-push de `main` a `origin`. Los tags antiguos NO se re-publican: las releases v1.1.x se eliminan con sus tags y la numeración continúa en v1.2.0 sobre el historial limpio.
- Verificación posterior: `git log --all` sin rastro de las rutas purgadas; búsqueda de texto PHB conocido en todo el historial con resultado vacío.

### 4. Releases

- Borrar las releases v1.1.16–v1.1.20 y sus artefactos (contienen PHB embebido).
- Publicar una release nueva (v1.2.0) construida desde el historial limpio con el seed SRD en inglés.

### 5. Contenido privado local ("bring your own content")

- Nuevo directorio `data/private/` añadido a `.gitignore`, con subcarpetas por fuente: `data/private/phb2024/`, `data/private/dmg2024/`, etc.
- `phb-import-cli.ts` pasa a leer de `data/private/phb2024/` (con mensaje de error claro si el directorio no existe o está vacío).
- El contenido PHB respaldado en el paso 1 se mueve ahí: el usuario conserva exactamente la misma funcionalidad local.
- El futuro importador del DMG 2024 (fase posterior del roadmap) usará este mismo mecanismo.
- Documentación en README: cómo importar manuales propios de forma privada, dejando claro que ese contenido nunca debe commitearse.

### 6. Licencia y marca

- **Licencia del proyecto: MIT** (`LICENSE` en la raíz).
- Aviso de atribución del SRD 5.2.1 (CC-BY-4.0) en README y/o `NOTICE`.
- README y UI evitan marcas de WotC ("D&D", "Dungeons & Dragons", "Player's Handbook") como identidad del producto; se usa la fórmula "compatible with 5e".

## Orden de ejecución

1. Backup (git bundle + copia privada del contenido PHB).
2. Preparar y commitear en local (SIN push): generador + `09_Spells.md` en inglés + tests, retirada de `09_Hechizos.md` y `data/phb2024/` del árbol, mecanismo `data/private/` con migración del import PHB, LICENSE, NOTICE y ajustes de README. Tests verdes en local.
3. Purga del historial con `git-filter-repo` (los commits del paso 2 no tocan las rutas purgadas, así que sobreviven intactos).
4. Force-push de `main` a `origin`.
5. Borrado de TODAS las releases y tags antiguos (sus binarios embeben PHB) + release limpia v1.2.0.

La regla operativa clave: **ningún push a origin hasta después de la purga.**

## Riesgos y mitigaciones

- **Pérdida de historial local ante error de filter-repo** → git bundle previo; filter-repo se ejecuta sobre un clon fresco.
- **Clones/forks existentes del repo público conservan el contenido** → no controlable técnicamente; se minimiza actuando pronto. Verificar si existen forks (`gh api repos/.../forks`).
- **Regresión del parser de hechizos con la prosa en inglés** → los tests de `srd.test.ts` y el smoke test cubren el contrato; muestreo manual de 4 hechizos como en VERIFY-REPORT.
- **CI/workflows referencian tags reescritos** → revisar `release.yml` tras el force-push.
- **32 hechizos ausentes del SRD por corrupción de columnas del PDF** → se acepta el mismo 90.6% ya validado; queda como issue pública para completarlos a mano desde el SRD.

## Fuera de alcance de esta fase

- Importador del DMG 2024 (fase posterior; usará `data/private/`).
- Ollama, OpenRouter, export de Obsidian, mejoras UX (fases posteriores del roadmap).
- Firma/notarización de binarios (fase "publicable mínimo").
