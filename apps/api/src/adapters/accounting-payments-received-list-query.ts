import {
  PaymentId,
  type IPaymentsReceivedListQuery,
  type PaymentReceivedRow,
  type PaymentsReceivedListPage,
  type PaymentsReceivedListQuery,
} from "@dc-inventory/accounting";
import { paymentApplications, payments } from "@dc-inventory/accounting/schema";
import { CustomerId } from "@dc-inventory/shared-kernel";
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { customers } from "@dc-inventory/customers/schema";
import type { AppDrizzle } from "../infrastructure/db.js";

function paymentListWhere(query: PaymentsReceivedListQuery) {
  return and(
    eq(payments.organizationId, query.organizationId),
    gte(payments.receivedAt, query.from),
    lte(payments.receivedAt, query.to),
  );
}

function paymentListOrderBy(query: PaymentsReceivedListQuery) {
  const direction = query.sortOrder === "asc" ? asc : desc;
  const tieBreak = desc(payments.id);
  switch (query.sortBy) {
    case "amount":
      return [direction(payments.amountCents), tieBreak];
    case "customerName":
      return [direction(customers.name), tieBreak];
    case "receivedAt":
    default:
      return [direction(payments.receivedAt), tieBreak];
  }
}

function customerJoin() {
  return and(
    eq(payments.organizationId, customers.organizationId),
    eq(payments.customerId, customers.id),
  );
}

export class DrizzlePaymentsReceivedListQuery implements IPaymentsReceivedListQuery {
  constructor(private readonly db: AppDrizzle) {}

  async list(query: PaymentsReceivedListQuery): Promise<PaymentsReceivedListPage> {
    const where = paymentListWhere(query);

    const countRows = await this.db
      .select({ total: count() })
      .from(payments)
      .innerJoin(customers, customerJoin())
      .where(where);
    const total = Number(countRows[0]?.total ?? 0);

    const offset = (query.page - 1) * query.pageSize;
    const pageRows = await this.db
      .select({
        id: payments.id,
        receivedAt: payments.receivedAt,
        customerId: payments.customerId,
        customerNumber: customers.customerNumber,
        customerName: customers.name,
        amountCents: payments.amountCents,
        currency: payments.currency,
        method: payments.method,
        reference: payments.reference,
        note: payments.note,
        voidReason: payments.voidReason,
        voidedAt: payments.voidedAt,
      })
      .from(payments)
      .innerJoin(customers, customerJoin())
      .where(where)
      .orderBy(...paymentListOrderBy(query))
      .limit(query.pageSize)
      .offset(offset);

    const appliedByPaymentId = new Map<string, number>();
    const paymentIds = pageRows.map((row) => row.id);
    if (paymentIds.length > 0) {
      const appliedRows = await this.db
        .select({
          paymentId: paymentApplications.paymentId,
          appliedCents: sql<number>`coalesce(sum(${paymentApplications.amountCents}), 0)`.as(
            "applied_cents",
          ),
        })
        .from(paymentApplications)
        .where(inArray(paymentApplications.paymentId, paymentIds))
        .groupBy(paymentApplications.paymentId);
      for (const row of appliedRows) {
        appliedByPaymentId.set(row.paymentId, Number(row.appliedCents));
      }
    }

    const items: PaymentReceivedRow[] = pageRows.map((row) => {
      const appliedCents = appliedByPaymentId.get(row.id) ?? 0;
      const voided = row.voidedAt != null;
      return {
        paymentId: PaymentId.parse(row.id),
        receivedAt: row.receivedAt,
        customerId: CustomerId.parse(row.customerId),
        customerNumber: row.customerNumber,
        customerName: row.customerName,
        amountCents: row.amountCents,
        currency: row.currency,
        method: row.method ?? "other",
        reference: row.reference ?? null,
        note: row.note ?? null,
        voidReason: row.voidReason ?? null,
        appliedCents,
        unappliedCents: voided ? 0 : row.amountCents - appliedCents,
        voided,
      };
    });

    return { items, total };
  }
}
