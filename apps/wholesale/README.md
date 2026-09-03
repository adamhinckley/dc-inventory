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
| `/checkout` | Checkout placeholder — merchandise totals only (no sales tax in v1) |
| `/orders` | Order history placeholder |

Catalog data comes from the generated wholesale client only. There is no hand-written API `fetch` and no `DataTable` import.

## Layout

Shop chrome is a storefront header (catalog + cart + orders), not AppShell. Do not import the internal dashboard kit. Match its *principles* (raised surfaces, type hierarchy, intent spacing) using shop tokens in `src/app/globals.css`.

## Env

See [`.env.example`](./.env.example). Default is same-origin `/wholesale/*` rewritten to `apps/api`.

## Vercel

Two Vercel projects share this repo; set **Root Directory** to `apps/wholesale`.

| Setting | Value |
|---|---|
| Framework | Next.js |
| Node | 24 |
| `API_PROXY_ORIGIN` | `https://dc-inventory-api.fly.dev` |
| `NEXT_PUBLIC_API_URL` | *(empty — use same-origin rewrites)* |

[`vercel.json`](./vercel.json) pins filtered pnpm install/build for the monorepo. Deploys run from [`.github/workflows/deploy-frontends.yml`](../../.github/workflows/deploy-frontends.yml) after you link projects and add GitHub secrets. Or connect the repo in the Vercel dashboard with the same env vars.

First-time link from the repo root:

```bash
pnpm dlx vercel login
pnpm dlx vercel link --repo
```

Pick/create a project for `apps/wholesale`. The internal dashboard uses Root Directory `apps/internal`.
