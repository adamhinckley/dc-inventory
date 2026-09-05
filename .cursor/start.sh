#!/usr/bin/env bash
# Per-boot reconciliation: bring the local PostgreSQL online before the API and
# frontend terminals start. Data lives in the cluster's data directory (captured
# in environment snapshots/builds), so this does not re-migrate or re-seed on a
# warm boot. If the database is somehow missing, fall back to full provisioning.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_VER=16
DB_NAME=dc_inventory

# Start the cluster (no-op if already running) and wait until it is ready.
sudo pg_ctlcluster "${PG_VER}" main start >/dev/null 2>&1 || true
for _ in $(seq 1 30); do
  pg_isready -h localhost -p 5432 -q 2>/dev/null && break
  sleep 1
done

if ! pg_isready -h localhost -p 5432 -q 2>/dev/null; then
  echo "start.sh: Postgres not ready; running full provisioning…" >&2
  bash "${REPO_ROOT}/.cursor/db-provision.sh"
  exit 0
fi

# Fresh VM with no prior provisioning (e.g. no snapshot): create + migrate + seed.
if ! sudo -u postgres psql -tA -p 5432 -c \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  echo "start.sh: database ${DB_NAME} missing; running full provisioning…" >&2
  bash "${REPO_ROOT}/.cursor/db-provision.sh"
fi

echo "start.sh: Postgres ready on localhost:5432."
