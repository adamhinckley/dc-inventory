import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { computeMtdWriteOffsCents } from "../domain/ar-stats.js";
import {
  customerHasBalanceOrCredit,
  projectCustomerArBalance,
} from "../domain/ar-projection.js";
import type { IArOrgReadPort } from "../domain/ports/ar-org-read-port.js";
import type { AgingBucket } from "../domain/invoice.js";
import { AGING_BUCKETS } from "../domain/invoice.js";

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
  constructor(private readonly arOrgRead: IArOrgReadPort) {}

  async execute(input: GetAccountingSummaryRequest): Promise<GetAccountingSummaryResult> {
    const allCustomerData = await this.arOrgRead.loadAllCustomerData(input.organizationId);
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

    for (const [customerId, loaded] of allCustomerData) {
      mtdWriteOffsCents += computeMtdWriteOffsCents(
        loaded.invoices,
        loaded.adjustmentsByInvoiceId,
        input.asOf,
      );

      const balance = projectCustomerArBalance(customerId, loaded, input.asOf);
      if (!customerHasBalanceOrCredit(balance)) {
        continue;
      }

      totalOpenArCents += balance.sumRemainingCents;
      pastDueCents += balance.pastDueCents;
      unappliedCreditCents += balance.unappliedCreditCents;

      for (const bucket of AGING_BUCKETS) {
        aging[bucket] += balance.aging[bucket];
      }
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
