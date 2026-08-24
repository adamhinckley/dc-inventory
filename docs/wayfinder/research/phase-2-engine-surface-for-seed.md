---
title: "Phase 2 engine surface a generator can call"
tags: [wayfinder, research]
status: active
created: 2026-08-24
---

# Phase 2 engine surface a generator can call

Ticket: [ADA-115](https://linear.app/adamhinckley/issue/ADA-115/phase-2-engine-surface-a-generator-can-call). Spec source: [ADA-105](https://linear.app/adamhinckley/issue/ADA-105/phase-2-implementation-spec-stock-ledger-and-manual-order-to-cash).

This note records what ADA-105 names, and what TypeScript classes and HTTP routes exist, on two git trees. It does not choose how a Phase 3 seed should write rows.

## Trees compared

| Tree | Tip | Engine packages (`inventory`, `purchasing`, `sales`, `accounting`) | Catalog / Customers packages |
|---|---|---|---|
| Checkout used to create this branch (`HEAD` of `main` at worktree add) | `6a372aab11162fe7443861c301ce443ac81167d2` | Absent (`git cat-file` on `packages/inventory` fails) | Absent |
| `origin/main` | `e11b737eb191a7685026655dd8129f75a17b7aad` | Present | Present (`packages/catalog`, `packages/customers`, `packages/identity`) |

At worktree creation, local `main` was 31 commits behind `origin/main`. Those 31 include the Phase 1 catalog/customers/seed merges and the Phase 2 PR merges listed below.

Unless a path is labeled `HEAD`, file paths in this note are from `origin/main`.

### Phase 2 branches still on the remote

`origin/main` already contains these merge commits (newest first):

- `e11b737` `[ADA-112] Authenticated manual Fastify flow: PO to payment (#55)`
- `c0fd9f1` `[ADA-111] Ship sales order and post zero-tax invoice atomically (#54)`
- `74609eb` `[ADA-107] Accounting invoice, payment, and staff HTTP (#53)`
- `b620995` `[ADA-109] Sales staff HTTP: draft, confirm, and cancel orders (#52)`
- `4c88c4c` Merge PR `#51` `ahinckley2/ada-110-purchasing-staff-http-create-confirm-receive-cancel-pos`
- `978330e` `[ADA-108] Inventory ledger implementation (#50)`
- `83a019c` `[ADA-106] Inventory ports and failing ledger tests (#49)`

Remote feature branches still exist. `git rev-list --count origin/main..<branch>`:

| Branch | Commits not reachable from `origin/main` |
|---|---|
| `origin/ahinckley2/ada-110-purchasing-staff-http-create-confirm-receive-cancel-pos` | 0 |
| `origin/ahinckley2/ada-106-inventory-ports-and-failing-ledger-tests` | 3 |
| `origin/ahinckley2/ada-108-inventory-ledger-implementation` | 4 |
| `origin/ahinckley2/ada-109-sales-staff-http-draft-confirm-and-cancel-orders` | 2 |
| `origin/ahinckley2/ada-111-ship-sales-order-and-post-zero-tax-invoice-atomically` | 2 |
| `origin/ahinckley2/ada-107-accounting-invoice-payment-and-staff-http` | 4 |
| `origin/ahinckley2/ada-112-authenticated-manual-fastify-flow-po-to-payment` | 2 |

The leftover SHAs on the squash-style branches are the pre-merge topic commits (for example ADA-106 `c61cb7d` “add inventory ports…”). The matching packages are on `origin/main` via the PR merge commits.

On `HEAD` (`6a372aa`), `apps/api/src/application/` is only `ping.ts` and `ready.ts`. `apps/api/src/internal/routes.ts` registers stub `GET /products` only.

## What ADA-105 names

Quotes from ADA-105 **Staff HTTP and generated contract**:

> Add internal Zod/OpenAPI operations for purchase-order create, confirm, receive, and cancel; sales-order create, confirm, cancel, and ship; invoice read; and record payment.

> Command request bodies include required idempotency keys where the domain command has a stock or payment effect.

> The API app remains the composition root. It wires Postgres and in-memory adapters, staff session enforcement, Zod HTTP adapters, and the cross-context unit of work.

ADA-105 **Highest seams**:

> The primary interface and test seam is the application command/query use case.

> Inventory exposes synchronous command interfaces for inbound confirmation, receipt, inbound cancellation, allocation, deallocation, shipment, and adjustment, plus a snapshot read interface.

ADA-105 **Cross-context unit of work**:

> Confirm purchase order commits Purchasing state plus `InboundFromPo` together.
> Receive commits Purchasing receipt progress plus `GoodsReceived` together.
> Confirm sales order commits Sales state plus `Allocated` together.
> Cancel confirmed sales order commits Sales state plus `Deallocated` together.
> Ship commits Sales state, `Shipped`, and invoice creation together.
> Record payment and application commit together inside Accounting.

ADA-105 **Document numbers**:

> Drafts receive `PO-00001`-style numbers on insert
> Drafts receive `SO-00001`-style numbers on insert
> Invoices receive `INV-00001`-style numbers when inserted

ADA-105 **Out of scope** includes “Phase 3 historical seed generation” and “Do not start or imitate the Phase 3 history generator.”

ADA-105 **Bootstrap**:

> Add a re-runnable Phase 2 bootstrap that ensures `DEFAULT` location and one supplier prerequisite exist after the Phase 1 seed.
> The bootstrap writes no stock movement, no snapshot, no adjustment, and no open purchase order.

## Named commands vs code on `origin/main`

HTTP paths are under the staff mount `/internal` (`apps/api/src/internal/routes.ts`).

| ADA-105 name | Application class (`origin/main`) | Staff HTTP (`origin/main`) |
|---|---|---|
| PO create | `CreatePurchaseOrderUseCase` `packages/purchasing/src/application/create-purchase-order.ts`. Request has `staffUserId`, `supplierId`, `lines`. No `idempotencyKey`. Assigns `documentNumber` via `IPurchaseOrderRepository.nextDocumentNumber()`. | `POST /purchase-orders` `createInternalPurchaseOrder` in `apps/api/src/adapters/http/internal-purchase-orders.ts` |
| PO confirm | `ConfirmPurchaseOrderUseCase`. Request includes `idempotencyKey`. Constructor takes `IPurchasingUnitOfWork`. | `POST /purchase-orders/:id/confirm` `confirmInternalPurchaseOrder`. Body `purchaseOrderCommandBodySchema`: `idempotencyKey: z.string().min(1)` (`apps/api/src/schemas.ts`) |
| PO receive | `ReceivePurchaseOrderUseCase`. Request includes `idempotencyKey` and line quantities. | `POST /purchase-orders/:id/receive` `receiveInternalPurchaseOrder`. Body also requires `lines[].lineId` UUID and positive `quantity`. |
| PO cancel | `CancelPurchaseOrderUseCase`. Request includes `idempotencyKey`. | `POST /purchase-orders/:id/cancel` `cancelInternalPurchaseOrder` |
| Sales draft create | `CreateSalesOrderUseCase` `packages/sales/src/application/create-sales-order.ts`. No `idempotencyKey`. `nextDocumentNumber()` on insert. | `POST /sales-orders` `createInternalSalesOrder` |
| Sales confirm | `ConfirmSalesOrderUseCase`. `idempotencyKey`. Uses `ISalesUnitOfWork`. | `POST /sales-orders/:id/confirm` `confirmInternalSalesOrder` |
| Sales ship | `ShipSalesOrderUseCase`. `idempotencyKey`. Result type is `{ ok: true; salesOrder }` or failure. No `invoiceId` on the result type. | `POST /sales-orders/:id/ship` `shipInternalSalesOrder`. Handler returns `mapSalesOrder(result.salesOrder)` only. |
| Sales cancel | `CancelSalesOrderUseCase`. `idempotencyKey`. | `POST /sales-orders/:id/cancel` `cancelInternalSalesOrder` |
| Invoice read | `GetInvoiceUseCase` `packages/accounting/src/application/get-invoice.ts`. Looks up by `invoiceId` only. | `GET /invoices/:id` `getInternalInvoice`. No `GET /invoices` list. No HTTP that takes `orderId`. |
| Record payment | `RecordPaymentUseCase`. Request: `invoiceId`, `amountCents`, `currency`, `idempotencyKey`. Uses `IAccountingUnitOfWork`. | `POST /invoices/:id/record-payment` `recordInternalInvoicePayment` |

Also on `origin/main` (not in the ADA-105 HTTP bullet above): `ListPurchaseOrdersUseCase` / `GetPurchaseOrderUseCase` (`GET /purchase-orders`, `GET /purchase-orders/:id`); `ListSalesOrdersUseCase` / `GetSalesOrderUseCase` (`GET /sales-orders`, `GET /sales-orders/:id`).

### Inventory movements

Application classes exist and are exported from `packages/inventory/src/index.ts`:

- `RecordInboundFromPoUseCase`
- `RecordGoodsReceivedUseCase`
- `RecordInboundCancelledUseCase`
- `RecordAllocatedUseCase`
- `RecordDeallocatedUseCase`
- `RecordShippedUseCase`
- `RecordAdjustmentIncreaseUseCase`
- `RecordAdjustmentDecreaseUseCase`
- `GetStockSnapshotUseCase`

Command types on `IStockLedger` (`packages/inventory/src/domain/ports/stock-ledger.ts`) all include `idempotencyKey`, `sku`, `quantity`, `refType`, `refId`.

There is no `apps/api/src/adapters/http/internal-inventory.ts` and no `GetStockSnapshotUseCase` wiring under `apps/api`. Purchasing and sales call inventory through ports inside a unit of work (`IInventoryCommandPort` in `packages/purchasing/src/domain/ports/purchase-order-repository.ts`; sales equivalent in `packages/sales`). Composition adapters: `apps/api/src/adapters/inventory-command-port.ts`, `sales-inventory-command-port.ts`.

HTTP tests that need on-hand call `RecordAdjustmentIncreaseUseCase` in-process (`apps/api/src/adapters/http/internal-sales-orders.test.ts`), not a staff adjustment route.

### Invoice create and payment correction

`CreateInvoiceUseCase` exists (`packages/accounting/src/application/create-invoice.ts`). Ship calls `scope.accounting.createInvoiceForOrder(...)` (`packages/sales/src/application/ship-sales-order.ts`). `CreateInvoiceUseCase` is not registered in `accountingServices()` in `apps/api/src/infrastructure/composition.ts` (that object exposes only `getInvoice` and `recordPayment`).

`CorrectPaymentUseCase` exists and is used from `packages/accounting/tests/accounting.test.ts`. No staff HTTP route calls it.

### How the Fastify flow reads the invoice id

`apps/api/src/adapters/http/phase2-manual-flow.test.ts` after ship does:

```ts
const invoiceId = (
  await unitOfWork.invoices.findByOrderId(OrderId.parse(order.id))
)
```

then `GET /internal/invoices/${invoiceId}`. `IInvoiceRepository.findByOrderId` exists on Drizzle and in-memory adapters. `GetInvoiceUseCase` does not call it.

## Idempotency keys

ADA-105 user story 21: confirm, receive, ship, cancellation with a stock effect, and adjustment require an idempotency key. Story 76: record-payment requires an idempotency key.

On `origin/main`:

- Zod `purchaseOrderCommandBodySchema` and sales command body require `idempotencyKey` min length 1 (`apps/api/src/schemas.ts`).
- Receive body includes the same key plus lines.
- Record-payment body includes `idempotencyKey` (`internal-invoices.ts`).
- Create PO / create SO application requests have no key field.
- Inventory ledger commands require a key on every movement type including adjustments.
- Confirm/receive/cancel/ship use cases pass the HTTP key into inventory, sometimes suffixed per line (ship: `` `${input.idempotencyKey}:ship:${line.id}` `` in `ship-sales-order.ts`).

## Document-number allocators

Separate formatters, 5-digit padding:

- `packages/purchasing/src/domain/document-number.ts`: prefix `PO-`
- `packages/sales/src/domain/document-number.ts`: prefix `SO-`
- `packages/accounting/src/domain/document-number.ts`: prefix `INV-`

Allocation is `nextDocumentNumber()` on each context repository (Drizzle and in-memory adapters). Create PO/SO call it on insert. Invoice numbers are assigned in `CreateInvoiceUseCase` / sales accounting adapter on ship (`packages/sales/src/adapters/accounting-command-adapter.ts` also calls `this.invoices.nextDocumentNumber()`).

There is no shared global sequence type across those three files.

## Composition-root unit of work

`apps/api/src/domain/unit-of-work.ts` (`origin/main`):

```ts
export interface IUnitOfWork {
  readonly inventory: {
    readonly ledger: IStockLedger;
    readonly readModel: IInventoryReadModel;
  };
  readonly purchasing: IPurchasingUnitOfWork;
  readonly sales: ISalesUnitOfWork;
  run<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}
```

Accounting is not a field on `IUnitOfWork`. Invoice create during ship goes through `ISalesUnitOfWork.accounting`. Payment uses a separate `IAccountingUnitOfWork`: `PostgresAccountingUnitOfWork` (`apps/api/src/adapters/postgres-accounting-unit-of-work.ts`) and in-memory accounting UoW in the accounting package.

Cross-context in-memory adapter: `apps/api/src/adapters/in-memory-unit-of-work.ts` (`InMemoryUnitOfWork`). Postgres cross-context adapter file is named `apps/api/src/adapters/postgres-inventory-unit-of-work.ts` (`PostgresInventoryUnitOfWork implements IUnitOfWork`). Comment: “Serializes callers and runs each callback in one Drizzle transaction.” Repositories on that class throw if accessed outside `run`.

HTTP confirm/receive/cancel/ship are constructed with `unitOfWork.purchasing` or `unitOfWork.sales` (`composition.ts` `purchasingServices` / `salesServices`). Record payment is constructed with `accountingUnitOfWork`.

## Staff HTTP vs in-process CLI

Staff HTTP is the driving adapter for the named PO / SO / invoice / payment operations. Controllers call `request.server.purchasing.*` / `sales.*` / `accounting.*` use cases (`internal-purchase-orders.ts`, `internal-sales-orders.ts`, `internal-invoices.ts`). Routes sit behind `registerStaffAudienceGuard` (`internal/routes.ts`).

The only seed CLI on `origin/main` root/`apps/api` package.json is `db:seed:phase1` → `tsx src/seed/cli.ts`. That file imports catalog, customers, and identity Drizzle repositories and `runPhase1Seed`. It does not import purchasing, sales, accounting, or inventory use cases. There is no `pnpm seed:demo` and no `scripts/seed-demo/` on `origin/main`.

`runPhase2Bootstrap` lives at `packages/inventory/src/bootstrap/run-phase2-bootstrap.ts` and is wrapped for Drizzle in `apps/api/src/seed/run-phase2-bootstrap.ts` (`runPhase2BootstrapOnDb`). `git grep` on `origin/main` finds no other TypeScript caller of `runPhase2BootstrapOnDb`. Package tests call `runPhase2Bootstrap` with in-memory ports (`packages/inventory/tests/bootstrap.test.ts`). `cli.ts` does not call Phase 2 bootstrap.

Use cases are ordinary classes with `execute`. Tests and `composeAppServices` construct them in-process. Nothing in `apps/api/package.json` besides `db:seed:phase1` is a CLI entry that runs those classes.

## Catalog and customers for 800–1,500 products and 60–100 customers

Phase 1 CRUD use cases on `origin/main`:

- `CreateProductUseCase` `packages/catalog/src/application/create-product.ts`. Duplicate SKU returns `{ ok: false, reason: "duplicate_sku" }` after `findBySku`. Rejects qty write fields (`qty_not_allowed`). HTTP: `POST /products` `createInternalProduct` maps duplicate SKU to 409.
- `UpdateProductUseCase`, list/get staff and wholesale reads.
- `CreateCustomerUseCase` `packages/customers/src/application/create-customer.ts`. Failure reason is only `"invalid"` (empty name/terms or thrown parse). No `findByName` inside create. HTTP: `POST /customers` `createInternalCustomer`. Nested HTTP exists for contacts, ship-tos, exemption certificates.

Phase 1 seed upsert (not those create use cases): `apps/api/src/seed/run-phase1-seed.ts`. Comment on `runPhase1Seed`: “Upsert Phase 1 local/demo rows. Does not write contacts, ship-tos, exemptions, ops users, sessions, or stock snapshots.” Implementation: `findByName` then `save` for the one fixture customer; `findBySku` then `save` for five SKUs in `PHASE1_PRODUCTS`; staff/wholesale by email. `cli.ts` logs “Phase 1 seed upserted …”.

`ICustomerRepository.findByName` exists for that seed path (`packages/customers/src/domain/ports/customer-repository.ts`). `CreateCustomerUseCase` does not use it.

Purchasing has `ISupplierRepository.save` / `findByVendorNumber` and no `CreateSupplierUseCase` under `packages/purchasing/src/application/`. Phase 2 bootstrap ports upsert one supplier by `PHASE2_SUPPLIER_VENDOR_NUMBER` via `insert` in `run-phase2-bootstrap.ts` (API seed wrapper).

## Sources

- [ADA-105](https://linear.app/adamhinckley/issue/ADA-105/phase-2-implementation-spec-stock-ledger-and-manual-order-to-cash) (issue body, retrieved 2026-08-24)
- [ADA-115](https://linear.app/adamhinckley/issue/ADA-115/phase-2-engine-surface-a-generator-can-call) (question text)
- Git: `HEAD` `6a372aa`, `origin/main` `e11b737`, remote `ahinckley2/ada-106` … `ada-112` branches
- Files cited above on `origin/main`
