#!/usr/bin/env bash
# Cloud Agent install: provision Node 24 and workspace dependencies.
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
