#!/usr/bin/env bash
# ADA-196: Vitest (including dependency-direction guards), full typecheck,
# and generated-contract drift. No Docker — migrate/readiness stays in ADA-55.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

pnpm test
pnpm lint

pnpm gen:api
git diff --exit-code -- \
  openapi/ \
  packages/api-client-internal/src/generated/ \
  packages/api-client-wholesale/src/generated/ \
  packages/api-client-ops/src/generated/
