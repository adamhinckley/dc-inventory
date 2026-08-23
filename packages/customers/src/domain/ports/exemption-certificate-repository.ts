import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { ExemptionCertificate } from "../exemption-certificate.js";
import type { ExemptionCertificateId } from "../ids.js";

export interface IExemptionCertificateRepository {
  listByCustomer(customerId: CustomerId): Promise<ExemptionCertificate[]>;
  findById(id: ExemptionCertificateId): Promise<ExemptionCertificate | null>;
  save(certificate: ExemptionCertificate): Promise<void>;
}
