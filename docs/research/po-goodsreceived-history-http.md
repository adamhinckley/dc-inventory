# Staff HTTP for PO `GoodsReceived` history

Ticket: [ADA-224](https://linear.app/adamhinckley/issue/ADA-224/staff-http-for-po-goodsreceived-history). Primary sources: `apps/api` OpenAPI/routes, `packages/inventory` read model, committed Orval clients. No product code in this note.

## Answer

There is **no** staff HTTP that lists `GoodsReceived` movements for one purchase order (no `refType`/`refId` query, no movement collection in OpenAPI, no Orval list hook).

A later packet would wrap **`IInventoryReadModel.listMovements`**. That port does **not** filter by `refType` or `refId`; callers get movements for an organization (optionally SKU and location) and must match `movementType === "GoodsReceived"`, `refType === "purchase_order"`, and `refId === purchaseOrderId` in application code. There is no `ListMovements` use case yet.

## Staff HTTP that exists (related, not history)

Staff inventory HTTP is a single snapshot read:

- Route: `GET /inventory/stock/:sku` on the `/internal` mount (`apps/api/src/adapters/http/internal-inventory.ts`).
- OpenAPI: `GET /internal/inventory/stock/{sku}`, operationId `getInternalInventoryStock` (`openapi/internal.yaml`).
- Response: `sku`, `onHand`, `onOrder`, `allocated`, `available` — no movements.
- Orval: `useGetInternalInventoryStock` (`packages/api-client-internal/src/generated/api.ts`).

Purchase-order staff HTTP (`apps/api/src/adapters/http/internal-purchase-orders.ts`, `openapi/internal.yaml`):

| Method | Path | operationId |
| --- | --- | --- |
| GET | `/internal/purchase-orders` | `listInternalPurchaseOrders` |
| POST | `/internal/purchase-orders` | `createInternalPurchaseOrder` |
| GET | `/internal/purchase-orders/{id}` | `getInternalPurchaseOrder` |
| PUT | `/internal/purchase-orders/{id}` | `replaceInternalPurchaseOrderLines` |
| GET | `/internal/purchase-orders/{id}/export` | `exportInternalPurchaseOrder` |
| GET | `/internal/purchase-orders/{id}/factory-send` | `getInternalPurchaseOrderFactorySend` |
| POST | `/internal/purchase-orders/{id}/confirm` | `confirmInternalPurchaseOrder` |
| POST | `/internal/purchase-orders/{id}/receive` | `receiveInternalPurchaseOrder` |
| POST | `/internal/purchase-orders/{id}/cancel` | `cancelInternalPurchaseOrder` |

None of these list ledger movements. `GET`/`POST …/receive` return the PO document (`purchaseOrderItemSchema` in `apps/api/src/schemas.ts`): identity, status, dates, and lines with **cumulative** `receivedQty`. That is not a receive-event list.

`POST /internal/purchase-orders/{id}/receive` **writes** `GoodsReceived` via purchasing (`packages/purchasing/src/application/receive-purchase-order.ts` → `scope.inventory.recordGoodsReceived` with `purchaseOrderId`). The inventory adapter sets `refType: "purchase_order"` and `refId: command.purchaseOrderId` (`apps/api/src/adapters/inventory-command-port.ts`). The HTTP 200 is still the updated PO, not the movement rows.

`openapi/internal.yaml`, `openapi/wholesale.yaml`, and `openapi/ops.yaml` have no `GoodsReceived`, `listMovements`, `movementType`, or `/movements` paths.

## Orval (committed internal client)

`packages/api-client-internal` has no generated type or hook named for movements. Closest hooks:

- `useGetInternalInventoryStock` — snapshot only (`getInternalInventoryStock200.ts`).
- `useGetInternalPurchaseOrder` — PO + line `receivedQty` (`getInternalPurchaseOrder200.ts`).
- `useReceiveInternalPurchaseOrder` — mutation; 200 is the same PO shape.

## Inventory read port to wrap

`IInventoryReadModel` (`packages/inventory/src/domain/ports/stock-ledger.ts`):

```ts
export type MovementListFilter = {
  organizationId: OrganizationId;
  sku?: Sku;
  locationId?: LocationId;
};

export interface IInventoryReadModel {
  getSnapshot(...): Promise<DemandStockFigures>;
  listMovements(filter: MovementListFilter): Promise<readonly Movement[]>;
}
```

`Movement` (`packages/inventory/src/domain/movement.ts`) already carries `movementType`, `refType`, `refId`, `quantity`, `sku`, `createdAt`, `idempotencyKey`. `MOVEMENT_TYPES` includes `"GoodsReceived"`. `MOVEMENT_REF_TYPES` includes `"purchase_order"`. `GoodsReceived` is **not** in `ONCE_ONLY_PROVENANCE_TYPES`, so multiple receive rows per PO+SKU are allowed.

Adapters honor only the filter fields above (in-memory scan / drizzle org-wide select then SKU/location in process):

- `packages/inventory/src/adapters/in-memory-inventory-read-model.ts` (`listMovements`)
- `packages/inventory/src/adapters/drizzle-inventory-read-model.ts` (`listMovements`)

`hasProvenance(organizationId, refType, refId, sku, movementType)` exists on those adapters for ledger writes; it is **not** on `IInventoryReadModel` and returns a boolean, not a list.

Application inventory reads today: `GetStockSnapshotUseCase` and `ListUncoveredSkusUseCase` only (`packages/inventory/src/application/`). No list-movements use case.

Existing in-process pattern: list by org/SKU/location, then match `refType`/`refId` in memory (`apps/api/src/adapters/sales-inventory-command-port.ts`). Seed replay filters `GoodsReceived` the same way after `listMovements({ organizationId })` (`apps/api/src/seed/replay-purchase-orders.test.ts`).

## Implication for a later HTTP packet

Wrap `listMovements` (new use case + staff route + OpenAPI + Orval). Do not assume the port already accepts `refType`/`refId`/`movementType`; extend the filter or filter after list. Do not treat `receivedQty` on `getInternalPurchaseOrder` as v1 receive history.
