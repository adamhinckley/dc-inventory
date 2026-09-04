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

- Shop: [http://localhost:3002](http://localhost:3002)
- API: `http://localhost:3001` (proxied from this app as `/wholesale/*`)

`pnpm --filter @dc-inventory/wholesale dev` is the same shop command.

## What this shell includes

| Route | Purpose |
|---|---|
| `/` | Home: three-slide hero from `public/brand/carousel-*.jpg`, about excerpt |
| `/about` | Company copy |
| `/contact` | Feedback (`mailto:`) + address/phone/fax |
| `/register` | Brand-new vs existing account request (no Identity API) |
| `/login` | Orval `useLoginWholesale` |
| `/privacy`, `/payment-terms`, `/claim-information` | Legal pages (wording from the live-site PDFs) |
| `/products` | Product-card grid from `useListWholesaleCatalog` (Orval) |
| `/products/[sku]` | PDP placeholder |
| `/cart` | Cart placeholder — no client-invented availability |
| `/checkout` | Checkout placeholder — merchandise totals only (no sales tax in v1) |
| `/orders` | Order history placeholder |

Catalog data comes from the generated wholesale client only. There is no hand-written API `fetch` and no `DataTable` import.

## Layout

Shop chrome lives in this app (`ShopHeader` / `ShopFooter`), not AppShell and not `packages/ui`. Logged-out nav: About, Contact, Register, Sign in. Logged-in nav: Products, Orders, Cart, Sign out. Match dashboard *principles* (raised surfaces, type hierarchy, intent spacing) using shop tokens in `src/app/globals.css` — cream/terracotta canvas/ink/accent, not Carbon. Do not invent a third palette.

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
