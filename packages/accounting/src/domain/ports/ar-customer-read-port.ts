import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { CustomerArLoadedData } from "../ar-projection.js";

export interface IArCustomerReadPort {
  loadCustomerData(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<CustomerArLoadedData>;
}
