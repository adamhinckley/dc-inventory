#!/usr/bin/env bash
# Cloud Agent install: provision Node 24 and workspace dependencies.
#
# The repo requires Node >=24 (see package.json "engines"), but the default
# Cloud Agent base image ships Node 22 (exposed at /exec-daemon/node, which the
# exec daemon prepends to PATH). We install Node 24 via the image's nvm and
# symlink it into the world-writable dir that precedes /exec-daemon on PATH so a
# bare `node`/`pnpm` deterministically resolves to v24 for every later command.
#
# Idempotent: safe to run repeatedly and against a warm snapshot.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
nvm install 24 >/dev/null
nvm alias default 24 >/dev/null
NODE24_BIN="$(nvm which 24 | xargs dirname)"

# pnpm is pinned by package.json's "packageManager" field; corepack honors it.
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@10.33.3 --activate >/dev/null 2>&1 || true

# Make Node 24 (and its pnpm shim) win over the exec-daemon's bundled Node 22.
BINDIR=/usr/local/cargo/bin
for bin in node npm npx corepack pnpm; do
  [ -e "$NODE24_BIN/$bin" ] && ln -sfn "$NODE24_BIN/$bin" "$BINDIR/$bin"
done

echo "node $(node -v) / pnpm $(pnpm -v)"

pnpm install --frozen-lockfile
