# `@dc-inventory/wholesale`

Wholesale **e-commerce** app for client buyers: browse the catalog, product detail, cart, checkout, and their own order history.

This is not the staff dashboard (`apps/internal`). Do not put `DataTable`, report charts, or dashboard chrome here.

## Audience

Wholesale customers placing orders against their account. Staff catalog/CRUD stays on Internal.

## How to run

From the **repo root**:

```bash
pnpm dev:api
pnpm dev:wholesale
```

- Shop: [http://localhost:3002](http://localhost:3002) (redirects to `/products`)
- API: `http://localhost:3001` (proxied from this app as `/wholesale/*`)

`pnpm --filter @dc-inventory/wholesale dev` is the same shop command.

## What this shell includes

| Route | Purpose |
|---|---|
| `/login` | `(auth)/login` placeholder |
| `/products` | Product-card grid from `useListWholesaleCatalog` (Orval) |
| `/products/[sku]` | PDP placeholder |
| `/cart` | Cart placeholder — no client-invented availability |
| `/checkout` | Checkout placeholder — tax display only, later |
| `/orders` | Order history placeholder |

Catalog data comes from the generated wholesale client only. There is no hand-written API `fetch` and no `DataTable` import.

## Layout

Shop chrome is a storefront header (catalog + cart + orders), not an admin sidebar. Shared primitives from `packages/ui` can land later (ADA-36); product cards stay in this app because they are a shop pattern.

## Env

See [`.env.example`](./.env.example). Default is same-origin `/wholesale/*` rewritten to `apps/api`.
