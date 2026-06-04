#!/usr/bin/env bash
# Backend bundle smoke test
#
# Verifies that app/backend/dist/server.js starts correctly under three scenarios.
# Runs against the JS bundle — NOT the Tauri integration (CORS, sidecar lifecycle,
# and lib.rs bugs are out of scope; use a clean-install test for those).
#
# Usage:
#   bash scripts/test-server-smoke.sh                      # system node
#   NODE_BIN=/path/to/portable-node bash scripts/test-server-smoke.sh
#
# TODO (future hardening): add an "upgrade" scenario that starts from a real DB
# fixture created by a previous version of the app, to catch schema migration regressions.
# The current "restart-idempotency" scenario only tests same-binary restarts.

set -euo pipefail

NODE_BIN="${NODE_BIN:-node}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_JS="$REPO_ROOT/app/backend/dist/server.js"

# ── Preflight ──────────────────────────────────────────────────────────────────

if [[ ! -f "$SERVER_JS" ]]; then
  echo "ERROR: $SERVER_JS not found — run scripts/bundle-backend.sh first" >&2
  exit 1
fi

echo "=== Backend Bundle Smoke Test ==="
echo "node:   $("$NODE_BIN" --version)"
echo "bundle: $SERVER_JS"

# ── Linux engine preflight ─────────────────────────────────────────────────────
# Verify both OpenSSL engine variants are bundled before running server scenarios.
# Missing engines cause silent EACCES crashes in .deb installations on modern Ubuntu.

if [[ "$(uname -s)" == "Linux" ]]; then
  CLIENT_DIR="$REPO_ROOT/app/backend/dist/node_modules/.prisma/client"
  ENGINE_FAILURES=0
  for target in "debian-openssl-1.1.x" "debian-openssl-3.0.x"; do
    ENGINE="$CLIENT_DIR/libquery_engine-${target}.so.node"
    if [[ -f "$ENGINE" ]]; then
      echo "engine: $target ✓"
    else
      echo "engine: $target MISSING — will crash on systems with that OpenSSL" >&2
      ENGINE_FAILURES=$((ENGINE_FAILURES + 1))
    fi
  done
  if [[ $ENGINE_FAILURES -gt 0 ]]; then
    echo "ERROR: $ENGINE_FAILURES engine(s) missing from bundle. Run bundle-backend.sh first." >&2
    exit 1
  fi
fi

# ── Seed dir resolution ────────────────────────────────────────────────────────
# Prefer resources/seed (exists after prepare-resources.sh).
# Falls back to data/ (tracked in git, available in CI before prepare-resources).

TEMP_SEED=""
RESOURCES_SEED="$REPO_ROOT/app/desktop/src-tauri/resources/seed"

if [[ -d "$RESOURCES_SEED" ]]; then
  SEED_DIR="$RESOURCES_SEED"
  echo "seed:   $SEED_DIR (resources)"
elif [[ -d "$REPO_ROOT/data/srd/en" ]]; then
  TEMP_SEED=$(mktemp -d)
  mkdir -p "$TEMP_SEED/srd"
  cp -r "$REPO_ROOT/data/srd/en" "$TEMP_SEED/srd/"
  if [[ -d "$REPO_ROOT/data/core-rules" ]]; then
    mkdir -p "$TEMP_SEED/core-rules"
    cp "$REPO_ROOT/data/core-rules/"*.md "$TEMP_SEED/core-rules/" 2>/dev/null || true
  fi
  SEED_DIR="$TEMP_SEED"
  echo "seed:   $SEED_DIR (built from data/)"
else
  echo "ERROR: no seed data — expected resources/seed or data/srd/en" >&2
  exit 1
fi

# ── Cleanup trap ───────────────────────────────────────────────────────────────

CURRENT_PID=""
TEMP_DIRS=()

cleanup() {
  if [[ -n "$CURRENT_PID" ]]; then
    kill "$CURRENT_PID" 2>/dev/null || true
    wait "$CURRENT_PID" 2>/dev/null || true
  fi
  for d in "${TEMP_DIRS[@]+"${TEMP_DIRS[@]}"}"; do
    rm -rf "$d"
  done
  [[ -n "$TEMP_SEED" ]] && rm -rf "$TEMP_SEED" || true
}
trap cleanup EXIT

# ── Helpers ────────────────────────────────────────────────────────────────────

find_free_port() {
  "$NODE_BIN" -e "
    const net = require('net');
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      process.stdout.write(s.address().port.toString());
      s.close();
    });
  "
}

