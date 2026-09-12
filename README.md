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
| `pnpm dev:wholesale:local` | Same shop on `http://dc-wholesale.test:3002` (see below) |
| `pnpm dev:internal` | Start the staff dashboard (`apps/internal`, default port 3000) |
| `pnpm dev:internal:local` | Same dashboard on `http://dc-internal.test:3000` (see below) |
| `pnpm storybook` | Shared UI Storybook (`packages/ui`, later `ui-internal`) |
| `pnpm gen:api` | Export `openapi/*.yaml` from Zod/swagger and regenerate Orval clients |

Requires **Node >=24**. Vite 7 and the rest of the root toolchain support that range.

Local demo database: `docker compose up -d --wait` (Postgres 18 + MinIO + Mailpit, placeholder credentials). Copy [`.env.example`](./.env.example) and [`apps/api/.env.example`](./apps/api/.env.example). Then `pnpm db:migrate` and `pnpm dev:api`. `GET /ready` is `SELECT 1`, not migrate. Outbound email and Mailpit UI: [`docs/local-boot.md`](./docs/local-boot.md). Demo-only locks: [`docs/demo-assumptions.md`](./docs/demo-assumptions.md) — not [`docs/invariants.md`](./docs/invariants.md) §18.

### Local hostnames (password managers)

Password managers often treat all `localhost` apps as one site. To give internal and wholesale distinct URLs locally, add the lines in [`scripts/local-dev-hosts.txt`](./scripts/local-dev-hosts.txt) to `/etc/hosts`, then use `pnpm dev:internal:local` and `pnpm dev:wholesale:local` instead of the default dev commands. When both frontends use the `.test` hostnames, set `NEXT_PUBLIC_INTERNAL_APP_URL=http://dc-internal.test:3000` in `apps/wholesale/.env.local` so staff-acting links stay correct. The API stays on `localhost:3001`; Next rewrites handle the proxy.

Required CI (not optional): [`.github/workflows/ci-quality.yml`](./.github/workflows/ci-quality.yml) runs `pnpm test` (including dependency-direction Vitest guards), `pnpm lint`, and `pnpm gen:api` with a clean `git diff` on OpenAPI + Orval outputs (`scripts/ci-quality.sh`). [`.github/workflows/compose-migrate-ready.yml`](./.github/workflows/compose-migrate-ready.yml) separately starts Compose, runs `pnpm db:migrate`, boots the API, and fails if `GET /ready` cannot talk to Postgres (`scripts/ci-compose-migrate-ready.sh`). Unit tests stay in-memory and do not start Docker.

```bash
pnpm install
pnpm test
pnpm lint
```
