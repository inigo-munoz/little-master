#!/bin/bash
set -e

NODE_VERSION="v20.18.0"
BINARIES_DIR="app/desktop/src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

PLATFORM="${1:-auto}"

if [ "$PLATFORM" = "auto" ]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64)   PLATFORM="linux-x64" ;;
    Darwin-arm64)   PLATFORM="darwin-arm64" ;;
    Darwin-x86_64)  PLATFORM="darwin-x64" ;;
    MINGW*|MSYS*)   PLATFORM="win-x64" ;;
    *)              echo "Unknown platform: $(uname -s)-$(uname -m)"; exit 1 ;;
  esac
fi

if [ -n "$RUNNER_OS" ] && [ "$1" = "" ]; then
  case "$RUNNER_OS" in
    macOS)
      if [ "$(uname -m)" = "arm64" ]; then PLATFORM="darwin-arm64"; else PLATFORM="darwin-x64"; fi ;;
    Linux)   PLATFORM="linux-x64" ;;
    Windows) PLATFORM="win-x64" ;;
  esac
fi

# Verify a downloaded artifact against Node's official SHASUMS256.txt.
# The full archive is downloaded to disk and its SHA-256 checked BEFORE extraction, so a
# corrupted or MITM'd binary never reaches the bundle. SHASUMS256.txt is fetched over TLS
# from nodejs.org; for stronger guarantees, also verify SHASUMS256.txt.sig with GPG against
# the Node.js release keys (https://github.com/nodejs/release-keys).
verify_checksum() {
  local file=$1          # absolute path to the downloaded archive
  local archive_name=$2  # basename as listed in SHASUMS256.txt
  local shasums=$3       # absolute path to SHASUMS256.txt

  local expected actual
  expected=$(grep " ${archive_name}\$" "$shasums" | awk '{print $1}')
  if [ -z "$expected" ]; then
    echo "✗ No checksum found for ${archive_name} in SHASUMS256.txt" >&2
    exit 1
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$file" | awk '{print $1}')
  else
    actual=$(shasum -a 256 "$file" | awk '{print $1}')
  fi

  if [ "$expected" != "$actual" ]; then
    echo "✗ Checksum mismatch for ${archive_name}" >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    exit 1
  fi
  echo "  ✓ checksum verified (${archive_name})"
}

download_node() {
  local node_platform=$1
  local target_triple=$2
  local ext=${3:-tar.gz}

  echo "→ Downloading Node.js ${NODE_VERSION} for ${node_platform}..."
  local tmpdir
  tmpdir=$(mktemp -d)

  # Fetch the signed checksum manifest once per download.
  curl -fsL "https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt" -o "$tmpdir/SHASUMS256.txt"

  if [ "$ext" = "zip" ]; then
    local archive="node-${NODE_VERSION}-${node_platform}.zip"
    curl -fsL "https://nodejs.org/dist/${NODE_VERSION}/${archive}" -o "$tmpdir/$archive"
    verify_checksum "$tmpdir/$archive" "$archive" "$tmpdir/SHASUMS256.txt"

    unzip -qo "$tmpdir/$archive" "node-${NODE_VERSION}-${node_platform}/node.exe" -d "$tmpdir/"
    cp "$tmpdir/node-${NODE_VERSION}-${node_platform}/node.exe" \
      "${BINARIES_DIR}/node-${target_triple}.exe"
  else
    local archive="node-${NODE_VERSION}-${node_platform}.tar.gz"
    curl -fsL "https://nodejs.org/dist/${NODE_VERSION}/${archive}" -o "$tmpdir/$archive"
    verify_checksum "$tmpdir/$archive" "$archive" "$tmpdir/SHASUMS256.txt"

    tar xz --strip-components=2 -C "$tmpdir" \
      -f "$tmpdir/$archive" "node-${NODE_VERSION}-${node_platform}/bin/node"
    cp "$tmpdir/node" "${BINARIES_DIR}/node-${target_triple}"
    chmod +x "${BINARIES_DIR}/node-${target_triple}"
  fi

  rm -rf "$tmpdir"
}

case "$PLATFORM" in
  darwin-arm64) download_node "darwin-arm64" "aarch64-apple-darwin" ;;
  darwin-x64)   download_node "darwin-x64"   "x86_64-apple-darwin" ;;
  linux-x64)    download_node "linux-x64"    "x86_64-unknown-linux-gnu" ;;
  win-x64)      download_node "win-x64"      "x86_64-pc-windows-msvc" "zip" ;;
  all)
    download_node "darwin-arm64" "aarch64-apple-darwin"
    download_node "darwin-x64"   "x86_64-apple-darwin"
    download_node "linux-x64"    "x86_64-unknown-linux-gnu"
    download_node "win-x64"      "x86_64-pc-windows-msvc" "zip"
    ;;
  *) echo "Usage: $0 [darwin-arm64|darwin-x64|linux-x64|win-x64|all|auto]"; exit 1 ;;
esac

echo "→ Node binaries ready:"
ls -lh "$BINARIES_DIR"/node-*
