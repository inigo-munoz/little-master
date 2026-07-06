# Contribuir a Little Master

¡Gracias por tu interés! Little Master es una app de escritorio para Game Masters,
con licencia MIT. Estas son las pautas para contribuir.

## Antes de empezar

- Abrí un issue describiendo el bug o la propuesta antes de mandar un PR grande, así
  evitamos trabajo duplicado.
- Los cambios pequeños (typos, fixes obvios) pueden ir directo a un PR.

## Setup de desarrollo

```bash
pnpm install

cd app/backend
cp .env.example .env
openssl rand -hex 32   # pegar el resultado en ENCRYPTION_KEY del .env
pnpm db:push
npx tsx src/db/setup.ts

cd ../frontend
echo 'NEXT_PUBLIC_BACKEND_URL=http://localhost:3001' > .env.local

pnpm dev   # backend + frontend en paralelo
```

Requisitos: Node.js 20.19+ o 22.12+, pnpm 9+, y Rust toolchain para compilar la app
de escritorio.

## Antes de abrir un PR

CI corre en cada pull request (`.github/workflows/ci.yml`) y debe pasar en verde.
Corré lo mismo localmente antes de pushear:

```bash
pnpm typecheck
pnpm lint
cd app/frontend && pnpm test
cd ../backend  && pnpm test
```

## Contenido y licencias

**Regla permanente e innegociable: contenido de manuales con copyright JAMÁS se
commitea.** El repositorio es público (MIT) y solo incluye el SRD 5.2.1 (CC-BY-4.0).
El contenido propio del usuario (PHB/DMG/Monster Manual) vive en `data/private/`,
que está en `.gitignore`. No subas ese contenido en un PR.

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
`docs:`, `refactor:`, `ci:`, `chore:`, etc. Un cambio lógico por commit.

## Código

- TypeScript estricto en todo el monorepo.
- El frontend nunca llama `fetch()` directo: todas las llamadas HTTP van por
  `app/frontend/src/lib/api.ts`.
- Seguí los patrones existentes del área que tocás (rutas Fastify como plugins,
  componentes con SWR + Tailwind, funciones de cálculo puras y testeables).
