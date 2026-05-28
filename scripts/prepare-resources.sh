#!/bin/bash
set -e

RESOURCES="app/desktop/src-tauri/resources"

echo "→ Preparing Tauri resources..."

mkdir -p "$RESOURCES/backend"
mkdir -p "$RESOURCES/prisma"

cp app/backend/dist/server.js "$RESOURCES/backend/"
echo '{}' > "$RESOURCES/backend/package.json"

# Prisma query engine + generated client
PRISMA_ENGINE_DIR=$(find node_modules/.pnpm -path '*@prisma+engines*' -name 'libquery_engine-*' -print -quit 2>/dev/null | xargs dirname 2>/dev/null || true)

if [ -n "$PRISMA_ENGINE_DIR" ]; then
  mkdir -p "$RESOURCES/backend/node_modules/@prisma/engines"
  cp "$PRISMA_ENGINE_DIR"/libquery_engine-* "$RESOURCES/backend/node_modules/@prisma/engines/" 2>/dev/null || true
  cp "$PRISMA_ENGINE_DIR"/schema-engine-* "$RESOURCES/backend/node_modules/@prisma/engines/" 2>/dev/null || true
  echo "  Prisma engines copied from $PRISMA_ENGINE_DIR"
fi

# @prisma/client runtime
PRISMA_CLIENT_DIR=$(find node_modules/.pnpm -path '*@prisma+client*' -name 'runtime' -type d -print -quit 2>/dev/null || true)
if [ -n "$PRISMA_CLIENT_DIR" ]; then
  mkdir -p "$RESOURCES/backend/node_modules/@prisma/client"
  cp -r "$PRISMA_CLIENT_DIR" "$RESOURCES/backend/node_modules/@prisma/client/runtime"
  echo "  Prisma client runtime copied"
fi

# Generated Prisma client
GENERATED_DIR=$(find node_modules/.pnpm -path '*@prisma+client*' -name '.prisma' -type d -print -quit 2>/dev/null || true)
if [ -z "$GENERATED_DIR" ]; then
  GENERATED_DIR="app/backend/node_modules/.prisma"
fi
if [ -d "$GENERATED_DIR" ]; then
  mkdir -p "$RESOURCES/backend/node_modules/.prisma"
  cp -r "$GENERATED_DIR/client" "$RESOURCES/backend/node_modules/.prisma/client"
  echo "  Generated Prisma client copied"
fi

# Pino (external dependency)
PINO_DIR=$(find node_modules/.pnpm -path '*pino@*' -name 'pino' -type d -not -path '*pino-pretty*' -not -path '*pino-abstract*' -not -path '*pino-std*' -print -quit 2>/dev/null || true)
if [ -n "$PINO_DIR" ]; then
  mkdir -p "$RESOURCES/backend/node_modules/pino"
  cp -r "$PINO_DIR"/* "$RESOURCES/backend/node_modules/pino/"
  echo "  Pino copied"
fi

# Prisma migrations
cp -r app/backend/prisma/migrations "$RESOURCES/prisma/" 2>/dev/null || echo "  No migrations dir"
cp app/backend/prisma/schema.prisma "$RESOURCES/prisma/"

echo "→ Resources ready:"
du -sh "$RESOURCES"/*
