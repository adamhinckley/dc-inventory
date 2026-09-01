import type { Money } from "@dc-inventory/shared-kernel";
import type { SalesOrderLineId } from "./ids.js";

export const SALES_ORDER_STATUSES = [
  "draft",
  "confirmed",
  "shipped",
  "cancelled",
] as const;

export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export type SalesOrderLine = {
  readonly id: SalesOrderLineId;
  readonly sku: import("@dc-inventory/shared-kernel").Sku;
  readonly name: string;
  readonly qty: number;
  readonly unitPrice: Money;
  readonly taxCategoryCode?: string;
  /** Set when staff pull demand off this line (manufacturer miss / code red). */
  readonly decommitted?: boolean;
};

export type SalesOrderShipSnapshot = {
  readonly shipLine1?: string;
  readonly shipLine2?: string | null;
  readonly shipCity?: string;
  readonly shipRegion?: string;
  readonly shipPostal?: string;
  readonly shipCountry?: string;
};

export type SalesOrder = {
  readonly id: import("@dc-inventory/shared-kernel").OrderId;
  readonly organizationId: import("@dc-inventory/shared-kernel").OrganizationId;
  readonly customerId: import("@dc-inventory/shared-kernel").CustomerId;
  readonly documentNumber: string;
  readonly status: SalesOrderStatus;
  readonly createdAt: Date;
  readonly lines: readonly SalesOrderLine[];
} & SalesOrderShipSnapshot;

/** Confirmed lines that still have live demand (not pulled via line-level decommit). */
export function liveSalesOrderLines(
  lines: readonly SalesOrderLine[],
): readonly SalesOrderLine[] {
  return lines.filter((line) => !line.decommitted);
}
