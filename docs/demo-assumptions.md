# Demo assumptions (not product law)

These locks apply to the **local demo** so later packets do not re-litigate the same choices. They are **not** [`invariants.md`](./invariants.md) §18. They do not close stakeholder gaps. They are not a substitute for committed `.env.example` / Compose env (names may be repeated here).

Do not edit `invariants.md` §18 or tick `open-questions.md` because of this file.

## Demo-only locks

| Lock | Demo meaning | Not |
|---|---|---|
| Invoice on ship | Accounting creates the invoice when the sales order ships. | Not G7 / §18 product law. |
| Cart = draft sales order | There is no separate carts table. A wholesale cart is a sales order in `draft`. | Not G5 product law. |
| Block oversell | Confirm/allocate fails when `available` is insufficient. | Does not invent inbound-sell or multi-warehouse ATP. |
| MP is shop price | Wholesale shop and order snapshots use `member_price_cents` only. | List price is a nullable stub; the shop must not read it. |
| In-memory tax for later demo **behavior** | When a later ticket wires checkout, tests and the demo calculator stay in-memory. | Tax **tables** exist empty. Hosted engine stays behind `ITaxCalculator`. Never `price * rate`. |

## Explicitly out of this demo phase

- Better Auth is **deferred**. Phase 1 uses opaque staff and wholesale sessions (HttpOnly cookies), not Better Auth `user` / `session` / `account` / `verification` tables.
- Phase 0 migrate still lands on **empty** Postgres. Phase 1 local/demo rows come from `pnpm db:seed:phase1` (not a migration, not CSV). The Phase 3 `seed:demo` history generator is still out.
- Catalog image **upload** against MinIO. MinIO boots so the box is complete; `IFileStorage` is not wired.
- Neon / production hosting and production secrets.
- Software-payment UI. Licensing and operator_bridge rows exist after migrate; they are not shown on ops/internal/wholesale screens in Phase 0. `IOperatorPlatform` stays no-op.

## How this relates to env

Placeholder names in [`.env.example`](../.env.example), [`apps/api/.env.example`](../apps/api/.env.example), and `docker-compose.yml` are the env contract. This document may repeat `DATABASE_URL` or MinIO key **names**. It does not authorize committing a real `.env`.
