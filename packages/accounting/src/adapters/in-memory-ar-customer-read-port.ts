import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { CustomerArLoadedData } from "../domain/ar-projection.js";
import type { IArCustomerReadPort } from "../domain/ports/ar-customer-read-port.js";
import type { IAccountingRepository } from "../domain/ports/invoice-repository.js";
import { loadCustomerArData } from "./ar-read-support.js";

export class InMemoryArCustomerReadPort implements IArCustomerReadPort {
  constructor(private readonly repository: IAccountingRepository) {}

  async loadCustomerData(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<CustomerArLoadedData> {
    return loadCustomerArData(this.repository, organizationId, customerId);
  }
}
