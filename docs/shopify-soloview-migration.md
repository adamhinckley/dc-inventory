# Migrating SoloView Shopify → DC Inventory

Planning and access only. Do not implement `packages/shopify-bridge` from this note. Implementation waits on [ADR 0008](./adr/0008-available-to-sell-open-locked.md) ATP plus Sales confirm/commit, then the [Shopify channel](https://linear.app/adamhinckley/project/shopify-channel-86c419ea2311) packets ([ADA-265](https://linear.app/adamhinckley/issue/ADA-265/shopify-channel-implementation-map)). Target contract: [ADR 0009](./adr/0009-shopify-channel-hub.md) and [`future-concepts/shopify-channel.md`](./future-concepts/shopify-channel.md).

This repo has no SoloView / SoloVue source, admin screenshots, or API docs. Do not invent how the current sync works. Discover it from David, SoloVue, and Shopify admin.

---

## Purpose

Replace SoloView’s Shopify **inventory push** with DC Inventory. Keep Faire where it is today: Shopify’s **Faire: Sell Wholesale** sales channel republishes inventory to Faire. Retail Shopify stays the busy consumer site; Faire stays wholesale for smaller retailers.

DC Inventory owns catalog, ledger, and (later) orders. Shopify is the external hub. Native Faire Partner API stays deferred.

Orders and fulfillments are later phases of the Shopify channel — not the first cutover job. The first job is: DC becomes the only writer of Shopify location quantity, using computed `availableToSell`, not warehouse leftover `available`.

---

## What we know vs what we must discover

### Known (calls + ADR — not SoloView internals)

From [2026-08-27 highlights](./transcripts/2026-08-27/highlights.md) and [ADR 0009](./adr/0009-shopify-channel-hub.md):

- SoloView pushes inventory to Shopify.
- Shopify’s Faire: Sell Wholesale channel republishes that inventory to Faire. Faire does not talk to SoloView.
- Retail Shopify is the busy site. Faire is the smaller-retailer wholesale surface.
- Shopify Plus could not express David’s available-to-sell formula. This product will, then push the **computed** number into Shopify.

From [2026-09-07 highlights](./transcripts/2026-09-07/highlights.md) (D7, L3):

- David thinks the SoloView ↔ Shopify link has been in place ~4–5 years.
- Adam’s working assumption: it is **not** GraphQL — classic Admin REST / a legacy custom-or-private app. Confirm in admin. Do not treat that as proven.
- Someone named Virginia checks the connection weekly. Ask David who that is and what they look at.
- Shopify GraphQL channel is **after** SoloView parity (L3), not v1 demo work.

### Discovery checklist

We do not have SoloView source or Shopify admin screenshots here. Get these from David, SoloVue support, and Shopify admin (read-only on the existing app is enough):

| Find | Why |
|---|---|
| App name in Shopify admin (Settings → Apps, including legacy custom apps) | Identify the live writer without guessing |
| REST vs GraphQL (and which Admin API version) | Documents today’s behavior; DC will not copy the transport |
| Granted scopes | Compare to the minimum table below |
| Shopify location(s) the push writes | Inventory is usually one location pool; confirm before mapping |
| SKU matching rule (variant SKU = item code? barcode? handle?) | Mapping table is SKU ↔ variant GID / inventory item GID |
| Sync frequency / trigger (on change, cron, manual, weekly check) | Parallel-run and cutover windows |
| Whether SoloView also pushes products, prices, or fulfillments | Inventory-only vs hidden catalog/ops writes |
| Who owns the app credentials (SoloVue, David, Virginia, a contractor) | Who can disable the push at cutover |
| SoloVue support contact | Needed if only they can turn the push off |

Do not write a second guessed integration from these answers. Record them; implement against ADR 0009.

---

## Why this is not a literal REST copy

The ~4-year SoloView link is likely Admin REST on a legacy custom (or older private) app. DC Inventory is not a REST clone of that app.

Shopify marked the [REST Admin API](https://shopify.dev/docs/api/admin-rest) **legacy as of 2024-10-01**. New work uses GraphQL ([REST → GraphQL migration](https://shopify.dev/docs/apps/build/graphql/migrate)). This product’s own API stays OpenAPI/REST; GraphQL is an **outbound** adapter only ([ADR 0009](./adr/0009-shopify-channel-hub.md) decision 7).

Copy the **behavior** we care about: push a computed quantity, by SKU, to a Shopify location. Implement it with Admin GraphQL (`inventorySetQuantities` of `availableToSell`) and a **new** Dev Dashboard app. Shopify’s path for “connecting an existing system” is [Create apps using the Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard).

Do **not** create a new **legacy** custom app in merchant admin. Shopify blocked that on 2026-01-01; existing apps keep working ([changelog](https://changelog.shopify.com/posts/legacy-custom-apps-can-t-be-created-after-january-1-2026)). Leave SoloView’s app running until cutover.

---

## Migration phases

Never dual-write conflicting quantities to the same Shopify location. Two writers on one location is an oversell on Shopify **and** Faire.

| Phase | Who writes Shopify qty | Work |
|---|---|---|
| **1. Discovery** | SoloView | Checklist above. Read-only look at the existing app. No DC writes. |
| **2. Dev store app + mapping** | neither (dev store only) | Partner development store. New Dev Dashboard app. SKU ↔ GID map. Push `availableToSell` against test products. Bogus Gateway / Shopify Payments **test mode** — not the live brand shop. |
| **3. Parallel run** | **SoloView** on production | DC may run on the **dev store**, or read production mapping, but must **not** `inventorySetQuantities` on the live location SoloView already owns. Compare DC’s computed qty to Shopify’s qty offline. |
| **4. Cutover** | **DC Inventory** | Disable the SoloView push first (SoloVue / credential owner). Then DC becomes the only writer. Confirm Faire still mirrors Shopify. Keep the old app installed until the first week looks right; do not leave it pushing. |
| **5. Orders / fulfillment** | DC (inventory) + Shopify (orders in) | Per [`shopify-channel.md`](./future-concepts/shopify-channel.md) phases 2–4: webhook inbox + GraphQL reconcile, then fulfillments, then optional catalog link/push. |

Prerequisites for phase 2+ code: ADR 0008 live, Sales draft → confirm (`Committed`) → ship against `Allocated`. This document does not open those packets.

---

## Developer access Adam needs

Shopify Help Center: custom apps are created and managed in the [Dev Dashboard](https://help.shopify.com/en/manual/apps/about-apps). Store owners have that by default. Staff need **App development → Develop**. **Collaborators cannot access the Dev Dashboard** (no org-level permission).

### Checklist for David

1. **Free Shopify Partner / Dev Dashboard access for Adam.** Adam creates a Partner account if he does not already have one. This is enough for a development store and an API-only app.
2. **A way onto David’s Shopify org — pick one:**
   - **Staff (preferred for org-owned app):** David adds Adam as staff with **App development → Develop**. Adam can then create the DC app in that org and use [client credentials](https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens) on stores in the same organization.
   - **Install (if Adam’s app lives in Adam’s Partner org):** Adam creates the app in the Dev Dashboard and David installs it on the store via **custom distribution**. Client credentials only work when the app and the store are in the **same** Shopify organization. A store outside that org needs the install + authorization-code grant (Shopify CLI handles that flow). Collaborator access is not a substitute for Dev Dashboard.
3. **Development store** created from the Dev Dashboard (Stores → Create store → Dev). Safe testing. No live charges. Not the brand shop.
4. **Credentials for the new DC app** (not a forever admin “Develop apps” Admin API token — that pattern is the old legacy custom app):
   - Shop domain (`{shop}.myshopify.com`)
   - **Client ID** and **Client secret** (Dev Dashboard → app → Settings)
   - Webhook signing secret (HMAC on `POST /webhooks/shopify`; usually the app’s client secret unless the subscription shows another)
   - Tokens from client credentials **expire ~24h** (`expires_in` is 86399 seconds). The adapter refreshes; nobody pastes a permanent token into chat or git.
5. **Production install** on the brand shop only at cutover, after the dev store is green. When scopes change, Shopify does **not** apply them automatically — the merchant must approve the new version in admin.
6. **Optional, read-only:** let Adam see the existing SoloView / legacy custom app (name, scopes, last updated) so we can document current access without rotating its credentials or turning it off.

### Minimum scopes by phase

Write includes read. Request write only when the phase needs it. Source: [Access scopes](https://shopify.dev/docs/api/usage/access-scopes).

| Phase | Need | Minimum scopes |
|---|---|---|
| Dev store / inventory push | `inventorySetQuantities` of `availableToSell`; read levels to verify | `write_inventory` |
| Mapping | Variant / inventory item GIDs by SKU | `read_products` |
| Locations | Which location the push targets | `read_locations` |
| Orders + webhooks | Ingest `orders/create` / `orders/paid`; GraphQL pull to heal | `read_orders` |
| Orders older than 60 days | Backfill / reconcile beyond the default window | `read_all_orders` — **Partner approval** required; use with `read_orders` |
| Fulfillment | Tracking after `ShipSalesOrder` | `write_merchant_managed_fulfillment_orders` (and `write_fulfillments` if the packet needs the Fulfillment resource). Do not add until phase 5. |
| Catalog later | Link existing variants by SKU; push new products only when a packet says so | `read_products` to link; `write_products` only for a product-push packet |

`read_customers` / address fields on orders: **protected customer data**. Shopify will not return that PII from a non-development store until the app is approved for it. Order ingest that needs names, emails, or addresses must start that review before production. Development stores can be used to build without it.

Do not request `read_all_orders` or protected-customer-data scopes on day one of inventory push.

---

## Cutover risks

- **Wrong ATP oversells Shopify and Faire.** They share the Shopify location qty. Push `availableToSell`, never raw warehouse `available`. If ADR 0008 is wrong or not live, do not cut over.
- **Two writers.** SoloView and DC both calling inventory set on the same location will fight. Disable SoloView first.
- **Faire is a mirror.** After cutover, confirm Faire still shows the Shopify number. Do not “fix Faire” with a native API.
- **Webhook URL** (order phases) must be public HTTPS on the API host. Shopify will not deliver to localhost. HMAC, 2xx quickly, drain the Postgres inbox async ([ADR 0009](./adr/0009-shopify-channel-hub.md)).
- **Scope / PII surprise.** Production order ingest without protected-customer-data approval yields empty customer fields. Historical orders need `read_all_orders` or you only see 60 days.
- **Live shop first.** Do not. Partner development store + Bogus Gateway / Payments test mode.

---

## Open questions for David / SoloVue

- What is the exact app name in Shopify admin, and is it a legacy custom app created in admin?
- REST or GraphQL, and which API version?
- Which location ID(s) receive inventory? One pool or more?
- How does a SoloView item code become a Shopify variant (SKU field, barcode, something else)?
- How often does the push run, and who notices when it stops (Virginia’s weekly check)?
- Does SoloView write anything besides inventory (products, prices, fulfillments, order updates)?
- Who can disable the push — SoloVue support, David, or the credential owner?
- SoloVue support contact and typical turnaround to turn the integration off.
- Will Adam be added as **staff with Develop**, or will David only install an app Adam created?
- Confirm we may create a Dev Dashboard development store and never point the first GraphQL writes at the live brand shop.

---

## Sources

**In repo**

- [2026-08-27 highlights](./transcripts/2026-08-27/highlights.md) — SoloView → Shopify → Faire; retail vs Faire; ATP formula Shopify Plus could not do
- [2026-09-07 highlights](./transcripts/2026-09-07/highlights.md) — D7 existing REST-likely link (~4–5 years); L3 GraphQL channel after parity
- [ADR 0008](./adr/0008-available-to-sell-open-locked.md) — `availableToSell` vs warehouse `available`
- [ADR 0009](./adr/0009-shopify-channel-hub.md) — Shopify hub; GraphQL outbound; Faire deferred; webhook inbox
- [`future-concepts/shopify-channel.md`](./future-concepts/shopify-channel.md) — pipeline, phases, first-time Dev Dashboard setup

**Shopify (live)**

- [REST Admin API is legacy (2024-10-01)](https://shopify.dev/docs/api/admin-rest)
- [Migrate REST → GraphQL](https://shopify.dev/docs/apps/build/graphql/migrate)
- [Create apps using the Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard) (API-only / connect an existing system)
- [Client credentials; Client ID + secret; tokens expire ~24h](https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens)
- [Legacy custom apps cannot be created after 2026-01-01](https://changelog.shopify.com/posts/legacy-custom-apps-can-t-be-created-after-january-1-2026)
- [Access scopes](https://shopify.dev/docs/api/usage/access-scopes) (write includes read; `read_all_orders`; protected customer data)
- [About apps (Help Center)](https://help.shopify.com/en/manual/apps/about-apps) — Dev Dashboard; staff **Develop**; collaborators excluded
