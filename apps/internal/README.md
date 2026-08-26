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
| `/login` | `(auth)/login` — staff cookie, then `/purchasing` |
| `/catalog` | `DataTable` + `useListInternalProducts` |
| `/customers` | Placeholder |
| `/purchasing` | Create draft PO + `DataTable` + `useListInternalPurchaseOrders` |
| `/inventory` | Placeholder |
| `/sales` | Placeholder |
| `/accounting` | Placeholder |
| `/reports` | Placeholder |

The catalog and purchasing tables are driven by generated `x-table` meta and Orval list hooks. There is no hand-written API `fetch`. Other routes stay placeholders until their list endpoints exist — do not drop `DataTable` onto them without that contract.

## Layout

Dashboard chrome is AppShell (sidebar + elevated `.page` panel) from `packages/ui`, Carbon White / opt-in g100 hex. `DataTable` comes from `packages/ui-internal`. This is not the wholesale shop.

## Env

See [`.env.example`](./.env.example). Default is same-origin `/internal/*` rewritten to `apps/api`.
