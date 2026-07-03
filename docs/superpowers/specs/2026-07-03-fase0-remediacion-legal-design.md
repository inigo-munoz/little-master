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

- Nuevo script versionado `scripts/build-srd-spells.ts` que regenera `data/srd/en/09_Hechizos.md` en **inglés** a partir de los `.txt` del SRD 5.2.1 incluidos en el repo.
- Mantiene el formato actual (headers `##`, stats en una línea, tags `[C]`/`[Ritual]`) para no romper el parser del seed ni el contrato de `SpellFullData`.
- Header del fichero con atribución CC-BY-4.0 correcta y sin mención a traducciones PHB.
- Criterio de aceptación: los tests de backend y el smoke test de seed pasan; `GET /api/spells/Fireball` devuelve datos completos.

### 3. Purga del historial

- Herramienta: `git-filter-repo` (ejecutado sobre un clon fresco).
- Rutas a eliminar de todo el historial: `data/phb2024/` (completo) y `data/srd/en/09_Hechizos.md` (todas las versiones — la versión limpia regenerada se commitea DESPUÉS de la reescritura, para que el filtrado por ruta no la elimine).
- Force-push de `main` y de los tags reescritos a `origin`.
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
2. Preparar en local (sin commitear a `main` todavía): script `build-srd-spells.ts`, `09_Hechizos.md` regenerado en inglés, mecanismo `data/private/` con migración del import PHB, LICENSE, NOTICE y ajustes de README. Tests verdes en local.
3. Purga del historial con `git-filter-repo` sobre un clon fresco.
4. Commitear sobre el historial reescrito los cambios preparados en el paso 2 (incluida la versión limpia de `09_Hechizos.md`).
5. Force-push de `main` y tags a `origin`.
6. Borrado de releases contaminadas (v1.1.16–v1.1.20) + release limpia v1.2.0.

La preparación (paso 2) va antes de la purga para que entre el force-push y la release limpia no haya una ventana con el repo roto; la versión limpia de `09_Hechizos.md` se commitea después de la reescritura para que el filtrado por ruta no la elimine.

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
