import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { CustomerArStats } from "../domain/ar-stats.js";
import { computeCustomerArStats } from "../domain/ar-stats.js";
import {
  buildArAsOfContext,
  collectVoidedPaymentIds,
  deriveCustomerPaymentRows,
  deriveOpenInvoiceRows,
  filterCustomerArDataForAsOf,
  projectCustomerArBalance,
  type CustomerArLoadedData,
  type CustomerInvoiceProjectionRow,
  type CustomerPaymentProjectionRow,
} from "../domain/ar-projection.js";
import type { IArCustomerReadPort } from "../domain/ports/ar-customer-read-port.js";
import type { ICustomerArProfileReadPort } from "../domain/ports/customer-ar-profile-read.js";
import type { ILastOrderDateReadPort } from "../domain/ports/last-order-date-read.js";
import type { IOpenOrderExposureReadPort } from "../domain/ports/open-order-exposure-read.js";
import type {
  AgingBucket,
  PaymentPlan,
  PaymentPlanExpectations,
} from "../domain/invoice.js";
import {
  computeAvailableCreditCents,
  computeExposureCents,
  computePlanExpectations,
} from "../domain/invoice.js";
import type { CustomerArProfile } from "../domain/ports/customer-ar-profile-read.js";

export type CustomerOpenInvoiceRow = CustomerInvoiceProjectionRow;

export type CustomerPaymentSummaryRow = CustomerPaymentProjectionRow;

export type GetCustomerAccountingSummaryRequest = {
  readonly organizationId: OrganizationId;
  readonly customerId: CustomerId;
  readonly asOf: Date;
};

export type GetCustomerAccountingSummaryResult = {
  readonly asOf: Date;
  readonly openInvoices: readonly CustomerOpenInvoiceRow[];
  readonly aging: Readonly<Record<AgingBucket, number>>;
  readonly unappliedCreditCents: number;
  readonly openBalanceCents: number;
  readonly openBalanceOwedCents: number;
  readonly exposureCents: number;
  readonly availableCreditCents: number;
  readonly stats: CustomerArStats;
  readonly plan: PaymentPlan | null;
  readonly planExpectations: PaymentPlanExpectations | null;
  readonly recentPayments: readonly CustomerPaymentSummaryRow[];
};

export type BuildCustomerAccountingSummaryInput = {
  readonly loaded: CustomerArLoadedData;
  readonly profile: CustomerArProfile | null;
  readonly confirmedUnshippedCents: number;
  readonly lastOrderDate: Date | null;
  readonly customerId: CustomerId;
  readonly asOf: Date;
};

export function buildCustomerAccountingSummaryResult(
  input: BuildCustomerAccountingSummaryInput,
): GetCustomerAccountingSummaryResult {
  const filtered = filterCustomerArDataForAsOf(input.loaded, input.asOf);
  const balance = projectCustomerArBalance(input.customerId, input.loaded, input.asOf);
  const voidedPaymentIds = collectVoidedPaymentIds(filtered.payments);
  const asOfContext = buildArAsOfContext(filtered.payments, input.asOf);
  const creditLimitCents = input.profile?.creditLimitCents ?? 0;
  const exposureCents = computeExposureCents(
    balance.sumRemainingCents,
    input.confirmedUnshippedCents,
    balance.unappliedCreditCents,
  );
  const availableCreditCents = computeAvailableCreditCents(creditLimitCents, exposureCents);

  const stats = computeCustomerArStats({
    invoices: filtered.invoices,
    applicationsByInvoiceId: filtered.applicationsByInvoiceId,
    adjustmentsByInvoiceId: filtered.adjustmentsByInvoiceId,
    payments: filtered.payments,
    applicationsByPaymentId: filtered.applicationsByPaymentId,
    asOf: input.asOf,
    asOfContext,
    voidedPaymentIds,
    openBalanceCents: balance.openBalanceCents,
    unappliedCreditCents: balance.unappliedCreditCents,
    availableCreditCents,
    creditLimitCents,
    lastOrderDate: input.lastOrderDate,
  });

  const planExpectations =
    filtered.activePlan === null
      ? null
      : computePlanExpectations(
          filtered.activePlan,
          balance.openBalanceCents,
          input.asOf,
          filtered.payments,
        );

  return {
    asOf: input.asOf,
    openInvoices: deriveOpenInvoiceRows(input.loaded, input.asOf),
    aging: balance.aging,
    unappliedCreditCents: balance.unappliedCreditCents,
    openBalanceCents: balance.openBalanceCents,
    openBalanceOwedCents: balance.sumRemainingCents,
    exposureCents,
    availableCreditCents,
    stats,
    plan: filtered.activePlan,
    planExpectations,
    recentPayments: deriveCustomerPaymentRows(input.loaded, input.asOf),
  };
}

export class GetCustomerAccountingSummaryUseCase {
  constructor(
    private readonly arCustomerRead: IArCustomerReadPort,
    private readonly customerProfiles: ICustomerArProfileReadPort,
    private readonly openOrderExposure: IOpenOrderExposureReadPort,
    private readonly lastOrderDate: ILastOrderDateReadPort,
  ) {}

  async execute(
    input: GetCustomerAccountingSummaryRequest,
  ): Promise<GetCustomerAccountingSummaryResult> {
    const [loaded, profile, confirmedUnshippedCents, lastOrderDate] = await Promise.all([
      this.arCustomerRead.loadCustomerData(input.organizationId, input.customerId),
      this.customerProfiles.findById(input.organizationId, input.customerId),
      this.openOrderExposure.getOpenOrderExposureCents(
        input.organizationId,
        input.customerId,
      ),
      this.lastOrderDate.getLastOrderDate(input.organizationId, input.customerId),
    ]);

    return buildCustomerAccountingSummaryResult({
      loaded,
      profile,
      confirmedUnshippedCents,
      lastOrderDate,
      customerId: input.customerId,
      asOf: input.asOf,
    });
  }
}

// Re-export projection row types for workspace use case consumers.
export type {
  CustomerInvoiceProjectionRow,
  CustomerPaymentProjectionRow,
} from "../domain/ar-projection.js";
