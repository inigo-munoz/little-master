#!/bin/bash
set -e

echo "=== D&D Campaign Assistant — Desktop Build ==="

echo "→ Installing dependencies..."
pnpm install

echo "→ Building frontend (static export)..."
cd app/frontend
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3001 pnpm build
cd ../..

echo "→ Bundling backend..."
bash scripts/bundle-backend.sh

echo "→ Downloading Node portable..."
bash scripts/download-node.sh

echo "→ Preparing Tauri resources..."
bash scripts/prepare-resources.sh

echo "→ Building Tauri app..."
cd app/desktop
source ~/.cargo/env 2>/dev/null || true
pnpm tauri build
cd ../..

echo ""
echo "=== Build complete ==="
echo "Installers:"
find app/desktop/src-tauri/target/release/bundle -type f \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' -o -name '*.msi' -o -name '*.dmg' \) -exec ls -lh {} \; 2>/dev/null
