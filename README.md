# Little Master

Asistente de escritorio para Dungeon Masters. Compatible con las reglas 5E (2024). Gestiona campañas, NPCs, sesiones, encuentros y reglas con ayuda de IA. Tus datos nunca salen de tu máquina.

## Funcionalidades

- Gestión completa de campañas: sesiones, NPCs, jugadores, localizaciones y facciones
- Fichas de personaje compatibles con las reglas 5E (2024) (habilidades, hechizos, combate, dones, ASI)
- Monster Manual 2024 integrado (607 criaturas con stats completos)
- Generador de encuentros con cálculo de dificultad por CR
- Asistente IA con 5 modos: Rule Reviewer, Archivista, Designer, Auditor, Session Director
- Búsqueda semántica sobre documentos, reglas y monstruos
- SRD 5.2.1 indexado para consultas de reglas; importación opcional de tus propios manuales (ver sección Contenido propio)
- Exportación PDF: NPCs, sesiones, localizaciones, facciones y resumen de campaña
- Integración bidireccional con Obsidian (importación/exportación)
- Bring your own API key (OpenAI, Anthropic, OpenRouter)
- Datos 100% locales — nada sale de tu máquina

## Instalación (app de escritorio)

Descargá el instalador de tu plataforma desde [Releases](../../releases/latest):

| Plataforma | Formato |
|-----------|---------|
| Linux | `.deb`, `.rpm` |
| macOS (ARM) | `.dmg` |
| Windows | `.msi`, `.exe` |

### Primer inicio

1. Abrí la aplicación — la base de datos se inicializa automáticamente
2. Andá a **Settings** → sección *LLM Provider* → agregá tu API key de OpenAI o Anthropic
3. Andá a **Settings** → sección *Semantic Search* → pulsá **Embed All** para indexar el contenido
4. Creá tu primera campaña en **Campaigns**

## Desarrollo local

### Requisitos

- Node.js 20+
- pnpm 9+
- Rust toolchain (para compilar Tauri)

### Setup

```bash
pnpm install

cd app/backend
cp .env.example .env
openssl rand -hex 32   # pegar el resultado en ENCRYPTION_KEY del .env
pnpm db:push
npx tsx src/db/setup.ts

cd ../frontend
echo 'NEXT_PUBLIC_BACKEND_URL=http://localhost:3001' > .env.local
```

### Desarrollo

```bash
pnpm dev              # backend + frontend en paralelo
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Importar contenido

```bash
cd app/backend
pnpm mm:import        # Monster Manual 2024 (607 criaturas, incluido en el repo)
pnpm phb:import       # Importa tus propios manuales desde data/private/ (ver Contenido propio)
```

### Build de la app desktop

```bash
bash scripts/build-desktop.sh
```

Los instaladores se generan en `app/desktop/src-tauri/target/release/bundle/`.

## Arquitectura

```
app/
  backend/      Fastify 5 + Prisma 5 + SQLite (puerto 3001)
  frontend/     Next.js 15 App Router        (puerto 3000)
  desktop/      Tauri v2 — wrapper desktop
  mcp-server/   MCP tools server (Fastify)   (puerto 3002)

packages/
  domain/         Schemas Zod de entidades
  shared/         AppError, tipos compartidos, info de producto
  llm-providers/  Adaptadores OpenAI, Anthropic + prompts

data/             Datos locales del usuario (gitignored)
```

## Seguridad

- API keys cifradas con AES-256-GCM (PBKDF2 con sal por registro)
- API keys nunca se devuelven al frontend en texto plano
- CORS restringido al origen de la aplicación
- `ENCRYPTION_KEY` se genera automáticamente en la app desktop

## Contenido propio

El repositorio solo incluye contenido bajo licencia SRD 5.2.1 (CC-BY-4.0). Si querés indexar tus propios manuales de reglas en markdown, colocá los archivos en `data/private/phb2024/` — ese directorio está en `.gitignore` y nunca se commitea. Después importalos con:

```bash
cd app/backend
pnpm phb:import
```

Ese contenido es solo para tu uso local: no lo compartas ni lo subas al repositorio.

## Licencia

El código de Little Master está bajo licencia MIT (ver [LICENSE](LICENSE)).

El contenido de reglas incluido (SRD 5.2.1) pertenece a Wizards of the Coast LLC y está licenciado bajo Creative Commons Attribution 4.0 International (CC-BY-4.0). Ver [NOTICE](NOTICE) para la atribución completa.

Little Master es un proyecto independiente, sin afiliación ni respaldo de Wizards of the Coast LLC.

## Release

Los instaladores multiplataforma se generan automáticamente con GitHub Actions al crear un tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Esto dispara el workflow que buildea en Linux, macOS y Windows, y sube los instaladores al GitHub Release.
