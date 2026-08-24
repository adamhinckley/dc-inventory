import type { LocationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { MovementId } from "./ids.js";

export const MOVEMENT_TYPES = [
  "InboundFromPo",
  "GoodsReceived",
  "InboundCancelled",
  "Allocated",
  "Deallocated",
  "Shipped",
  "AdjustmentIncrease",
  "AdjustmentDecrease",
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_REF_TYPES = [
  "purchase_order",
  "sales_order",
  "adjustment",
] as const;

export type MovementRefType = (typeof MOVEMENT_REF_TYPES)[number];

/** Movement types that enforce once-only provenance at (refType, refId, sku, movementType). */
export const ONCE_ONLY_PROVENANCE_TYPES = [
  "InboundFromPo",
  "InboundCancelled",
  "Allocated",
  "Deallocated",
  "Shipped",
] as const satisfies readonly MovementType[];

export type Movement = Readonly<{
  id: MovementId;
  sku: Sku;
  locationId: LocationId;
  movementType: MovementType;
  quantity: number;
  refType: MovementRefType;
  refId: string;
  idempotencyKey: string;
  createdAt: Date;
}>;

export type IdempotencyRecord = Readonly<{
  idempotencyKey: string;
  sku: Sku;
  payloadHash: string;
}>;
