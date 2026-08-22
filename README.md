# DC Inventory

Wholesale inventory control (catalog, stock ledger, purchasing, shop, customers, AR, licensing). Architecture lives in [`docs/architecture.md`](./docs/architecture.md). Agents start at [`AGENTS.md`](./AGENTS.md).

## Scripts

Agents and CI run these **verbatim** from the repo root:

| Command | What it does |
|---|---|
| `pnpm test` | Run Vitest |
| `pnpm lint` | Typecheck with `tsc --noEmit` |
| `pnpm dev:api` | Start the API (stub until `apps/api` exists) |
| `pnpm gen:api` | Export OpenAPI specs and Orval clients (stub until swagger export exists) |

```bash
pnpm install
pnpm test
pnpm lint
```
