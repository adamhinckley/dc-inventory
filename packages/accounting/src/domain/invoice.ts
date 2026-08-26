import type { Money } from "@dc-inventory/shared-kernel";
import type { PaymentApplicationId } from "./ids.js";

export const INVOICE_STATUSES = ["unposted", "posted"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type PaymentApplication = {
  readonly id: PaymentApplicationId;
  readonly paymentId: import("./ids.js").PaymentId;
  readonly invoiceId: import("@dc-inventory/shared-kernel").InvoiceId;
  readonly amount: Money;
  readonly createdAt: Date;
};

export type Invoice = {
  readonly id: import("@dc-inventory/shared-kernel").InvoiceId;
  readonly organizationId: import("@dc-inventory/shared-kernel").OrganizationId;
  readonly orderId: import("@dc-inventory/shared-kernel").OrderId;
  readonly customerId: import("@dc-inventory/shared-kernel").CustomerId;
  readonly documentNumber: string;
  readonly status: InvoiceStatus;
  readonly postedAt: Date | null;
  readonly subtotal: Money;
  readonly taxTotal: Money;
  readonly total: Money;
};

export type Payment = {
  readonly id: import("./ids.js").PaymentId;
  readonly organizationId: import("@dc-inventory/shared-kernel").OrganizationId;
  readonly customerId: import("@dc-inventory/shared-kernel").CustomerId;
  readonly amount: Money;
  readonly idempotencyKey: string;
  readonly createdAt: Date;
};

export function computeRemainingCents(
  invoice: Invoice,
  applications: readonly PaymentApplication[],
): number {
  const applied = applications.reduce((sum, row) => sum + row.amount.amountMinor, 0);
  return invoice.total.amountMinor - applied;
}
