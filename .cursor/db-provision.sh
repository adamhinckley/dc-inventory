#!/usr/bin/env bash
# Provision the local PostgreSQL used by the API: install the server (if the
# base image lacks it), start the default cluster, mirror the repo's Compose
# credentials, apply migrations, and seed demo data.
#
# Migrations note: `pnpm db:migrate` (drizzle-kit) wraps ALL pending migrations
# in ONE transaction. On a fresh database that fails, because migration 0005
# adds enum value 'InboundCancelled' and migration 0029 uses it in an index
# predicate — Postgres forbids using a new enum value in the same transaction
# it was added (SQLSTATE 55P04). We therefore apply each migration file in its
# OWN transaction here, recording drizzle's exact hash + folderMillis so a
# later `pnpm db:migrate` is a clean no-op. See the PR description for the
# underlying migration fix that the owner should make.
#
# Idempotent: safe to run repeatedly and against a warm snapshot.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PG_VER=16
DB_NAME=dc_inventory
DB_URL="postgres://postgres:postgres@localhost:5432/${DB_NAME}"

# --- Install the server if the base image does not ship it -------------------
if ! ls /usr/lib/postgresql/*/bin/pg_ctl >/dev/null 2>&1; then
  echo "db-provision: installing postgresql-${PG_VER}…"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    "postgresql-${PG_VER}" "postgresql-client-${PG_VER}"
fi

# --- Start the default cluster and wait for it to accept connections ---------
sudo pg_ctlcluster "${PG_VER}" main start >/dev/null 2>&1 || true
for _ in $(seq 1 30); do
  pg_isready -h localhost -p 5432 -q 2>/dev/null && break
  sleep 1
done
pg_isready -h localhost -p 5432 -q

# --- Credentials + database (peer auth as the postgres OS user) --------------
sudo -u postgres psql -q -p 5432 -c "ALTER USER postgres WITH PASSWORD 'postgres';"
if ! sudo -u postgres psql -tA -p 5432 -c \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -p 5432 "${DB_NAME}"
  echo "db-provision: created database ${DB_NAME}"
fi

# --- Apply migrations (one transaction per migration file) ------------------
(
  cd apps/api
  DATABASE_URL="${DB_URL}" node --input-type=module <<'NODE'
import postgres from "postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const migrations = readMigrationFiles({ migrationsFolder: "./drizzle/migrations" });
await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
const [last] = await sql`select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`;
let applied = 0;
for (const m of migrations) {
  if (last && Number(last.created_at) >= m.folderMillis) continue;
  await sql.begin(async (tx) => {
    for (const stmt of m.sql) await tx.unsafe(stmt);
    await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${m.hash}, ${m.folderMillis})`;
  });
  applied++;
}
console.log(`db-provision: applied ${applied} migration(s)`);
await sql.end();
NODE
)

# --- Seed demo + phase-1 login data (idempotent) ----------------------------
# Demo book requires empty demo schemas; only run it on a fresh database.
customer_count="$(sudo -u postgres psql -tA -p 5432 -d "${DB_NAME}" \
  -c "SELECT count(*) FROM customers.customers" 2>/dev/null || echo 0)"
if [ "${customer_count:-0}" = "0" ]; then
  echo "db-provision: seeding demo book…"
  pnpm seed:demo || echo "db-provision: seed:demo skipped/failed (non-fatal)"
fi
# Phase-1 upsert guarantees the local staff/wholesale logins exist.
pnpm db:seed:phase1 || echo "db-provision: db:seed:phase1 failed (non-fatal)"

echo "db-provision: done."
