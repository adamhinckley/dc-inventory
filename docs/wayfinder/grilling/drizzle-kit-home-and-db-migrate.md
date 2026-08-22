# Drizzle Kit home and `db:migrate`

Ticket: [ADA-45](https://linear.app/adamhinckley/issue/ADA-45/drizzle-kit-home-and-dbmigrate)  
Type: grilling  
Parent map: [ADA-41](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map)  
Research: [ADA-42](https://linear.app/adamhinckley/issue/ADA-42/scaffold-drizzle-starting-point) (facts on the current scaffold; this ticket names the home)

This is a Phase 0 spec lock, not an implementation. Do not add `pnpm db:migrate`, compose files, or business tables in this note.

---

## Decision

**Keep Drizzle Kit in `apps/api`.** Phase 0 adds `pnpm db:migrate` as a **root** script that runs Kit **in that package only**.

**Do not extract `packages/db`, `packages/persistence`, or any other migrate/schema package.**

There is one migrate history. An implementer who adds a second `drizzle.config.ts` or a second `drizzle/migrations` folder is inventing a second history — reject that PR.

---

## Named home

| Role | Path |
|---|---|
| Kit config | `apps/api/drizzle.config.ts` |
| Schema barrel | `apps/api/src/infrastructure/schema.ts` |
| Migrate history (`out`) | `apps/api/drizzle/migrations` |
| Package script (Phase 0 adds) | `@dc-inventory/api` `"db:migrate": "drizzle-kit migrate"` |
| Root script (Phase 0 adds) | `"db:migrate": "pnpm --filter @dc-inventory/api db:migrate"` |
| Connection / pool | `apps/api/src/infrastructure/db.ts` + `database-url.ts` (already there) |

`drizzle.config.ts` already points at that barrel and `out`. Phase 0 **extends** those paths. It does not relocate them.

---

## Starting point this decision extends

Verified on `main` (same facts ADA-42 captured):

| Fact | Where |
|---|---|
| Kit config exists | `apps/api/drizzle.config.ts` — `dialect: postgresql`, `schema: ./src/infrastructure/schema.ts`, `out: ./drizzle/migrations` |
| Schema barrel is empty | `apps/api/src/infrastructure/schema.ts` exports `schema = {}` |
| Migrations dir reserved | `apps/api/drizzle/migrations/.gitkeep` only — no SQL yet |
| `drizzle-kit` is an API **dev**Dependency | `apps/api/package.json` |
| No `db:migrate` today | Root `package.json` and `@dc-inventory/api` scripts |
| `DATABASE_URL` required at boot | `readDatabaseUrl()` / `MissingDatabaseUrlError` |
| `/health` vs `/ready` | Liveness (no DB) vs `SELECT 1` on the same postgres.js client |
| ADA-34 already rejected a persistence package | Ticket allowed `packages/persistence/**` only if needed; implementers kept Drizzle under `apps/api/infrastructure` |

ADA-41: the Phase 0 spec must extend this scaffold, not replace it.

---

## Why not `packages/db`

| Pressure | Why it loses |
|---|---|
| “Context adapters cannot import `apps/api`” (D6) | True later. The fix is **compose** context table files into the existing API barrel — not a second Kit home. Phase 0 has no context packages yet ([ADR 0005](../../adr/0005-frozen-tree-agent-optimized-scaffold.md): empty bounded-context packages are not pre-created). |
| “Shared schemas for many apps” | Only Fastify talks to Postgres. Next.js apps are Orval-only. There is no second process that should own migrations. |
| “Cleaner package boundary” | `packages/db` is a grab-bag persistence package, not a bounded context. ADR 0005 forbids that shape. |
| “Move now so we do not move later” | Moving Kit + `out` now **is** a second history if anyone leaves the reserved `apps/api/drizzle/migrations` in place. Extending the existing `out` is the cheaper lock. |
| ADA-34 optional `packages/persistence` | Already considered and not used. Reopening it under a new name (`packages/db`) is the same rejected layout. |

One Postgres, one process, one composition root (`apps/api`). Kit belongs next to the pool that `/ready` already pings.

---

## What Phase 0 must do

When the implementation spec / tickets land (not this grilling note):

1. Add **root** `pnpm db:migrate` that delegates to `@dc-inventory/api`.
2. Add `@dc-inventory/api` `"db:migrate": "drizzle-kit migrate"` (same working directory as `drizzle.config.ts`).
3. Compose Phase 0 table models into the **existing** barrel: `apps/api/src/infrastructure/schema.ts`, or sibling files it imports under `apps/api/src/infrastructure/` (for example `schema/catalog.ts`). Postgres schemas stay per context (`catalog`, `inventory`, …) **inside** that one barrel.
4. Emit SQL only into `apps/api/drizzle/migrations`.
5. Document `pnpm db:migrate` on the root script table (`AGENTS.md`, `README.md`) when the script exists — not before.
6. Keep `DATABASE_URL` reading where it is. Kit and the API share that env.

## What Phase 0 must not do

- Create `packages/db`, `packages/persistence`, or `packages/drizzle`.
- Add a second `drizzle.config.ts` (repo root, a context package, or compose).
- Add a second `drizzle/migrations` (or rename `out` away from `apps/api/drizzle/migrations`).
- Pre-create empty `packages/<context>` just to hold table files (ADR 0005).
- Apply migrations from `/ready` (`OP5`: `/ready` is a cheap DB ping, not migrate).
- Put Drizzle / Kit imports in `domain/` or `application/`.

---

## Later seam (not Phase 0)

When a bounded-context package gets a Postgres adapter:

- That context **may** own `packages/<context>/adapters/*.ts` table models.
- `apps/api/src/infrastructure/schema.ts` **must** import/re-export them so Kit still sees one barrel.
- `drizzle.config.ts` and `out: ./drizzle/migrations` **stay** in `apps/api`.
- Context `domain/` / `application/` still do not import Drizzle.
- Context adapters still do not import `apps/api` (D6). They own their table file; the API barrel pulls it in.

That is still **one** migrate history. It is not permission to extract `packages/db`.

---

## Spec one-liner (copy into ADA-41 / the Phase 0 spec)

> Drizzle Kit home is `apps/api` (`drizzle.config.ts`, schema barrel `src/infrastructure/schema.ts`, `out: ./drizzle/migrations`). Root `pnpm db:migrate` runs `drizzle-kit migrate` in that package. Do not add `packages/db` or a second migrate history.
