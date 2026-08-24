import type { SupplierId } from "@dc-inventory/shared-kernel";

export type Supplier = {
  readonly id: SupplierId;
  readonly vendorNumber: string;
  readonly name: string;
};
