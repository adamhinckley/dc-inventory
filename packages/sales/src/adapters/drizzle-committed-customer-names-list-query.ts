import { CustomerId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type {
  CommittedCustomerName,
  CommittedCustomerNamesQuery,
  ICommittedCustomerNamesListQuery,
} from "../domain/ports/committed-customer-names-list-query.js";
import { buildCommittedCustomerNamesQuery } from "../persistence/committed-customer-names-sql.js";
import type { SalesDrizzle } from "./drizzle-sales-orders.js";

export class DrizzleCommittedCustomerNamesListQuery implements ICommittedCustomerNamesListQuery {
  constructor(private readonly db: SalesDrizzle) {}

  async list(query: CommittedCustomerNamesQuery): Promise<readonly CommittedCustomerName[]> {
    const organizationId = requireOrganizationId(query.organizationId);
    if (query.skus.length === 0) {
      return [];
    }

    const rows = await buildCommittedCustomerNamesQuery(this.db, organizationId, query.skus);

    return rows.map(
      (row): CommittedCustomerName => ({
        customerId: CustomerId.parse(row.customerId),
        name: row.name,
      }),
    );
  }
}
