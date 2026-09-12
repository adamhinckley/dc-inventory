import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { ExemptionCertificate } from "../domain/exemption-certificate.js";
import type { ExemptionCertificateId } from "../domain/ids.js";
import type { IExemptionCertificateRepository } from "../domain/ports/exemption-certificate-repository.js";

export class InMemoryExemptionCertificateRepository
  implements IExemptionCertificateRepository
{
  private readonly byId = new Map<ExemptionCertificateId, ExemptionCertificate>();

  async listByCustomer(customerId: CustomerId): Promise<ExemptionCertificate[]> {
    return [...this.byId.values()].filter((row) => row.customerId === customerId);
  }

  async findById(id: ExemptionCertificateId): Promise<ExemptionCertificate | null> {
    return this.byId.get(id) ?? null;
  }

  async save(certificate: ExemptionCertificate): Promise<void> {
    this.byId.set(certificate.id, certificate);
  }

  async deleteByCustomerId(customerId: CustomerId): Promise<void> {
    for (const [id, row] of this.byId) {
      if (row.customerId === customerId) {
        this.byId.delete(id);
      }
    }
  }
}
