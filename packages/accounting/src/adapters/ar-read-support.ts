import type { CustomerId, InvoiceId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IAccountingRepository } from "../domain/ports/invoice-repository.js";
import type { CustomerArLoadedData } from "../domain/ar-projection.js";
import {
  customerHasBalanceOrCredit,
  projectCustomerArBalance,
} from "../domain/ar-projection.js";
import type { CustomerArProfile } from "../domain/ports/customer-ar-profile-read.js";
import type {
  CustomerBalanceRow,
  CustomerBalancesListQuery,
  CustomerBalancesSortBy,
  SortOrder,
} from "../domain/ports/customer-balances-list-query.js";
import type {
  PaymentReceivedRow,
  PaymentsReceivedListQuery,
  PaymentsReceivedSortBy,
} from "../domain/ports/payments-received-list-query.js";
import type { PaymentId } from "../domain/ids.js";
import type { InvoiceAdjustment, Payment, PaymentApplication } from "../domain/invoice.js";
import {
  computeAvailableCreditCents,
  computeExposureCents,
  computeUnappliedCents,
} from "../domain/invoice.js";

export async function loadCustomerArData(
  repository: IAccountingRepository,
  organizationId: OrganizationId,
  customerId: CustomerId,
): Promise<CustomerArLoadedData> {
  const invoices = (await repository.list(organizationId)).filter(
    (invoice) => invoice.customerId === customerId,
  );
  const applicationsByInvoiceId = new Map<InvoiceId, readonly PaymentApplication[]>(
    await Promise.all(
      invoices.map(async (invoice) => {
        const applications = await repository.listApplications(invoice.id);
        return [invoice.id, applications] as const;
      }),
    ),
  );
  const adjustmentsByInvoiceId = new Map<InvoiceId, readonly InvoiceAdjustment[]>(
    await Promise.all(
      invoices.map(async (invoice) => {
        const adjustments = await repository.listAdjustments(invoice.id);
        return [invoice.id, adjustments] as const;
      }),
    ),
  );
  const payments = await repository.listPaymentsByCustomer(organizationId, customerId);
  const applicationsByPaymentId = new Map<PaymentId, readonly PaymentApplication[]>(
    await Promise.all(
      payments.map(async (payment) => {
        const applications = await repository.listApplicationsByPayment(
          organizationId,
          payment.id,
        );
        return [payment.id, applications] as const;
      }),
    ),
  );
  const activePlan = await repository.findActivePaymentPlan(organizationId, customerId);

  return {
    invoices,
    applicationsByInvoiceId,
    adjustmentsByInvoiceId,
    payments,
    applicationsByPaymentId,
    activePlan,
  };
}

function compareValues(
  left: string | number | Date | null,
  right: string | number | Date | null,
  sortOrder: SortOrder,
): number {
  const direction = sortOrder === "asc" ? 1 : -1;
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  if (left instanceof Date && right instanceof Date) {
    return (left.getTime() - right.getTime()) * direction;
  }
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right) * direction;
  }
  return ((left as number) - (right as number)) * direction;
}

function sortCustomerBalances(
  rows: CustomerBalanceRow[],
  sortBy: CustomerBalancesSortBy,
  sortOrder: SortOrder,
): CustomerBalanceRow[] {
  return [...rows].sort((left, right) => {
    switch (sortBy) {
      case "pastDue":
        return compareValues(left.pastDueCents, right.pastDueCents, sortOrder);
      case "openBalance":
        return compareValues(left.openBalanceCents, right.openBalanceCents, sortOrder);
      case "name":
        return compareValues(left.name, right.name, sortOrder);
      case "customerNumber":
        return compareValues(left.customerNumber, right.customerNumber, sortOrder);
      case "oldestDue":
        return compareValues(left.oldestDueDate, right.oldestDueDate, sortOrder);
      case "daysPastDue":
        return compareValues(left.daysPastDue, right.daysPastDue, sortOrder);
      case "creditLimit":
        return compareValues(left.creditLimitCents, right.creditLimitCents, sortOrder);
      case "availableCredit":
        return compareValues(left.availableCreditCents, right.availableCreditCents, sortOrder);
      default:
        return 0;
    }
  });
}

