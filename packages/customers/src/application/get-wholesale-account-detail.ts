import type { CustomerId, OrganizationId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import type { BillTo } from "../domain/bill-to.js";
import type { Contact } from "../domain/contact.js";
import type { Customer } from "../domain/customer.js";
import type { ExemptionCertificate } from "../domain/exemption-certificate.js";
import type { IBillToRepository } from "../domain/ports/bill-to-repository.js";
import type { IContactRepository } from "../domain/ports/contact-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IExemptionCertificateRepository } from "../domain/ports/exemption-certificate-repository.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";
import type { ShipTo } from "../domain/ship-to.js";

export type GetWholesaleAccountDetailRequest = {
  organizationId: OrganizationId;
  wholesaleUserId: WholesaleUserId;
  customerId: CustomerId;
};

export type GetWholesaleAccountDetailResult =
  | {
      ok: true;
      account: Customer;
      shipTos: ShipTo[];
      billTo: BillTo | null;
      contacts: Contact[];
      certificates: ExemptionCertificate[];
    }
  | { ok: false; reason: "not_found" };

export class GetWholesaleAccountDetailUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly shipTos: IShipToRepository,
    private readonly billTos: IBillToRepository,
    private readonly contacts: IContactRepository,
    private readonly certificates: IExemptionCertificateRepository,
  ) {}

  async execute(
    input: GetWholesaleAccountDetailRequest,
  ): Promise<GetWholesaleAccountDetailResult> {
    void input.wholesaleUserId;
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }

    const [shipTos, contacts, billTo, certificates] = await Promise.all([
      this.shipTos.listByCustomer(input.customerId),
      this.contacts.listByCustomer(input.customerId),
      this.billTos.findByCustomerId(input.customerId),
      this.certificates.listByCustomer(input.customerId),
    ]);

    return {
      ok: true,
      account: customer,
      shipTos,
      billTo,
      contacts,
      certificates,
    };
  }
}
