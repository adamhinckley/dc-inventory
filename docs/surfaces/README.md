# Surfaces (v1)

Planned v1 UI surfaces from the architecture, API contract, and schema draft — not built yet. Some fields are still unverified in the current product dump.

Slack copy: [Dashboard and wholesale surfaces (v1)](https://shoalssoftware.slack.com/docs/T0BQVF37DMG/F0BSQHK7SJU).

| File | Audience |
| --- | --- |
| [`dashboard.md`](./dashboard.md) | Staff app (`apps/internal`) |
| [`wholesale.md`](./wholesale.md) | Client shop (`apps/wholesale`) |
| [`customer-account.md`](./customer-account.md) | Customer list, detail, wholesale `/account`, sales Customer link |
| [`insights.md`](./insights.md) | Owner metrics on the dashboard only |

Related: [`../architecture.md`](../architecture.md) · [`../api-contract.md`](../api-contract.md) · [`../database-design.md`](../database-design.md) · [`../open-questions.md`](../open-questions.md) · Shopify/Faire UIs stay on those products ([`../future-concepts/shopify-channel.md`](../future-concepts/shopify-channel.md))

The shop may show price, images, and available quantity. It must never show cost, supplier, or another customer’s orders. Stock numbers always come from the inventory snapshot, never a quantity typed on the product.

---

## Shown on both apps

What a staff user and a wholesale client can both see (different sessions; the client only sees their own company).

| Information or feature | Notes |
| --- | --- |
| Log in / log out | Separate cookies and sites |
| SKU | Stock-keeping identity |
| Product name | |
| Description | May be empty in today’s dump |
| Secondary name | Drop if unused after review |
| Product images | Staff upload; shop displays |
| Wholesale selling price | One of list price, member price, or original wholesale — business must pick |
| Available quantity | On hand minus allocated. Shop may instead show only in stock / not |
| Unit of measure | Sell / inventory unit |
| Default order quantity | Cart / line default |
| Categories / collections | Shop browse filter; staff tags |
| Product detail | Dashboard form vs shop product page |
| Place an order | Staff can place on behalf of a customer |
| Order lines (SKU, name, unit price frozen at order time, qty) | |
| Order status | Draft / confirmed / shipped / cancelled (exact labels TBD) |
| Own order history and order detail | Staff see all customers; shop sees only theirs |
| Own invoice / order PDF download | Shop only if we put it on the wholesale spec |

## Not v1 on either app

| Deferred |
| --- |
| Multiple warehouses / transfers |
| Company-wide selling season as the infinity switch |
| PO workspace UI, cube/container fill, CSV export screens |
| Product variants as a separate model |
| General ledger, AP, inventory valuation |
| Sales tax engine or invoice tax lines (v1 does not collect sales tax) |
| Credit memos, RMAs, blanket POs unless the business requires them day one |
| Parsing supplier PDFs into PO lines |
| Second wholesale company signup on the same site |
| Retail / consumer storefront |
| Embedded BI (Metabase, etc.) |
