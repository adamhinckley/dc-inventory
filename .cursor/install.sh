#!/usr/bin/env bash
# Cloud Agent install: provision Node 24, workspace dependencies, and a local
# PostgreSQL that mirrors the repo's Compose defaults so `pnpm dev:api`,
# migrations, and seeds work without Docker.
#
# The repo requires Node >=24 (see package.json "engines"), but the default
# Cloud Agent base image ships Node 22 (exposed at /exec-daemon/node, which the
# exec daemon prepends to PATH). We install Node 24 via the image's nvm and
# symlink it into the writable dir that precedes /exec-daemon on PATH so a bare
# `node`/`pnpm` deterministically resolves to v24 for every later command.
#
# Idempotent: safe to run repeatedly and against a warm snapshot.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- Node 24 -----------------------------------------------------------------
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
nvm install 24
nvm use 24            # make v24 the active version in this shell (not just installed)
nvm alias default 24
NODE24_BIN="$(dirname "$(nvm which 24)")"

# --- pnpm --------------------------------------------------------------------
# Source the pinned version from package.json's "packageManager" (single source
# of truth) rather than duplicating it here. `node` is v24 now (nvm use above).
PNPM_SPEC="$(node -p "require('./package.json').packageManager")"
corepack enable
corepack prepare "$PNPM_SPEC" --activate

# --- Make Node 24 win over the exec-daemon's bundled Node 22 -----------------
# Symlink the v24 binaries into the writable dir that precedes /exec-daemon on
# PATH. Create it and confirm it is writable so a base-image change fails loudly
# instead of leaving a broken `ln` behind.
BINDIR=/usr/local/cargo/bin
mkdir -p "$BINDIR"
if [ ! -w "$BINDIR" ]; then
  echo "install.sh: $BINDIR is not writable; cannot shim Node 24 ahead of /exec-daemon" >&2
  exit 1
fi
for bin in node npm npx corepack pnpm; do
  [ -e "$NODE24_BIN/$bin" ] && ln -sfn "$NODE24_BIN/$bin" "$BINDIR/$bin"
done

# Verify the shim actually provides Node >=24 (catches PATH/base-image drift).
shim_major="$("$BINDIR/node" -v | sed 's/^v\([0-9]*\).*/\1/')"
if [ "$shim_major" -lt 24 ]; then
  echo "install.sh: $BINDIR/node reports v$shim_major (expected >=24)" >&2
  exit 1
fi
echo "node $("$BINDIR/node" -v) / pnpm $("$BINDIR/pnpm" -v)"

# --- Workspace deps ----------------------------------------------------------
pnpm install --frozen-lockfile

# --- Local .env files --------------------------------------------------------
# The apps read gitignored .env files (never committed). Seed them from the
# committed *.env.example placeholders when missing. The API example already
# points DATABASE_URL at the local Postgres below; the Next apps proxy :3001.
for envpair in \
  ".env.example:.env" \
  "apps/api/.env.example:apps/api/.env" \
  "apps/internal/.env.example:apps/internal/.env" \
  "apps/wholesale/.env.example:apps/wholesale/.env"; do
  src="${envpair%%:*}"; dst="${envpair##*:}"
  [ -f "$src" ] && [ ! -f "$dst" ] && cp "$src" "$dst" && echo "install.sh: created $dst"
done

# --- Local PostgreSQL --------------------------------------------------------
# The repo's documented local infra is Postgres 18 + MinIO via Docker Compose,
# but Docker is not available in the Cloud Agent VM. We install the distro's
# PostgreSQL (repo accepts 16+; see docs/stack.md) and mirror the Compose
# credentials (postgres/postgres @ localhost:5432, db dc_inventory).
bash "$REPO_ROOT/.cursor/db-provision.sh"

echo "install.sh: done."
