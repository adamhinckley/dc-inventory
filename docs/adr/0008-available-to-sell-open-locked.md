# Available to sell is on-hand plus on-order minus pre-sold

Status: Accepted
Date: 2026-08-27
Amended: 2026-08-27 (per-SKU sell window; calendar can lock with no PO)

David Smith (David Christopher's) stays on SoloView because of availability math Shopify Plus and other vendors could not do. On the 2026-08-27 call he stated the formula and the two modes. This repo's v1 ATP (`available = on_hand − allocated`, inbound shown not sellable) is the opposite of that product. We change the projection and add demand movements. We do not start a second ledger, and we do not switch to database-per-company.

## Decision

1. **Two numbers, both Inventory-owned.** `available` stays warehouse leftover: `on_hand − allocated`, never negative. `availableToSell` is what a customer may still buy. Frontends never compute either. Shop and staff screens must not treat `available` as the sellable figure.

2. **Locked formula (product law).** For a locked SKU:

   ```
   availableToSell = on_hand + on_order − committed
   ```

   `committed` is pre-sold: confirmed sales qty not yet shipped or decommitted. Once pre-sold hits on-hand plus open PO qty, stop selling even if nothing has hit the warehouse. Receive later, then ship.

3. **Open vs locked is per SKU per organization.** Not a company-wide selling season flag. A new SKU starts **open**: confirm has no numeric sellability cap (credit and other gates still apply). He does not know if the item will move 100 or 100,000. The first `InboundFromPo` for that SKU **locks** it. An optional **sell window** can also lock it with no PO (decision 4). Lock is sticky after receive, after PO cancel, and after the window closes. Staff **reopen** selected SKUs for the next pre-sell (returning leftover floor stock that must sell past on-hand before the next factory PO). Reopen takes a list of SKUs. There is no global open/closed switch.

4. **Sell window (calendar).** Optional `windowOpensAt` and `windowClosesAt` per SKU (same grain as the snapshot). Staff set them on reopen; a batch may share one pair of instants. Compare to an **injected clock** on confirm and on any read of `availableToSell` / effective sell state. No cron.

   Effective **open** only when all of: not already sticky-locked, `now >= windowOpensAt` if that instant is set, `now < windowClosesAt` if that instant is set. Otherwise **locked** (the three-part formula). A first `InboundFromPo` locks immediately even if `now` is still inside the window. Whichever happens first wins. After the clock has closed the window, persist sticky locked on the next inventory write that observes it so clearing the dates later does not reopen.

   Missing both instants: same as today — open until the first PO. Only `windowClosesAt`: infinity until that instant or the first PO. Only `windowOpensAt`: locked (floor + inbound) until that instant, then open until a PO. `windowOpensAt >= windowClosesAt` is invalid. Timezone is the stored timestamptz vs the clock, not a second policy.

5. **Two-phase stock against a sales order.** Confirm records `Committed` (demand) in the same transaction as the order status change, with a row lock on the snapshot. `Allocated` is warehouse cover against `on_hand` only. Ship consumes `Allocated`. Cover as much as leftover `available` allows at confirm; cover the rest FIFO when `GoodsReceived` raises on-hand. Partial cover is expected. Partial **confirm** is not: reject the whole confirm if any locked line exceeds `availableToSell`.

6. **Uncovered is the PO worksheet, not sellability.**

   ```
   uncovered = max(0, committed − on_hand − on_order)
   ```

   That list is "you sold 1,200, nothing on hand, nothing on a PO, you need to order it." Do not show it as available to sell. Do not add a purchase-request document. Restock past the gap is a purchasing choice (order 700 to fill plus 1,200 for the floor). The worksheet does not invent the extra floor qty.

7. **Same ledger, additive schema.** Grain stays `(organization_id, sku, location_id)`. Add `committed`, `sell_state`, `windowOpensAt`, `windowClosesAt`, and derived `availableToSell` on the snapshot. Add `Committed` and `Decommitted` movement types. `available` stays a generated `on_hand − allocated`. Because cover can land in more than one movement (confirm leftover, then receive), `Allocated` is no longer once-only per `(ref_type, ref_id, sku)`. Idempotency keys distinguish cover chunks. Movements stay append-only.

## Considered and rejected

- **Company-wide selling season as the infinity switch.** One org-wide open/closed flag is not the lock. Dates live on SKUs. Staff apply the same window to many SKUs with one reopen command. That is still per SKU, not a season row that flips the catalog.
- **Keep `Allocated` as both demand and warehouse hold.** Then `available = on_hand − allocated` goes negative when we sell against a PO or before a PO, and ship can no longer mean "take from warehouse cover." Demand and cover are different facts.
- **Only reverse I6 (sell against inbound, still require a PO).** That still cannot sell a new item before any factory PO exists.
- **Database per company.** Isolation is `OrganizationId` ([ADR 0007](./0007-organization-id-current-not-deferred.md)). Pitch on the call does not change the contract.

## Consequences

- Sales confirm no longer fails on warehouse `available`. It fails on locked `availableToSell`. Open SKUs do not fail that gate. "Locked" includes calendar close with `on_order = 0`: leftover on-hand may still sell; infinity does not.
- Purchasing `InboundFromPo` and the sell-window close both flip open → locked. Receiving does not reopen.
- Cancel of a confirmed order emits `Decommitted` and, if cover exists, `Deallocated`.
- Line-level decommit (manufacturer miss / code red) is the same `Decommitted` movement. Email to holders is a later packet. No refund engine.
- Catalog and HTTP qty DTOs grow `committed`, `sellState`, and `availableToSell` additively. This ADR does not change Next.js screens.
- Demo seed and stock replay must learn the new movements and must not treat `available` as sellable. Tests inject the clock.
- Multi-org tickets stay separate. Sell state is per organization (and per SKU). Do not wrap this math into ADA-157 children.

Related: [`docs/transcripts/2026-08-27/transcript.md`](../transcripts/2026-08-27/transcript.md), [`docs/transcripts/2026-08-27/highlights.md`](../transcripts/2026-08-27/highlights.md), [`invariants.md`](../invariants.md) I3 I4 I6 I9 I11, [Demand model — backend](https://linear.app/adamhinckley/project/demand-model-backend-c0810f4afefe) ([ADA-173](https://linear.app/adamhinckley/issue/ADA-173/demand-model-backend-implementation-map)).
