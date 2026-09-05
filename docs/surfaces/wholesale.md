# Wholesale shop surfaces (v1)

Client ordering site (`apps/wholesale`). Session binds `customerId`. Not a staff table UI.

Related: [`README.md`](./README.md) (both apps + deferred) · [`dashboard.md`](./dashboard.md) · [`insights.md`](./insights.md)

---

## Chrome (v1)

Lives in `apps/wholesale` (not `packages/ui` / AppShell). Tokens: cream canvas, terracotta accent, Figtree + Cormorant — listed in `apps/wholesale/src/app/globals.css`. Do not copy Carbon hex.

| Surface | Notes |
| --- | --- |
| Header | Logged out: About, Contact, Register, Sign in. Logged in: Products, Orders, Cart, Sign out. Wordmark from `public/brand/logo.png`. |
| Home | Hero carousel (`public/brand/carousel-{1,2,3}.jpg`), about excerpt |
| Contact / register | UI only today. Feedback uses mailto. Register asks customer service to enable web access. Live SoloView is a three-step **New Account Registration** modal (primary info, business credentials, main business address), then **staff approval**, then **PandaDoc** — see [`customers.md`](../customers.md) §15 and [Wholesale screenshots](https://app.notion.com/p/3d00df01ce2e803f9131d35c9666cc9e). Header **terms** are payment clock, not that document. |
| Legal | Privacy, payment terms, claims — HTML pages; wording taken from the live-site PDFs |

## Features

| Feature | What it is |
| --- | --- |
| Browse catalog | Search, category, sort, page — product **grid**, not a staff table |
| Product detail page | |
| Cart (view and change quantities) | Separate cart vs draft order is still an open question |
| Checkout | Confirm order and allocate stock |
| Order history | Paginated; scoped to this customer |
| Order detail | |
| Download own order / invoice PDF | Only if listed on the wholesale API |
| Own account | Company they buy as — not other buyers |

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
| Credit limit and AR aging |
| Staff reports and charts |
| Spreadsheet import / export |
| Purchase orders |
| Stock adjustments |
| Line commission |
| Consumer storefront flag (not a v1 shop) |
| Sales tax lines or engine (v1 does not collect sales tax; reseller Tax ID and exemption files are customer paperwork only) |
