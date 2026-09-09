import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IArCustomerReadPort } from "../domain/ports/ar-customer-read-port.js";
import type {
  CustomerBalancesListPage,
  CustomerBalancesListQuery,
  ICustomerBalancesListQuery,
} from "../domain/ports/customer-balances-list-query.js";
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
    private readonly arCustomerRead: IArCustomerReadPort,
    private readonly customerProfiles: ICustomerArProfileReadPort,
    private readonly openOrderExposure: IOpenOrderExposureReadPort,
  ) {}

  async list(query: CustomerBalancesListQuery): Promise<CustomerBalancesListPage> {
    const profiles = await this.customerProfiles.listAll(query.organizationId);
    const rows = [];
    const agingByCustomerId = new Map<CustomerId, Readonly<Record<string, number>>>();

    for (const profile of profiles) {
      const loaded = await this.arCustomerRead.loadCustomerData(
        query.organizationId,
        profile.customerId,
      );
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
