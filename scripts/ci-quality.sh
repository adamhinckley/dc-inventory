#!/usr/bin/env bash
# ADA-196: Vitest (including dependency-direction guards), full typecheck,
# and generated-contract drift. No Docker — migrate/readiness stays in ADA-55.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

pnpm test
pnpm lint

drift_paths=(
  openapi/
  packages/api-client-internal/src/generated/
  packages/api-client-wholesale/src/generated/
  packages/api-client-ops/src/generated/
)

pnpm gen:api

git diff --exit-code -- "${drift_paths[@]}"

porcelain="$(git status --porcelain -- "${drift_paths[@]}")"
if [ -n "$porcelain" ]; then
  echo "generated outputs differ from committed files (including untracked paths):" >&2
  echo "$porcelain" >&2
  exit 1
fi