export function buildCustomerBalanceRow(
  profile: CustomerArProfile,
  projection: ReturnType<typeof projectCustomerArBalance>,
  confirmedUnshippedCents: number,
): CustomerBalanceRow {
  const exposureCents = computeExposureCents(
    projection.sumRemainingCents,
    confirmedUnshippedCents,
    projection.unappliedCreditCents,
  );
  return {
    customerId: profile.customerId,
    customerNumber: profile.customerNumber,
    name: profile.name,
    openBalanceCents: projection.openBalanceCents,
    pastDueCents: projection.pastDueCents,
    oldestDueDate: projection.oldestDueDate,
    daysPastDue: projection.daysPastDue,
    creditLimitCents: profile.creditLimitCents,
    availableCreditCents: computeAvailableCreditCents(
      profile.creditLimitCents,
      exposureCents,
    ),
    hasActivePlan: projection.hasActivePlan,
  };
}

export function filterCustomerBalances(
  rows: readonly CustomerBalanceRow[],
  query: CustomerBalancesListQuery,
  agingByCustomerId: ReadonlyMap<CustomerId, Readonly<Record<string, number>>>,
): CustomerBalanceRow[] {
  const needle = query.q?.trim().toLowerCase() ?? "";
  return rows.filter((row) => {
    if (query.bucket !== undefined) {
      const aging = agingByCustomerId.get(row.customerId);
      if ((aging?.[query.bucket] ?? 0) <= 0) {
        return false;
      }
    }
    if (needle.length === 0) {
      return true;
    }
    return (
      row.name.toLowerCase().includes(needle) ||
      row.customerNumber.toLowerCase().includes(needle)
    );
  });
}

export function pageRows<T>(rows: readonly T[], page: number, pageSize: number): {
  items: T[];
  total: number;
} {
  const total = rows.length;
  const offset = (page - 1) * pageSize;
  return {
    items: rows.slice(offset, offset + pageSize),
    total,
  };
}

export function listCustomerBalancesInMemory(
  rows: readonly CustomerBalanceRow[],
  agingByCustomerId: ReadonlyMap<CustomerId, Readonly<Record<string, number>>>,
  query: CustomerBalancesListQuery,
): { items: CustomerBalanceRow[]; total: number } {
  const filtered = filterCustomerBalances(rows, query, agingByCustomerId);
  const sorted = sortCustomerBalances(filtered, query.sortBy, query.sortOrder);
  return pageRows(sorted, query.page, query.pageSize);
}

function sortPaymentsReceived(
  rows: PaymentReceivedRow[],
  sortBy: PaymentsReceivedSortBy,
  sortOrder: SortOrder,
): PaymentReceivedRow[] {
  return [...rows].sort((left, right) => {
    switch (sortBy) {
      case "receivedAt":
        return compareValues(left.receivedAt, right.receivedAt, sortOrder);
      case "amount":
        return compareValues(left.amountCents, right.amountCents, sortOrder);
      case "customerName":
        return compareValues(left.customerName, right.customerName, sortOrder);
      default:
        return 0;
    }
  });
}

export function buildPaymentReceivedRow(
  payment: Payment,
  applications: readonly PaymentApplication[],
  profile: CustomerArProfile,
  asOf?: Date,
): PaymentReceivedRow {
  const appliedCents = applications.reduce(
    (sum, application) => sum + application.amount.amountMinor,
    0,
  );
  return {
    paymentId: payment.id,
    receivedAt: payment.receivedAt ?? payment.createdAt,
    customerId: payment.customerId,
    customerNumber: profile.customerNumber,
    customerName: profile.name,
    amountCents: payment.amount.amountMinor,
    currency: payment.amount.currency,
    method: payment.method ?? "other",
    reference: payment.reference ?? null,
    note: payment.note ?? null,
    voidReason: payment.voidReason ?? null,
    appliedCents,
    unappliedCents: computeUnappliedCents(payment, applications, asOf),
    voided: payment.voidedAt != null,
    applications: applications.map((application) => ({
      id: application.id,
      invoiceId: application.invoiceId,
      amountCents: application.amount.amountMinor,
      currency: application.amount.currency,
      createdAt: application.createdAt,
    })),
  };
}

export function listPaymentsReceivedInMemory(
  rows: readonly PaymentReceivedRow[],
  query: PaymentsReceivedListQuery,
): { items: PaymentReceivedRow[]; total: number } {
  const filtered = rows.filter(
    (row) => row.receivedAt >= query.from && row.receivedAt <= query.to,
  );
  const sorted = sortPaymentsReceived(filtered, query.sortBy, query.sortOrder);
  return pageRows(sorted, query.page, query.pageSize);
}

export function shouldIncludeCustomerBalance(
  projection: ReturnType<typeof projectCustomerArBalance>,
): boolean {
  return customerHasBalanceOrCredit(projection);
}
