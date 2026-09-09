import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { CustomerArLoadedData } from "../domain/ar-projection.js";
import type { IArOrgReadPort } from "../domain/ports/ar-org-read-port.js";
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
}
