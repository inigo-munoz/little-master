#!/bin/bash
set -e

BACKEND_DIR="app/backend"

echo "→ Generating Prisma Client..."
cd "$BACKEND_DIR"
npx prisma generate

echo "→ Bundling backend with esbuild..."
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

echo '{}' > dist/package.json

echo "→ Backend bundled to $BACKEND_DIR/dist/server.js ($(du -h dist/server.js | cut -f1))"
