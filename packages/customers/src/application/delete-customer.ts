import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IBillToRepository } from "../domain/ports/bill-to-repository.js";
import type { IContactRepository } from "../domain/ports/contact-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IExemptionCertificateRepository } from "../domain/ports/exemption-certificate-repository.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";

export type DeleteCustomerResult = { ok: true } | { ok: false; reason: "not_found" };

export class DeleteCustomerUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly contacts: IContactRepository,
    private readonly shipTos: IShipToRepository,
    private readonly billTos: IBillToRepository,
    private readonly certificates: IExemptionCertificateRepository,
  ) {}

  async execute(input: {
    organizationId: OrganizationId;
    customerId: CustomerId;
  }): Promise<DeleteCustomerResult> {
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }

    await this.contacts.deleteByCustomerId(input.customerId);
    await this.shipTos.deleteByCustomerId(input.customerId);
    await this.certificates.deleteByCustomerId(input.customerId);
    await this.billTos.deleteByCustomerId(input.customerId);
    await this.customers.deleteById(input.organizationId, input.customerId);
    return { ok: true };
  }
}
