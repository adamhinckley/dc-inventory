# `@dc-inventory/internal`

Staff **dashboard** for warehouse, purchasing, sales support, and admin: tables, reports, charts, and CRUD.

This is not the wholesale shop (`apps/wholesale`) and not the ops licensing control plane (`apps/ops`). Do not put shop cards or flag admin here.

## Audience

Staff at the wholesale company. Wholesale clients order on the shop. Software billing lives on Ops.

## How to run

From the **repo root**:

```bash
pnpm dev:api
pnpm dev:internal
```

- Dashboard: [http://localhost:3000](http://localhost:3000) (redirects to `/catalog`)
- API: `http://localhost:3001` (proxied from this app as `/internal/*`)

`pnpm --filter @dc-inventory/internal dev` is the same dashboard command.

## What this shell includes

| Route | Purpose |
|---|---|
| `/login` | `(auth)/login` placeholder |
| `/catalog` | Example `DataTable` + `useListInternalProducts` (Orval) |
| `/customers` | Placeholder |
| `/procurement` | Procurement hub (Pre-order, Purchase Orders, Receiving, Suppliers) |
| `/inventory` | Placeholder |
| `/sales` | Placeholder |
| `/accounting` | Placeholder |
| `/reports` | Placeholder |

The catalog table is driven by generated `x-table` meta and the Orval list hook. There is no hand-written API `fetch`. Other routes stay placeholders until their list endpoints exist — do not drop `DataTable` onto them without that contract.

## Layout

Dashboard chrome is AppShell (sidebar + elevated `.page` panel) from `packages/ui`, Carbon White / opt-in g100 hex. `DataTable` comes from `packages/ui-internal`. This is not the wholesale shop.

## Env

See [`.env.example`](./.env.example). Default is same-origin `/internal/*` rewritten to `apps/api`.

## Vercel

Two Vercel projects share this repo; set **Root Directory** to `apps/internal`.

| Setting | Value |
|---|---|
| Framework | Next.js |
| Node | 24 |
| `API_PROXY_ORIGIN` | `https://dc-inventory-api.fly.dev` |
| `NEXT_PUBLIC_API_URL` | *(empty — use same-origin rewrites)* |

[`vercel.json`](./vercel.json) pins filtered pnpm install/build for the monorepo. Deploys run from [`.github/workflows/deploy-frontends.yml`](../../.github/workflows/deploy-frontends.yml) after you link projects and add GitHub secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_INTERNAL`, `VERCEL_PROJECT_ID_WHOLESALE`). Or connect the repo in the Vercel dashboard and set the same env vars — Git integration deploys on push without Actions.

First-time link from the repo root:

```bash
pnpm dlx vercel login
pnpm dlx vercel link --repo
```

Pick/create a project for `apps/internal`. Repeat for wholesale with Root Directory `apps/wholesale`.
