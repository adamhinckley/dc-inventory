#!/usr/bin/env bash
# Phase 0 stop condition (ADA-55): Compose up, apply Kit SQL, boot API,
# fail closed unless GET /ready talks to Postgres. Placeholder env only.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/dc_inventory}"
export PORT="${PORT:-3001}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-dc_inventory}"
export MINIO_ROOT_USER="${MINIO_ROOT_USER:-minio}"
export MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minio-placeholder}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for compose-migrate-ready" >&2
  exit 1
fi

docker compose up -d --wait
pnpm db:migrate
pnpm vitest run apps/api/src/adapters/postgres-concurrency.integration.test.ts

api_log="$(mktemp)"
pnpm dev:api >"$api_log" 2>&1 &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT

ready_url="http://127.0.0.1:${PORT}/ready"
for _ in $(seq 1 45); do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "API exited before GET /ready succeeded" >&2
    cat "$api_log" >&2
    exit 1
  fi
  if body="$(curl -sfS --max-time 2 "$ready_url" 2>/dev/null)" &&
    [[ "$body" == *'"ready":true'* ]]; then
    echo "GET /ready ok: $body"
    exit 0
  fi
  sleep 1
done

echo "GET /ready did not become ready within 45s" >&2
echo "--- API log ---" >&2
cat "$api_log" >&2
echo "--- last curl ---" >&2
curl -sv "$ready_url" >&2 || true
exit 1
