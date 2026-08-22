# DC Inventory

Wholesale inventory control (catalog, stock ledger, purchasing, shop, customers, AR, licensing). Architecture lives in [`docs/architecture.md`](./docs/architecture.md). Agents start at [`AGENTS.md`](./AGENTS.md).

## Scripts

Agents and CI run these **verbatim** from the repo root:

| Command | What it does |
|---|---|
| `pnpm test` | Run Vitest |
| `pnpm lint` | Typecheck root tests, `apps/api`, shared-kernel, Orval clients, `apps/wholesale`, and `apps/internal` |
| `pnpm db:migrate` | Apply Drizzle Kit migrations from `apps/api` (one Kit home; no `packages/db`) |
| `pnpm dev:api` | Start Fastify (`apps/api`, default port 3001) |
| `pnpm dev:wholesale` | Start the wholesale shop (`apps/wholesale`, default port 3002) |
| `pnpm dev:internal` | Start the staff dashboard (`apps/internal`, default port 3000) |
| `pnpm storybook` | Shared UI Storybook (`packages/ui`, later `ui-internal`) |
| `pnpm gen:api` | Export `openapi/*.yaml` from Zod/swagger and regenerate Orval clients |

Requires **Node >=24**. Vite 7 and the rest of the root toolchain support that range.

Local demo database: `docker compose up -d` (Postgres 16 + MinIO, placeholder credentials). Copy [`.env.example`](./.env.example) and [`apps/api/.env.example`](./apps/api/.env.example). Then `pnpm db:migrate` and `pnpm dev:api`. `GET /ready` is `SELECT 1`, not migrate. Demo-only locks: [`docs/demo-assumptions.md`](./docs/demo-assumptions.md) — not [`docs/invariants.md`](./docs/invariants.md) §18.

```bash
pnpm install
pnpm test
pnpm lint
```
