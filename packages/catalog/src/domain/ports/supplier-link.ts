import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";

export type SupplierLinkRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  vendorNumber: string;
  vendorName: string;
  sku: string;
  supplierSku: string | null;
  minOrderQty: number | null;
  minOrderAmountCents: number | null;
  lastPoCostCents: number | null;
};

export type SupplierLinkResult = { ok: true } | { ok: false; message: string };

export interface ISupplierLinkPort {
  linkSku(input: SupplierLinkRequest): Promise<SupplierLinkResult>;
}
