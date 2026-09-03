import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { BillToAddressSnapshot } from "../domain/bill-to.js";
import type { ICustomerBillToSnapshotReadPort } from "../domain/ports/customer-bill-to-snapshot-read.js";
import type { IBillToRepository } from "../domain/ports/bill-to-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export class CustomerBillToSnapshotReadAdapter implements ICustomerBillToSnapshotReadPort {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly billTos: IBillToRepository,
  ) {}

  async getBillToAddressSnapshot(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<BillToAddressSnapshot | null> {
    const customer = await this.customers.findById(organizationId, customerId);
    if (customer === null) {
      return null;
    }
    const billTo = await this.billTos.findByCustomerId(customerId);
    if (billTo === null) {
      return null;
    }
    return {
      line1: billTo.line1,
      line2: billTo.line2,
      city: billTo.city,
      region: billTo.region,
      postal: billTo.postal,
      country: billTo.country,
    };
  }
}
