import type { CustomerId } from "@dc-inventory/shared-kernel";
import type {
  CustomerBalancesListPage,
  CustomerBalancesListQuery,
  ICustomerBalancesListQuery,
} from "../domain/ports/customer-balances-list-query.js";
import type { IArOrgReadPort } from "../domain/ports/ar-org-read-port.js";
import type { ICustomerArProfileReadPort } from "../domain/ports/customer-ar-profile-read.js";
import type { IOpenOrderExposureReadPort } from "../domain/ports/open-order-exposure-read.js";
import { projectCustomerArBalance } from "../domain/ar-projection.js";
import {
  buildCustomerBalanceRow,
  listCustomerBalancesInMemory,
  shouldIncludeCustomerBalance,
} from "./ar-read-support.js";

export class InMemoryCustomerBalancesListQuery implements ICustomerBalancesListQuery {
  constructor(
    private readonly arOrgRead: IArOrgReadPort,
    private readonly customerProfiles: ICustomerArProfileReadPort,
    private readonly openOrderExposure: IOpenOrderExposureReadPort,
  ) {}

  async list(query: CustomerBalancesListQuery): Promise<CustomerBalancesListPage> {
    const [profiles, allCustomerData] = await Promise.all([
      this.customerProfiles.listAll(query.organizationId),
      this.arOrgRead.loadAllCustomerData(query.organizationId),
    ]);
    const rows = [];
    const agingByCustomerId = new Map<CustomerId, Readonly<Record<string, number>>>();

    for (const profile of profiles) {
      const loaded = allCustomerData.get(profile.customerId);
      if (loaded === undefined) {
        continue;
      }
      const projection = projectCustomerArBalance(profile.customerId, loaded, query.asOf);
      if (!shouldIncludeCustomerBalance(projection)) {
        continue;
      }
      const confirmedUnshippedCents = await this.openOrderExposure.getOpenOrderExposureCents(
        query.organizationId,
        profile.customerId,
      );
      rows.push(buildCustomerBalanceRow(profile, projection, confirmedUnshippedCents));
      agingByCustomerId.set(profile.customerId, projection.aging);
    }

    return listCustomerBalancesInMemory(rows, agingByCustomerId, query);
  }
}
