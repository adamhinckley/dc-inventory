import { InvalidIdError } from "./errors.js";

declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid<B extends string>(label: B, value: string): Brand<string, B> {
  if (!UUID_PATTERN.test(value)) {
    throw new InvalidIdError(`${label} must be a UUID, got ${JSON.stringify(value)}`);
  }
  return value as Brand<string, B>;
}

function defineId<B extends string>(label: B) {
  return {
    parse(value: string): Brand<string, B> {
      return parseUuid(label, value);
    },
  };
}

export type ProductId = Brand<string, "ProductId">;
export const ProductId = defineId("ProductId");

export type CustomerId = Brand<string, "CustomerId">;
export const CustomerId = defineId("CustomerId");

export type OrderId = Brand<string, "OrderId">;
export const OrderId = defineId("OrderId");

export type PurchaseOrderId = Brand<string, "PurchaseOrderId">;
export const PurchaseOrderId = defineId("PurchaseOrderId");

export type TenantId = Brand<string, "TenantId">;
export const TenantId = defineId("TenantId");

export type AddOnId = Brand<string, "AddOnId">;
export const AddOnId = defineId("AddOnId");

export type InstallationId = Brand<string, "InstallationId">;
export const InstallationId = defineId("InstallationId");

export type InvoiceId = Brand<string, "InvoiceId">;
export const InvoiceId = defineId("InvoiceId");

export type SupplierId = Brand<string, "SupplierId">;
export const SupplierId = defineId("SupplierId");

export type StaffUserId = Brand<string, "StaffUserId">;
export const StaffUserId = defineId("StaffUserId");

export type WholesaleUserId = Brand<string, "WholesaleUserId">;
export const WholesaleUserId = defineId("WholesaleUserId");

export type SessionId = Brand<string, "SessionId">;
export const SessionId = defineId("SessionId");

export type LocationId = Brand<string, "LocationId">;

export const LocationId = {
  DEFAULT: "DEFAULT" as LocationId,
  parse(value: string): LocationId {
    if (value === "DEFAULT") {
      return LocationId.DEFAULT;
    }
    return parseUuid("LocationId", value);
  },
};
