FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}

# Copiar configuración del workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copiar paquetes compartidos y el frontend
COPY packages/ packages/
COPY app/frontend/ app/frontend/

# Instalar dependencias
RUN pnpm install --filter frontend... --frozen-lockfile

# Build de producción de Next.js
RUN cd app/frontend && pnpm build

EXPOSE 3000

CMD ["sh", "-c", "cd app/frontend && pnpm start"]
