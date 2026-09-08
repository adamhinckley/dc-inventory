import type { OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";

export const PO_PREFIX_PATTERN = /^[A-Z0-9]{2,4}$/;

export type Supplier = {
  readonly id: SupplierId;
  readonly organizationId: OrganizationId;
  readonly vendorNumber: string;
  readonly name: string;
  readonly poPrefix: string | null;
};

export function parsePoPrefix(value: string | null | undefined): string | null | "invalid" {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!PO_PREFIX_PATTERN.test(trimmed)) {
    return "invalid";
  }
  return trimmed;
}
