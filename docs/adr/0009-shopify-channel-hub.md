# Shopify is the external marketplace hub

Status: Accepted
Date: 2026-09-03

## Context

David Christopher’s demand arrives on three surfaces: the wholesale shop we build, **Shopify retail** (busy site), and **Faire** wholesale (smaller retailers). Today SoloView pushes inventory to Shopify; Shopify’s **Faire: Sell Wholesale** sales channel republishes to Faire. Shopify Plus could not express David’s available-to-sell formula; this product will, then push the **computed** number into Shopify.

A native Faire Partner API is a second integration. Faire already consumes Shopify inventory and can copy accepted Faire orders into Shopify.

## Decision

1. **Shopify is the channel we integrate.** DC Inventory owns catalog, ledger, and orders. Shopify is the external hub for retail checkout and for Faire’s existing app. See [`future-concepts/shopify-channel.md`](../future-concepts/shopify-channel.md).
2. **Native Faire API stays deferred.** Keep Faire’s Shopify sales channel configured. Do not add `packages/faire-bridge` or Faire OAuth until a later packet explicitly opens that work.
3. **Push `availableToSell`, not warehouse `available`.** Shopify and Faire share Shopify location qty. Wrong ATP oversells both channels. Prerequisite: [ADR 0008](./0008-available-to-sell-open-locked.md) implemented.
4. **One webhook pipe, two order kinds.** Branch on Shopify sales channel / `sourceName` (and Faire tags/notes as backup): Online Store → retail (Shopify collected payment); Faire: Sell Wholesale → wholesale Faire (Faire collected payment and retailer terms). Do not treat Faire copies as Shopify card charges or as in-house terms AR.
5. **Anti-corruption package.** `packages/shopify-bridge` (when packets open). Sales, Catalog, and Inventory stay Shopify-free. Mapping table: SKU ↔ Shopify variant GID / inventory item GID; Shopify order id + channel on ingest (idempotent).
6. **Webhooks + Postgres inbox.** Public HTTPS on Fastify, HMAC, 2xx quickly, drain async. Reconciliation GraphQL pull heals missed events. Not Redis, Kafka, or Shopify EventBridge unless a later packet says so.
7. **This product’s API stays OpenAPI/REST.** [Shopify Admin GraphQL](https://shopify.dev/docs/api/admin-graphql/latest) is an **outbound** adapter only.
8. **Not in the first demo.** Implementation waits on Demand model + Sales confirm/commit. Tracked on [Shopify channel](https://linear.app/adamhinckley/project/shopify-channel-86c419ea2311) ([ADA-265](https://linear.app/adamhinckley/issue/ADA-265/shopify-channel-implementation-map)).

## Consequences

- Agents must not sneak Shopify SDK types into Sales/Catalog/Inventory domain, and must not start a native Faire client “to be helpful.”
- Open SKU sentinel qty for Shopify, Faire commission/net settlement, and retail `Customer` identity are owner-gated ([`invariants.md`](../invariants.md) §18 style): failing tests first.
- Test against a Partner development store and Bogus Gateway / Shopify Payments test mode — not the live brand shop.

Related: [2026-08-27 highlights](../transcripts/2026-08-27/highlights.md) (SoloView → Shopify → Faire). First GraphQL app: [Create apps using the Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard) (API-only; see [`shopify-channel.md`](../future-concepts/shopify-channel.md) § First-time Shopify setup).
