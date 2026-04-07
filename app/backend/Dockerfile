FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copiar configuración del workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copiar paquetes compartidos y el backend
COPY packages/ packages/
COPY app/backend/ app/backend/

# Instalar dependencias (solo backend y sus dependencias workspace)
RUN pnpm install --filter backend... --frozen-lockfile

# Generar cliente Prisma
RUN cd app/backend && npx prisma generate

# Compilar TypeScript
RUN cd app/backend && pnpm build

EXPOSE 3001

# Aplicar schema de BD y arrancar
CMD ["sh", "-c", "cd app/backend && npx prisma db push --skip-generate && node dist/server.js"]
