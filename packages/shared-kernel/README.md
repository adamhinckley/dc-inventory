# `@dc-inventory/shared-kernel`

Tiny cross-context types for the modular monolith. **Do not grow this package.** If two contexts need the same concept, copy a snapshot or add a port.

## What lives here

Cross-context value objects (the only concepts other contexts should depend on):

- `Money` — integer **minor units** + ISO 4217 currency, validated at construction
- `Sku` — stock-keeping identity (not a product variant model)
- Branded IDs — `ProductId`, `CustomerId`, `OrderId`, `PurchaseOrderId`, `LocationId` (`DEFAULT` in v1), `TenantId`, `AddOnId`, `InstallationId`, `InvoiceId`, `SupplierId`

Also exported for callers of those types (not extra domain concepts):

- Errors — `InvalidMoneyError`, `CurrencyMismatchError`, `InvalidSkuError`, `InvalidIdError`
- Currency helpers — `normalizeCurrency`, `majorUnitExponent`
- `Brand` — the branded-string helper used by the IDs

## Allowed imports

Other packages may import **only** the symbols above from `@dc-inventory/shared-kernel`. Do not add use cases, ports, or adapters here.

Domain / application layers must **not** pull Fastify, Drizzle, Zod, or any HTTP/ORM/SDK types onto these value objects. Zod belongs at HTTP adapters.

Runtime consumers import the built `dist/` entry (`pnpm build`). Tests import TypeScript source via Vitest.

## Forbidden

- Framework imports in this package
- Mixed-currency arithmetic / FX
- Turning this folder into a dumping ground

## How to test

From this directory (self-contained until the root pnpm workspace wires `packages/*`):

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

`strict: true` is on. Stop when typecheck and tests are green.
