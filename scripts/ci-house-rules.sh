#!/usr/bin/env bash
# Low-noise greps for the PR #303 class of breaks (uuid binds + Orval envelopes).
# Called from scripts/ci-quality.sh.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

fail=0

# No current exceptions. Factory SKU tables use useDataTable busy/listFailed;
# pre-order VALUES binds cast supplier id as uuid. stock-ledger VALUES rows
# already include ::uuid / ::integer casts.
envelope_allowlist=''
values_allowlist=''

allowlisted() {
  local needle="$1"
  local list="$2"
  printf '%s' "$list" | grep -Fqx "$needle"
}

echo "== Orval envelope: no hand-rolled envelope === undefined && isError in apps/internal =="
while IFS= read -r hit; do
  [ -z "$hit" ] && continue
  file="${hit%%:*}"
  if allowlisted "$file" "$envelope_allowlist"; then
    continue
  fi
  echo "hand-rolled table busy (use useDataTable busy/listFailed): $hit" >&2
  fail=1
done < <(git grep -n 'envelope === undefined &&' -- 'apps/internal' || true)

echo "== Adapter VALUES SQL: uuid/cast nearby or allowlisted =="
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    *.test.ts|*.test.tsx|*pglite.ts|*pglite.js) continue ;;
  esac
  if allowlisted "$file" "$values_allowlist"; then
    continue
  fi
  if git grep -q -E '::uuid|cast\(' -- "$file"; then
    continue
  fi
  echo "VALUES/in (values) SQL without ::uuid or cast( in $file" >&2
  git grep -n -i -E 'in \(values|\(VALUES \$\{' -- "$file" >&2 || true
  fail=1
done < <(git grep -l -i -E 'in \(values|\(VALUES \$\{' -- \
  'apps/api/src/adapters' \
  'packages/inventory/src/adapters' \
  'packages/catalog/src/adapters' \
  'packages/purchasing/src/adapters' \
  'packages/sales/src/adapters' \
  'packages/customers/src/adapters' \
  'packages/accounting/src/adapters' \
  'packages/identity/src/adapters' \
  'packages/licensing/src/adapters' \
  || true)

if [ "$fail" -ne 0 ]; then
  echo "ci-house-rules: failed (see AGENTS.md Adapter SQL and Orval envelopes)" >&2
  exit 1
fi

echo "ci-house-rules: ok"
