import type { ICustomerRepository } from "@dc-inventory/customers";
import { type CustomerId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type {
  CommittedCustomerName,
  CommittedCustomerNamesQuery,
  ICommittedCustomerNamesListQuery,
} from "../domain/ports/committed-customer-names-list-query.js";
import type { InMemorySalesOrderRepository } from "./in-memory-sales-order-repository.js";

export class InMemoryCommittedCustomerNamesListQuery implements ICommittedCustomerNamesListQuery {
  constructor(
    private readonly salesOrders: InMemorySalesOrderRepository,
    private readonly customers: ICustomerRepository,
  ) {}

  async list(query: CommittedCustomerNamesQuery): Promise<readonly CommittedCustomerName[]> {
    const organizationId = requireOrganizationId(query.organizationId);
    if (query.skus.length === 0) {
      return [];
    }

    const skuSet = new Set(query.skus.map((sku) => sku.value));
    const customerIds = new Set<CustomerId>();

    for (const { order } of this.salesOrders.snapshot().byId.values()) {
      if (order.organizationId !== organizationId) {
        continue;
      }
      if (order.status !== "confirmed") {
        continue;
      }
      const liveLines = order.lines.filter((line) => !line.decommitted);
      if (liveLines.some((line) => skuSet.has(line.sku.value))) {
        customerIds.add(order.customerId);
      }
    }

    const rows = await Promise.all(
      [...customerIds].map(async (customerId) => {
        const customer = await this.customers.findById(organizationId, customerId);
        if (customer === null) {
          return null;
        }
        return { customerId: customer.id, name: customer.name } as const;
      }),
    );

    return rows
      .filter((row): row is CommittedCustomerName => row !== null)
      .sort((a, b) => a.customerId.localeCompare(b.customerId));
  }
}
