#!/bin/bash
set -e

RESOURCES="app/desktop/src-tauri/resources"

echo "→ Preparing Tauri resources..."

rm -rf "$RESOURCES"
mkdir -p "$RESOURCES/prisma"

# Backend dist (bundle + node_modules with Prisma + pino)
cp -r app/backend/dist "$RESOURCES/backend"

# Prisma migrations + schema
cp -r app/backend/prisma/migrations "$RESOURCES/prisma/" 2>/dev/null || echo "  No migrations dir"
cp app/backend/prisma/schema.prisma "$RESOURCES/prisma/"

# SRD content for first-run seed (CC-BY-4.0 only — no PHB/MM)
mkdir -p "$RESOURCES/seed/srd"
cp -r data/srd/en "$RESOURCES/seed/srd/"

# DM core rules — user-specific homebrew_external documents
mkdir -p "$RESOURCES/seed/core-rules"
cp data/core-rules/*.md "$RESOURCES/seed/core-rules/"

echo "→ Resources ready:"
du -sh "$RESOURCES"/*
