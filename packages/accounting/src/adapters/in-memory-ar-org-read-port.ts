import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { CustomerArLoadedData } from "../domain/ar-projection.js";
import {
  customerHasBalanceOrCredit,
  projectCustomerArBalance,
} from "../domain/ar-projection.js";
import { computeMtdWriteOffsCents } from "../domain/ar-stats.js";
import type { IArOrgReadPort, OrgSummaryAggregates } from "../domain/ports/ar-org-read-port.js";
import { AGING_BUCKETS, type AgingBucket } from "../domain/invoice.js";
import type { IAccountingRepository } from "../domain/ports/invoice-repository.js";
import type { ICustomerArProfileReadPort } from "../domain/ports/customer-ar-profile-read.js";
import { loadCustomerArData } from "./ar-read-support.js";

export class InMemoryArOrgReadPort implements IArOrgReadPort {
  constructor(
    private readonly repository: IAccountingRepository,
    private readonly customerProfiles: ICustomerArProfileReadPort,
  ) {}

  async loadAllCustomerData(
    organizationId: OrganizationId,
  ): Promise<ReadonlyMap<CustomerId, CustomerArLoadedData>> {
    const profiles = await this.customerProfiles.listAll(organizationId);
    const customerData = new Map<CustomerId, CustomerArLoadedData>();
    for (const profile of profiles) {
      customerData.set(
        profile.customerId,
        await loadCustomerArData(this.repository, organizationId, profile.customerId),
      );
    }
    return customerData;
  }

  async loadOrgSummaryAggregates(
    organizationId: OrganizationId,
    asOf: Date,
  ): Promise<OrgSummaryAggregates> {
    const allCustomerData = await this.loadAllCustomerData(organizationId);
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
        asOf,
      );

      const balance = projectCustomerArBalance(customerId, loaded, asOf);
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

    return {
      totalOpenArCents,
      pastDueCents,
      unappliedCreditCents,
      mtdWriteOffsCents,
      aging,
    };
  }
}
