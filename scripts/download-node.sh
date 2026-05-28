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

download_node() {
  local node_platform=$1
  local target_triple=$2
  local ext=${3:-tar.gz}

  echo "→ Downloading Node.js ${NODE_VERSION} for ${node_platform}..."
  local tmpdir
  tmpdir=$(mktemp -d)

  if [ "$ext" = "zip" ]; then
    curl -sL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${node_platform}.zip" \
      -o "$tmpdir/node.zip"
    unzip -qo "$tmpdir/node.zip" "node-${NODE_VERSION}-${node_platform}/node.exe" -d "$tmpdir/"
    cp "$tmpdir/node-${NODE_VERSION}-${node_platform}/node.exe" \
      "${BINARIES_DIR}/node-${target_triple}.exe"
  else
    curl -sL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${node_platform}.tar.gz" \
      | tar xz --strip-components=2 -C "$tmpdir" \
        "node-${NODE_VERSION}-${node_platform}/bin/node"
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