wait_for_health() {
  local port=$1
  local pid=$2
  local i=0
  while [[ $i -lt 30 ]]; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 1  # process exited — no point waiting
    fi
    if curl -sf "http://127.0.0.1:$port/health" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

doc_count() {
  local port=$1
  curl -sf "http://127.0.0.1:$port/api/documents" | "$NODE_BIN" -e "
    let d = '';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      try { process.stdout.write(JSON.parse(d).data.length.toString()); }
      catch (e) { process.stdout.write('0'); }
    });
  "
}

FAILURES=0
pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; FAILURES=$((FAILURES + 1)); }

# ── Scenario runner ────────────────────────────────────────────────────────────

run_scenario() {
  local name="$1"
  local data_dir="$2"
  local scenario_seed="$3"

  local port
  port=$(find_free_port)
  local logfile
  logfile=$(mktemp)
  TEMP_DIRS+=("$logfile")

  echo ""
  echo "▶ [$name] port=$port"

  CURRENT_PID=""
  NODE_ENV=production "$NODE_BIN" "$SERVER_JS" \
    --data-dir "$data_dir" \
    --port "$port" \
    --seed-dir "$scenario_seed" \
    > "$logfile" 2>&1 &
  CURRENT_PID=$!

  if ! wait_for_health "$port" "$CURRENT_PID"; then
    fail "server did not start within 30s"
    echo "  --- server output ---" >&2
    cat "$logfile" >&2
    echo "  ---------------------" >&2
    kill "$CURRENT_PID" 2>/dev/null || true
    wait "$CURRENT_PID" 2>/dev/null || true
    CURRENT_PID=""
    return
  fi

  # /health
  local health
  health=$(curl -sf "http://127.0.0.1:$port/health")
  if echo "$health" | grep -q '"status":"ok"' && echo "$health" | grep -q '"database":"ok"'; then
    pass "/health ok"
  else
    fail "/health unexpected: $health"
  fi

  # Scenario-specific assertions
  case "$name" in

    fresh-install)
      if grep -q '\[seed\] Seeding SRD v' "$logfile"; then
        pass "SRD seeding ran"
      else
        fail "SRD seeding did not run"
        cat "$logfile" >&2
      fi

      if grep -q '\[seed\] SRD v.* seeded successfully' "$logfile"; then
        pass "SRD seeded successfully"
      else
        fail "SRD seed did not complete"
        cat "$logfile" >&2
      fi

      local n
      n=$(doc_count "$port")
      if [[ "$n" -ge 9 ]]; then
        pass "$n documents in DB"
        echo "$n" > "$data_dir/.smoke-doc-count"
      else
        fail "expected ≥9 documents after seed, got $n"
      fi
      ;;

    restart-idempotency)
      if grep -q 'already seeded' "$logfile"; then
        pass "seed correctly skipped on restart"
      else
        fail "expected 'already seeded' in log — seed may have re-run"
        cat "$logfile" >&2
      fi

      if grep -q '\[seed\] Seeding SRD v' "$logfile"; then
        fail "SRD was re-seeded on restart (should be idempotent)"
      else
        pass "SRD not re-seeded"
      fi

      if [[ -f "$data_dir/.smoke-doc-count" ]]; then
        local expected n
        expected=$(cat "$data_dir/.smoke-doc-count")
        n=$(doc_count "$port")
        if [[ "$n" == "$expected" ]]; then
          pass "document count stable ($n)"
        else
          fail "document count changed on restart: expected $expected, got $n"
        fi
      fi
      ;;

    no-seed-dir)
      pass "server starts without seed dir"

      # Must not be silent — arrancar sin warning es el síntoma original
      if grep -q '\[seed\].*not found' "$logfile"; then
        pass "missing seed dir logged (not silent)"
      else
        fail "server started silently without seed dir — warning log missing"
        cat "$logfile" >&2
      fi
      ;;

  esac

  kill "$CURRENT_PID" 2>/dev/null || true
  wait "$CURRENT_PID" 2>/dev/null || true
  CURRENT_PID=""
}

# ── Scenarios ──────────────────────────────────────────────────────────────────

FRESH_DIR=$(mktemp -d)
TEMP_DIRS+=("$FRESH_DIR")

run_scenario "fresh-install"       "$FRESH_DIR" "$SEED_DIR"
run_scenario "restart-idempotency" "$FRESH_DIR" "$SEED_DIR"

NOSEED_DIR=$(mktemp -d)
TEMP_DIRS+=("$NOSEED_DIR")
run_scenario "no-seed-dir" "$NOSEED_DIR" "/tmp/nonexistent-seed-$$"

# ── Result ─────────────────────────────────────────────────────────────────────

echo ""
if [[ $FAILURES -eq 0 ]]; then
  echo "=== All scenarios PASSED ==="
  exit 0
else
  echo "=== $FAILURES scenario(s) FAILED ==="
  exit 1
fi
