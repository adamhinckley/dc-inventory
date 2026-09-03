import type { ICommittedCustomerNamesListQuery } from "@dc-inventory/sales";
import type {
  ICommittedCustomerNamesPort,
  IInventoryUncoveredReadPort,
} from "@dc-inventory/purchasing";
import type { IInventoryReadModel } from "@dc-inventory/inventory";
import { LocationId, type OrganizationId, type Sku } from "@dc-inventory/shared-kernel";

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
  listQuery: ICommittedCustomerNamesListQuery,
): ICommittedCustomerNamesPort {
  return {
    listCommittedCustomerNames: (organizationId, skus) =>
      listQuery.list({ organizationId, skus }),
  };
}
