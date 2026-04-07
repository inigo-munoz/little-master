FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copiar configuración del workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copiar paquetes compartidos y el mcp-server
COPY packages/ packages/
COPY app/mcp-server/ app/mcp-server/

# Instalar dependencias
RUN pnpm install --filter mcp-server... --frozen-lockfile

# Compilar TypeScript
RUN cd app/mcp-server && pnpm build

EXPOSE 3002

CMD ["sh", "-c", "cd app/mcp-server && node dist/index.js"]
