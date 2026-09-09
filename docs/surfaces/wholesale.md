# Wholesale shop surfaces (v1)

Client ordering site (`apps/wholesale`). Session binds `customerId`. Not a staff table UI.

Related: [`README.md`](./README.md) (both apps + deferred) · [`customer-account.md`](./customer-account.md) · [`dashboard.md`](./dashboard.md) · [`insights.md`](./insights.md)

---

## Chrome (v1)

Lives in `apps/wholesale` (not `packages/ui` / AppShell). Tokens: cream canvas, terracotta accent, Figtree + Cormorant — listed in `apps/wholesale/src/app/globals.css`. Do not copy Carbon hex.

| Surface | Notes |
| --- | --- |
| Header | Logged out: About, Contact, Register, Sign in. Logged in (buyer): Products, Orders, Cart, Account, Sign out, plus a cart icon whose badge is the active cart's line count and which opens the cart drawer. Staff acting: no Account link. Wordmark from `public/brand/logo.png`. See [`customer-account.md`](./customer-account.md). |
| Home | Hero carousel (`public/brand/carousel-{1,2,3}.jpg`), about excerpt |
| Contact / register | UI only today. Feedback uses mailto. Register asks customer service to enable web access. Live SoloView is a three-step **New Account Registration** modal (primary info, business credentials, main business address), then **staff approval**, then **PandaDoc** — see [`customers.md`](../customers.md) §15 and [Wholesale screenshots](https://app.notion.com/p/3d00df01ce2e803f9131d35c9666cc9e). Header **terms** are payment clock, not that document. |
| Legal | Privacy, payment terms, claims — HTML pages; wording taken from the live-site PDFs |

## Features

| Feature | What it is |
| --- | --- |
| Browse catalog | Shopify-style collection page at `/products`: breadcrumb and title at the top of the page, filter sidebar (categories from `GET /wholesale/catalog/categories`, in-stock toggle; a Filter drawer below `lg`), sticky toolbar (count, search, sort, 24/48/96 per page), dense 2–6 column grid with square placeholder image, overlaid availability pill, SKU, and name — not a staff table. Qty and Add to Cart live on the product detail page. URL params: `q`, `category`, `sort`, `pageSize`, `page`, `availableOnly`. |
| Product detail page | Two-column: sticky image left; item #, name, price, availability, qty + Add to Cart, description right. Breadcrumb returns to the category it was reached from (`?category=`). |
| Carts | Many open carts per customer; each is a draft sales order with an optional label. `/cart` lists them (Open / Make Active / Start New Cart); `/cart/[id]` edits lines, renames, deletes; a right-side cart drawer (header icon) shows the active cart with a cart switcher. Add / Update Cart on the PDP stays on the product. Continue Shopping is always on the PDP (back to the catalog or the category they came from). |
| Checkout | `/checkout?cart=<id>` confirms one cart (falls back to the active cart) and allocates stock |
| Order history | Paginated; scoped to this customer |
| Order detail | |
| Download own order / invoice PDF | Only if listed on the wholesale API |
| Own account | Buyer `/account` — see [`customer-account.md`](./customer-account.md) |

## Information that may appear

| Information | Notes |
| --- | --- |
| SKU, name, description, secondary name | |
| Images | |
| Selling price | The one shop price the business picks |
| Available quantity **or** in stock / not | Business pick |
| Unit of measure | |
| Default order quantity | |
| Categories for navigation | |
| Body / pack dimensions | Optional on the product page if useful to buyers |
| Cart lines and quantities | |
| Frozen line price on their orders | |
| Their order status and dates | |
| Their invoice PDF | If enabled |

## Never on the wholesale shop (v1)

| Keep off the shop |
| --- |
| Cost, standard cost, last PO cost |
| Supplier name, vendor number, vendor mins |
| On hand / allocated / on order as separate staff figures (shop gets available only, if at all) |
| Reorder min/max, location codes, pick bin |
| Other customers, their orders, their invoices |
| AR aging |
| Staff reports and charts |
| Spreadsheet import / export |
| Purchase orders |
| Stock adjustments |
| Line commission |
| Consumer storefront flag (not a v1 shop) |
| Sales tax lines or engine (v1 does not collect sales tax; reseller Tax ID and exemption files are customer paperwork only) |
