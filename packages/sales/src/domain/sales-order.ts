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

export const SALES_ORDER_LABEL_MAX_LENGTH = 80;

/** Trim, drop blanks, cap length. `null` means "clear"; `undefined` means "not given". */
export function normalizeSalesOrderLabel(
  label: string | null | undefined,
): string | null | undefined {
  if (label === undefined) {
    return undefined;
  }
  if (label === null) {
    return null;
  }
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, SALES_ORDER_LABEL_MAX_LENGTH);
}

export type SalesOrder = {
  readonly id: import("@dc-inventory/shared-kernel").OrderId;
  readonly organizationId: import("@dc-inventory/shared-kernel").OrganizationId;
  readonly customerId: import("@dc-inventory/shared-kernel").CustomerId;
  readonly documentNumber: string;
  readonly status: SalesOrderStatus;
  readonly createdAt: Date;
  /** Set once on draft → confirmed. */
  readonly confirmedAt?: Date;
  /** Set once on confirmed → shipped. */
  readonly shippedAt?: Date;
  /** Set once on draft/confirmed → cancelled. */
  readonly cancelledAt?: Date;
  readonly lines: readonly SalesOrderLine[];
  /** Buyer-chosen cart name. A customer may hold many open drafts; this tells them apart. */
  readonly label?: string;
  /** Set when staff created the order while acting on the wholesale shop. */
  readonly placedByStaffUserId?: import("@dc-inventory/shared-kernel").StaffUserId;
  /** Set when staff confirmed despite insufficient available credit. */
  readonly creditLimitOverriddenByStaffUserId?: import("@dc-inventory/shared-kernel").StaffUserId;
} & SalesOrderShipSnapshot;

/** Confirmed lines that still have live demand (not pulled via line-level decommit). */
export function liveSalesOrderLines(
  lines: readonly SalesOrderLine[],
): readonly SalesOrderLine[] {
  return lines.filter((line) => !line.decommitted);
}
