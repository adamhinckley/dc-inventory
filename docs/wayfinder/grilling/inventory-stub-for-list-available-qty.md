---
title: "Inventory stub for list available qty"
tags: [wayfinder, grilling]
status: active
created: 2026-08-23
---

# Inventory stub for list available qty

HITL on [Inventory stub for list available qty](https://linear.app/adamhinckley/issue/ADA-62/inventory-stub-for-list-available-qty). Parent: [Phase 1 implementation spec map](https://linear.app/adamhinckley/issue/ADA-56/phase-1-implementation-spec-map).

## Decision

Phase 1 list endpoints **read** `inventory.stock_snapshots` (`on_hand`, `on_order`, `allocated`, generated `available`). **No snapshot row → all four quantities are 0.**

- Keep qty columns on the **internal** product list (`onHand`, `onOrder`, `allocated`, `available`).
- Wholesale catalog keeps `available` from the same read (missing → 0).
- [How real catalog rows appear](https://linear.app/adamhinckley/issue/ADA-69/how-real-catalog-rows-appear) seed stays catalog-only: **do not** insert snapshot rows to fake stock.
- Catalog **must not** write qty or `available`.
- Do **not** keep today’s hardcoded wholesale stub counts (48/120/0).
- Do **not** use a Catalog-owned stub port that always returns 0 while skipping the snapshot table — the empty projection is the stub until Phase 2 movements exist.

“Stub” in the ticket title means **empty real ATP projection**, not a fake number generator and not the Fastify hardcoded list.

## Ground

- [OpenAPI stub DTOs vs Phase 0 catalog columns](https://linear.app/adamhinckley/issue/ADA-59/openapi-stub-dtos-vs-phase-0-catalog-columns): list qty fields are snapshot columns; `available` is generated, not on `catalog.products`.
- Phase 0: `available` is never an input or dump field.
