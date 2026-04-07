#!/usr/bin/env bash
set -euo pipefail

# ─── Colores ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== D&D Campaign Assistant — Setup ===${NC}"

# ─── 1. Verificar Docker ──────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${RED}Error: Docker no está instalado.${NC}"
  echo "Instala Docker Desktop desde https://www.docker.com/get-started"
  exit 1
fi

if ! command -v docker compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
  echo -e "${RED}Error: Docker Compose no está disponible.${NC}"
  echo "Actualiza Docker Desktop o instala el plugin docker-compose."
  exit 1
fi

echo -e "${GREEN}✓ Docker detectado: $(docker --version)${NC}"

# ─── 2. Crear .env desde .env.example ────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$ROOT_DIR/.env" ]; then
  if [ -f "$ROOT_DIR/app/backend/.env.example" ]; then
    cp "$ROOT_DIR/app/backend/.env.example" "$ROOT_DIR/.env"
    echo -e "${GREEN}✓ Creado .env desde .env.example${NC}"
  else
    touch "$ROOT_DIR/.env"
    echo -e "${YELLOW}⚠ No se encontró .env.example — creado .env vacío${NC}"
  fi
else
  echo -e "${GREEN}✓ .env ya existe${NC}"
fi

# ─── 3. Generar ENCRYPTION_KEY si no está definida ───────────────────────────
if ! grep -q "^ENCRYPTION_KEY=[a-f0-9]\{64\}" "$ROOT_DIR/.env" 2>/dev/null; then
  if command -v openssl &>/dev/null; then
    KEY=$(openssl rand -hex 32)
  else
    # Fallback si openssl no está disponible
    KEY=$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n 1)
  fi
  # Reemplazar o añadir la clave
  if grep -q "^ENCRYPTION_KEY=" "$ROOT_DIR/.env"; then
    sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$KEY/" "$ROOT_DIR/.env"
  else
    echo "ENCRYPTION_KEY=$KEY" >> "$ROOT_DIR/.env"
  fi
  echo -e "${GREEN}✓ ENCRYPTION_KEY generada automáticamente${NC}"
else
  echo -e "${GREEN}✓ ENCRYPTION_KEY ya configurada${NC}"
fi

# ─── 4. Crear directorios de datos ───────────────────────────────────────────
mkdir -p "$ROOT_DIR/data/documents" "$ROOT_DIR/data/logs"
echo -e "${GREEN}✓ Directorios data/ creados${NC}"

# ─── 5. Arrancar con Docker Compose ──────────────────────────────────────────
echo ""
echo -e "${GREEN}Construyendo e iniciando servicios...${NC}"
cd "$ROOT_DIR"
docker compose --env-file .env up --build -d

echo ""
echo -e "${GREEN}=== ¡Instalación completada! ===${NC}"
echo ""
echo -e "  Frontend:  ${YELLOW}http://localhost:3000${NC}"
echo -e "  Backend:   ${YELLOW}http://localhost:3001${NC}"
echo ""
echo -e "Primera configuración:"
echo -e "  1. Abre ${YELLOW}http://localhost:3000${NC}"
echo -e "  2. Ve a Settings → Añade tu API key de OpenAI o Anthropic"
echo -e "  3. Ve a Settings → Importa el SRD 5.2.1"
echo -e "  4. Crea tu primera campaña"
echo ""
