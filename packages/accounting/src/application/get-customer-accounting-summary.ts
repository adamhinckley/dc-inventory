import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { CustomerArStats } from "../domain/ar-stats.js";
import { computeCustomerArStats } from "../domain/ar-stats.js";
import {
  buildArAsOfContext,
  collectVoidedPaymentIds,
  deriveOpenInvoiceRows,
  filterCustomerArDataForAsOf,
  projectCustomerArBalance,
} from "../domain/ar-projection.js";
import type { IArCustomerReadPort } from "../domain/ports/ar-customer-read-port.js";
import type { ICustomerArProfileReadPort } from "../domain/ports/customer-ar-profile-read.js";
import type { ILastOrderDateReadPort } from "../domain/ports/last-order-date-read.js";
import type { IOpenOrderExposureReadPort } from "../domain/ports/open-order-exposure-read.js";
import type {
  AgingBucket,
  ArInvoiceStatus,
  Invoice,
  Payment,
  PaymentApplication,
  PaymentPlan,
  PaymentPlanExpectations,
} from "../domain/invoice.js";
import {
  computeAvailableCreditCents,
  computeExposureCents,
  computePlanExpectations,
  computeUnappliedCents,
} from "../domain/invoice.js";

export type CustomerOpenInvoiceRow = {
  readonly invoice: Invoice;
  readonly remainingCents: number;
  readonly status: ArInvoiceStatus;
};

export type CustomerPaymentSummaryRow = {
  readonly payment: Payment;
  readonly appliedCents: number;
  readonly unappliedCents: number;
  readonly applications: readonly PaymentApplication[];
  readonly voided: boolean;
};

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

    const filtered = filterCustomerArDataForAsOf(loaded, input.asOf);
    const balance = projectCustomerArBalance(input.customerId, loaded, input.asOf);
    const voidedPaymentIds = collectVoidedPaymentIds(filtered.payments);
    const asOfContext = buildArAsOfContext(filtered.payments, input.asOf);
    const creditLimitCents = profile?.creditLimitCents ?? 0;
    const exposureCents = computeExposureCents(
      balance.sumRemainingCents,
      confirmedUnshippedCents,
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
      lastOrderDate,
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

    const recentPayments = [...filtered.payments]
      .sort((left, right) => {
        const leftReceived = left.receivedAt?.getTime() ?? 0;
        const rightReceived = right.receivedAt?.getTime() ?? 0;
        return rightReceived - leftReceived;
      })
      .map((payment) => {
        const applications = filtered.applicationsByPaymentId.get(payment.id) ?? [];
        const appliedCents = applications.reduce(
          (sum, application) => sum + application.amount.amountMinor,
          0,
        );
        return {
          payment,
          appliedCents,
          unappliedCents: computeUnappliedCents(payment, applications, input.asOf),
          applications,
          voided: payment.voidedAt != null,
        };
      });

    return {
      asOf: input.asOf,
      openInvoices: deriveOpenInvoiceRows(loaded, input.asOf),
      aging: balance.aging,
      unappliedCreditCents: balance.unappliedCreditCents,
      openBalanceCents: balance.openBalanceCents,
      openBalanceOwedCents: balance.sumRemainingCents,
      exposureCents,
      availableCreditCents,
      stats,
      plan: filtered.activePlan,
      planExpectations,
      recentPayments,
    };
  }
}
