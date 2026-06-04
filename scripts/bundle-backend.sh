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

echo "→ Generating Prisma client..."
npx prisma generate --schema=schema.prisma

echo "→ Ensuring Prisma engines for all Linux targets..."
node << 'NODESCRIPT'
const { download } = require('./node_modules/@prisma/fetch-engine');
const { existsSync, statSync } = require('fs');
const { join } = require('path');

const enginesVersion = require('./node_modules/@prisma/engines-version/package.json').prisma.enginesVersion;
const clientDir = join(process.cwd(), 'node_modules', '.prisma', 'client');
const targets = [
  'debian-openssl-1.1.x',  // Ubuntu 18.04, 20.04
  'debian-openssl-3.0.x',  // Ubuntu 22.04+, Debian 12+
  'rhel-openssl-1.0.x',    // RHEL/CentOS 7, old Fedora
  'rhel-openssl-3.0.x',    // Fedora 38+, RHEL 9+
];
const enginesDir = join(process.cwd(), 'node_modules', '@prisma', 'engines');

async function ensureEngine(binaryType, destDir, fileName, target) {
  const engineFile = join(destDir, fileName);
  if (existsSync(engineFile)) {
    const size = (statSync(engineFile).size / 1024 / 1024).toFixed(1);
    console.log(`  ✓ ${fileName} (${size}M)`);
    return;
  }
  console.log(`  → Downloading ${fileName}...`);
  await download({
    binaries: { [binaryType]: destDir },
    binaryTargets: [target],
    version: enginesVersion,
    showProgress: false,
    failSilently: false,
  });
  if (!existsSync(engineFile)) {
    console.error(`  ✗ ${fileName}: file missing after download`);
    process.exit(1);
  }
  const size = (statSync(engineFile).size / 1024 / 1024).toFixed(1);
  console.log(`  ✓ ${fileName} downloaded (${size}M)`);
}

async function main() {
  for (const target of targets) {
    // libquery-engine → .prisma/client/ (used by PRISMA_QUERY_ENGINE_LIBRARY)
    await ensureEngine(
      'libquery-engine', clientDir,
      `libquery_engine-${target}.so.node`, target
    );
    // schema-engine → @prisma/engines/ (used by PRISMA_SCHEMA_ENGINE_BINARY)
    await ensureEngine(
      'schema-engine', enginesDir,
      `schema-engine-${target}`, target
    );
  }
}

main().catch(e => { console.error('Engine fetch failed:', e.message); process.exit(1); });
NODESCRIPT

cd ..

echo "→ Backend bundled to $BACKEND_DIR/dist/server.js ($(du -h dist/server.js | cut -f1))"
echo "→ dist/ total: $(du -sh dist | cut -f1)"
