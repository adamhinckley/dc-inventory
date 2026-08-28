import { InvalidIdError, type Brand } from "@dc-inventory/shared-kernel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid<B extends string>(label: B, value: string): Brand<string, B> {
  if (!UUID_PATTERN.test(value)) {
    throw new InvalidIdError(`${label} must be a UUID, got ${JSON.stringify(value)}`);
  }
  return value as Brand<string, B>;
}

export type PurchaseOrderLineId = Brand<string, "PurchaseOrderLineId">;
export const PurchaseOrderLineId = {
  parse(value: string): PurchaseOrderLineId {
    return parseUuid("PurchaseOrderLineId", value);
  },
};

export type SupplierProductId = Brand<string, "SupplierProductId">;
export const SupplierProductId = {
  parse(value: string): SupplierProductId {
    return parseUuid("SupplierProductId", value);
  },
};

export function newUuid(): string {
  return crypto.randomUUID();
}
