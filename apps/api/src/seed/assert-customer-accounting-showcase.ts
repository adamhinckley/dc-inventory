import {
  GetCustomerAccountingSummaryUseCase,
  type IArCustomerReadPort,
  type ICustomerArProfileReadPort,
  type ILastOrderDateReadPort,
} from "@dc-inventory/accounting";
import type { IOpenOrderExposureReadPort } from "@dc-inventory/sales";
import { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export type CustomerAccountingShowcaseAssertionResult =
  | { ok: true }
  | { ok: false; message: string };

export type AssertCustomerAccountingShowcasePorts = {
  arCustomerRead: IArCustomerReadPort;
  customerProfiles: ICustomerArProfileReadPort;
  openOrderExposure: IOpenOrderExposureReadPort;
  lastOrderDate: ILastOrderDateReadPort;
};

export type AssertCustomerAccountingShowcaseInput = {
  customerId: CustomerId;
  asOf: Date;
};

/**
 * Validate Idle Park's post-replay Accounting tab fixture. Runs after demo-book
 * reconciliation because showcase enrichment intentionally mutates AR state.
 */
export async function assertCustomerAccountingShowcase(
  ports: AssertCustomerAccountingShowcasePorts,
  input: AssertCustomerAccountingShowcaseInput,
): Promise<CustomerAccountingShowcaseAssertionResult> {
  const getCustomerSummary = new GetCustomerAccountingSummaryUseCase(
    ports.arCustomerRead,
    ports.customerProfiles,
    ports.openOrderExposure,
    ports.lastOrderDate,
  );

  const summary = await getCustomerSummary.execute({
    organizationId: OrganizationId.DEFAULT,
    customerId: input.customerId,
    asOf: input.asOf,
  });

  const statuses = new Set(summary.openInvoices.map((row) => row.status));
  if (!statuses.has("open") || !statuses.has("past_due")) {
    return {
      ok: false,
      message: "showcase customer is missing open or past-due invoices",
    };
  }

  if (
    !summary.openInvoices.some(
      (row) => row.remainingCents > 0 && row.remainingCents < row.invoice.total.amountMinor,
    )
  ) {
    return {
      ok: false,
      message: "showcase customer is missing a partially paid invoice",
    };
  }

  if (summary.unappliedCreditCents !== 75_000) {
    return {
      ok: false,
      message: `showcase unapplied credit is ${String(summary.unappliedCreditCents)}, expected 75000`,
    };
  }

  if (summary.plan === null) {
    return { ok: false, message: "showcase customer is missing a payment plan" };
  }

  if ((summary.planExpectations?.installmentsExpectedSoFar ?? 0) <= 0) {
    return {
      ok: false,
      message: "showcase payment plan has no installments expected so far",
    };
  }

  if (summary.stats.creditMemoCount !== 1) {
    return {
      ok: false,
      message: `showcase credit memo count is ${String(summary.stats.creditMemoCount)}, expected 1`,
    };
  }

  if (!summary.recentPayments.some((row) => row.voided)) {
    return { ok: false, message: "showcase customer is missing a voided payment" };
  }

  if (!summary.recentPayments.some((row) => row.unappliedCents > 0)) {
    return {
      ok: false,
      message: "showcase customer is missing unapplied payment credit",
    };
  }

  return { ok: true };
}
