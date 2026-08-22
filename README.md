# DC Inventory

Wholesale inventory control (catalog, stock ledger, purchasing, shop, customers, AR, licensing). Architecture lives in [`docs/architecture.md`](./docs/architecture.md). Agents start at [`AGENTS.md`](./AGENTS.md).

## Scripts

Agents and CI run these **verbatim** from the repo root:

| Command | What it does |
|---|---|
| `pnpm test` | Run Vitest |
| `pnpm lint` | Typecheck root tests, `apps/api`, shared-kernel, Orval clients, `apps/wholesale`, and `apps/internal` |
| `pnpm dev:api` | Start Fastify (`apps/api`, default port 3001) |
| `pnpm dev:wholesale` | Start the wholesale shop (`apps/wholesale`, default port 3002) |
| `pnpm dev:internal` | Start the staff dashboard (`apps/internal`, default port 3000) |
| `pnpm storybook` | Shared UI Storybook (`packages/ui`, later `ui-internal`) |
| `pnpm gen:api` | Export `openapi/*.yaml` from Zod/swagger and regenerate Orval clients |

Requires **Node >=24**. Vite 7 and the rest of the root toolchain support that range.

```bash
pnpm install
pnpm test
pnpm lint
```
