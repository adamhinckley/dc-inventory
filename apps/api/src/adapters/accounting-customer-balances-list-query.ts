import {
  buildCustomerBalanceRow,
  listCustomerBalancesInMemory,
  projectCustomerArBalance,
  shouldIncludeCustomerBalance,
  type CustomerBalancesListPage,
  type CustomerBalancesListQuery,
  type ICustomerBalancesListQuery,
} from "@dc-inventory/accounting";
import type { CustomerId } from "@dc-inventory/shared-kernel";
import {
  DrizzleOpenOrderExposureReadAdapter,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import type { AppDrizzle } from "../infrastructure/db.js";
import { DrizzleCustomerArProfileReadPort } from "./accounting-customer-ar-profile-read.js";
import { createArOrgReadPort } from "./accounting-ar-org-read.js";

export class DrizzleCustomerBalancesListQuery implements ICustomerBalancesListQuery {
  constructor(
    private readonly arOrgRead: ReturnType<typeof createArOrgReadPort>,
    private readonly customerProfiles: DrizzleCustomerArProfileReadPort,
    private readonly openOrderExposure: DrizzleOpenOrderExposureReadAdapter,
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

export function createCustomerBalancesListQuery(db: AppDrizzle): ICustomerBalancesListQuery {
  return new DrizzleCustomerBalancesListQuery(
    createArOrgReadPort(db),
    new DrizzleCustomerArProfileReadPort(db),
    new DrizzleOpenOrderExposureReadAdapter(db as unknown as SalesDrizzle),
  );
}
