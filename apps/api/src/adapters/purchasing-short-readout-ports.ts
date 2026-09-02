import type { ICustomerRepository } from "@dc-inventory/customers";
import type { IInventoryReadModel } from "@dc-inventory/inventory";
import type {
  ICommittedCustomerNamesPort,
  IInventoryUncoveredReadPort,
} from "@dc-inventory/purchasing";
import type { ISalesOrderRepository } from "@dc-inventory/sales";
import { LocationId, type CustomerId, type OrganizationId, type Sku } from "@dc-inventory/shared-kernel";

export function inventoryUncoveredReadPort(
  readModel: IInventoryReadModel,
): IInventoryUncoveredReadPort {
  return {
    getUncovered: async (organizationId: OrganizationId, sku: Sku) => {
      const snapshot = await readModel.getSnapshot(sku, LocationId.DEFAULT, organizationId);
      return snapshot.uncovered;
    },
  };
}

export function committedCustomerNamesPort(
  salesOrderRepo: ISalesOrderRepository,
  customerRepo: ICustomerRepository,
): ICommittedCustomerNamesPort {
  return {
    async listCommittedCustomerNames(organizationId, skus) {
      if (skus.length === 0) {
        return [];
      }

      const skuSet = new Set(skus.map((sku) => sku.value));
      const customerIds = new Set<CustomerId>();

      let page = 1;
      const pageSize = 100;
      while (true) {
        const pageResult = await salesOrderRepo.list({
          organizationId,
          status: "confirmed",
          page,
          pageSize,
        });
        for (const order of pageResult.items) {
          const liveLines = order.lines.filter((line) => !line.decommitted);
          if (liveLines.some((line) => skuSet.has(line.sku.value))) {
            customerIds.add(order.customerId);
          }
        }
        if (page * pageSize >= pageResult.total) {
          break;
        }
        page += 1;
      }

      const rows = await Promise.all(
        [...customerIds].map(async (customerId) => {
          const customer = await customerRepo.findById(organizationId, customerId);
          if (customer === null) {
            return null;
          }
          return { customerId: customer.id, name: customer.name } as const;
        }),
      );

      return rows
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => a.customerId.localeCompare(b.customerId));
    },
  };
}
