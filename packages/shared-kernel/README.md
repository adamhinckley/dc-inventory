# `@dc-inventory/shared-kernel`

Tiny cross-context types for the modular monolith. **Do not grow this package.** If two contexts need the same concept, copy a snapshot or add a port.

## What lives here

- `Money` — integer **minor units** + ISO 4217 currency, validated at construction
- `Sku` — stock-keeping identity (not a product variant model)
- Branded IDs — `ProductId`, `CustomerId`, `OrderId`, `PurchaseOrderId`, `LocationId` (`DEFAULT` in v1), `TenantId`, `AddOnId`, `InstallationId`, `InvoiceId`, `SupplierId`

## Allowed imports

Other packages may import **only** the types above from `@dc-inventory/shared-kernel`.

Domain / application layers must **not** pull Fastify, Drizzle, Zod, or any HTTP/ORM/SDK types onto these value objects. Zod belongs at HTTP adapters.

## Forbidden

- Framework imports in this package
- Mixed-currency arithmetic / FX
- Turning this folder into a dumping ground (no use cases, ports, or adapters)

## How to test

From this directory (self-contained until the root pnpm workspace wires `packages/*`):

```bash
pnpm install
pnpm typecheck
pnpm test
```

`strict: true` is on. Stop when those two commands are green.
