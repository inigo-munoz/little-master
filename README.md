# D&D Campaign Assistant

Sistema local-first de gestión de campañas D&D con asistente de IA.

---

## Instalación rápida (Docker)

### Requisitos
- [Docker Desktop](https://www.docker.com/get-started) (incluye Docker Compose)

### Instalación

```bash
git clone <repo>
cd dnd-assistant
bash scripts/setup.sh
```

El script:
1. Verifica que Docker está instalado
2. Genera el fichero `.env` con una clave de cifrado segura
3. Construye y arranca los tres servicios con `docker compose up --build`

### Primera configuración

1. Abre **http://localhost:3000**
2. Ve a **Settings** → sección *LLM Provider* → añade tu API key de OpenAI o Anthropic
3. Ve a **Settings** → sección *SRD 5.2.1* → pulsa **Importar SRD**
4. Crea tu primera campaña en **Campaigns**

---

## Instalación manual (desarrollo)

### Requisitos

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- openssl (para generar la clave de cifrado)

### Setup inicial

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar el backend
cd app/backend
cp .env.example .env
# Editar .env y reemplazar ENCRYPTION_KEY:
openssl rand -hex 32   # pegar el resultado en ENCRYPTION_KEY

# 3. Inicializar la base de datos
pnpm db:push
npx tsx src/db/setup.ts

# 4. Variables de entorno del frontend
cd ../frontend
echo 'NEXT_PUBLIC_BACKEND_URL=http://localhost:3001' > .env.local
```

### Arranque

```bash
# Desde la raíz del proyecto:
pnpm dev          # backend + frontend en paralelo
pnpm dev:mcp      # MCP server (opcional, en otra terminal)
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:3001
- MCP:      http://localhost:3002

---

## Arquitectura

```
app/
  backend/     Fastify 4 + Prisma 5 + SQLite (puerto 3001)
  frontend/    Next.js 14 App Router      (puerto 3000)
  mcp-server/  MCP tools server (Fastify) (puerto 3002)

packages/
  shared/         tipos compartidos, error codes
  domain/         entidades Zod
  llm-providers/  adaptadores OpenAI, Anthropic

data/             datos locales del usuario (no commitear)
  documents/      archivos de documentos subidos
  logs/           logs de aplicación
```

## Seguridad

- Las API keys **nunca** se almacenan en texto plano — AES-256-GCM
- Las API keys **nunca** se devuelven al frontend
- CORS: solo acepta peticiones de `http://localhost:3000`
- `ENCRYPTION_KEY` debe generarse una vez y mantenerse segura

## Planes y licencias

| Plan | Límites |
|------|---------|
| Gratuito | 1 campaña, 50 mensajes/mes, sin PDF, sin Obsidian |
| DM | Sin límites de campaña, PDF, mensajes ilimitados |
| DM + Obsidian | Todo lo anterior + sincronización bidireccional con Obsidian |

Activa tu licencia en **Settings → Licencia**.

## Sprints completados

| Sprint | Contenido |
|--------|-----------|
| 1 | Base: monorepo, backend, frontend, SQLite, campañas, sessions, docs, chat |
| 2 | Embeddings, búsqueda semántica vectorial, indexación |
| 3 | Upload de documentos, PDF mejorado, sessions, factions |
| 4 | MCP tools completas, inyección de estado de campaña en chat |
| 5 | Docker, sistema de licencias, planes y límites |
