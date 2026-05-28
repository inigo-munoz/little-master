#!/bin/bash
set -e

BACKEND_DIR="app/backend"

echo "→ Bundling backend with esbuild..."
cd "$BACKEND_DIR"
npx esbuild src/server.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/server.js \
  --format=cjs \
  --external:@prisma/client \
  --external:.prisma/client \
  --external:pino \
  --external:pino-pretty

cat > dist/package.json << 'DISTPKG'
{
  "name": "dnd-assistant-backend",
  "private": true,
  "dependencies": {
    "@prisma/client": "5.22.0",
    "prisma": "5.22.0",
    "pino": "^9.1.0"
  }
}
DISTPKG

echo "→ Copying Prisma schema..."
cp prisma/schema.prisma dist/schema.prisma

echo "→ Installing production dependencies in dist/..."
cd dist
npm install --omit=dev 2>/dev/null
npx prisma generate --schema=schema.prisma 2>/dev/null
cd ..

echo "→ Backend bundled to $BACKEND_DIR/dist/server.js ($(du -h dist/server.js | cut -f1))"
echo "→ dist/ total: $(du -sh dist | cut -f1)"
