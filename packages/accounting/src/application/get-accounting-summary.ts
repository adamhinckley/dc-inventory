import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { computeMtdWriteOffsCents } from "../domain/ar-stats.js";
import {
  customerHasBalanceOrCredit,
  projectCustomerArBalance,
} from "../domain/ar-projection.js";
import type { IArCustomerReadPort } from "../domain/ports/ar-customer-read-port.js";
import type { ICustomerArProfileReadPort } from "../domain/ports/customer-ar-profile-read.js";
import type { IOpenOrderExposureReadPort } from "../domain/ports/open-order-exposure-read.js";
import type { AgingBucket } from "../domain/invoice.js";
import { AGING_BUCKETS, computeAvailableCreditCents, computeExposureCents } from "../domain/invoice.js";

export type GetAccountingSummaryRequest = {
  readonly organizationId: OrganizationId;
  readonly asOf: Date;
};

export type GetAccountingSummaryResult = {
  readonly asOf: Date;
  readonly totalOpenArCents: number;
  readonly pastDueCents: number;
  readonly pastDuePercent: number;
  readonly unappliedCreditCents: number;
  readonly mtdWriteOffsCents: number;
  readonly aging: Readonly<Record<AgingBucket, number>>;
};

export class GetAccountingSummaryUseCase {
  constructor(
    private readonly arCustomerRead: IArCustomerReadPort,
    private readonly customerProfiles: ICustomerArProfileReadPort,
    private readonly openOrderExposure: IOpenOrderExposureReadPort,
  ) {}

  async execute(input: GetAccountingSummaryRequest): Promise<GetAccountingSummaryResult> {
    const profiles = await this.customerProfiles.listAll(input.organizationId);
    const aging: Record<AgingBucket, number> = {
      current: 0,
      "1-15": 0,
      "16-30": 0,
      "31-45": 0,
      "46-60": 0,
      "61-90": 0,
      "90+": 0,
    };

    let totalOpenArCents = 0;
    let pastDueCents = 0;
    let unappliedCreditCents = 0;
    let mtdWriteOffsCents = 0;

    for (const profile of profiles) {
      const loaded = await this.arCustomerRead.loadCustomerData(
        input.organizationId,
        profile.customerId,
      );
      const balance = projectCustomerArBalance(profile.customerId, loaded, input.asOf);
      if (!customerHasBalanceOrCredit(balance)) {
        continue;
      }

      const confirmedUnshippedCents = await this.openOrderExposure.getOpenOrderExposureCents(
        input.organizationId,
        profile.customerId,
      );
      const exposureCents = computeExposureCents(
        balance.sumRemainingCents,
        confirmedUnshippedCents,
        balance.unappliedCreditCents,
      );
      void computeAvailableCreditCents(profile.creditLimitCents, exposureCents);

      totalOpenArCents += balance.sumRemainingCents;
      pastDueCents += balance.pastDueCents;
      unappliedCreditCents += balance.unappliedCreditCents;

      for (const bucket of AGING_BUCKETS) {
        aging[bucket] += balance.aging[bucket];
      }

      mtdWriteOffsCents += computeMtdWriteOffsCents(
        loaded.invoices,
        loaded.adjustmentsByInvoiceId,
        input.asOf,
      );
    }

    const pastDuePercent =
      totalOpenArCents > 0 ? Math.round((pastDueCents / totalOpenArCents) * 100) : 0;

    return {
      asOf: input.asOf,
      totalOpenArCents,
      pastDueCents,
      pastDuePercent,
      unappliedCreditCents,
      mtdWriteOffsCents,
      aging,
    };
  }
}
