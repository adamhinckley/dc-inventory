import type { CustomerId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { ExemptionCertificate } from "../domain/exemption-certificate.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IExemptionCertificateRepository } from "../domain/ports/exemption-certificate-repository.js";

export type ListExemptionCertificatesRequest = {
  staffUserId: StaffUserId;
  customerId: CustomerId;
};

export type ListExemptionCertificatesResult =
  | { ok: true; items: ExemptionCertificate[] }
  | { ok: false; reason: "not_found" };

export class ListExemptionCertificatesUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly certificates: IExemptionCertificateRepository,
  ) {}

  async execute(
    input: ListExemptionCertificatesRequest,
  ): Promise<ListExemptionCertificatesResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    return {
      ok: true,
      items: await this.certificates.listByCustomer(input.customerId),
    };
  }
}
