import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { CustomerArLoadedData } from "../ar-projection.js";
import type { AgingBucket } from "../invoice.js";

export type OrgSummaryAggregates = {
  readonly totalOpenArCents: number;
  readonly pastDueCents: number;
  readonly unappliedCreditCents: number;
  readonly mtdWriteOffsCents: number;
  readonly aging: Readonly<Record<AgingBucket, number>>;
};

export interface IArOrgReadPort {
  loadAllCustomerData(
    organizationId: OrganizationId,
  ): Promise<ReadonlyMap<CustomerId, CustomerArLoadedData>>;
  loadOrgSummaryAggregates(
    organizationId: OrganizationId,
    asOf: Date,
  ): Promise<OrgSummaryAggregates>;
}
