import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IArOrgReadPort } from "../domain/ports/ar-org-read-port.js";
import type { AgingBucket } from "../domain/invoice.js";

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
    const aggregates = await this.arOrgRead.loadOrgSummaryAggregates(
      input.organizationId,
      input.asOf,
    );
    const pastDuePercent =
      aggregates.totalOpenArCents > 0
        ? Math.round((aggregates.pastDueCents / aggregates.totalOpenArCents) * 100)
        : 0;

    return {
      asOf: input.asOf,
      ...aggregates,
      pastDuePercent,
    };
  }
}
