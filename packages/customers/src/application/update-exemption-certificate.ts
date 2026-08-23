import type { CustomerId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { ExemptionCertificate } from "../domain/exemption-certificate.js";
import type { ExemptionCertificateId } from "../domain/ids.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IExemptionCertificateRepository } from "../domain/ports/exemption-certificate-repository.js";

export type UpdateExemptionCertificateRequest = {
  staffUserId: StaffUserId;
  customerId: CustomerId;
  certificateId: ExemptionCertificateId;
  jurisdiction?: string;
  status?: string;
  entityUseCode?: string | null;
  expiresAt?: Date | null;
  objectKey?: string | null;
};

export type UpdateExemptionCertificateResult =
  | { ok: true; certificate: ExemptionCertificate }
  | { ok: false; reason: "not_found" | "invalid" };

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

export class UpdateExemptionCertificateUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly certificates: IExemptionCertificateRepository,
  ) {}

  async execute(
    input: UpdateExemptionCertificateRequest,
  ): Promise<UpdateExemptionCertificateResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    const existing = await this.certificates.findById(input.certificateId);
    if (existing === null || existing.customerId !== input.customerId) {
      return { ok: false, reason: "not_found" };
    }
    const jurisdiction =
      input.jurisdiction === undefined
        ? existing.jurisdiction
        : input.jurisdiction.trim();
    const status = input.status === undefined ? existing.status : input.status.trim();
    if (jurisdiction.length === 0 || status.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    const certificate: ExemptionCertificate = {
      id: existing.id,
      customerId: existing.customerId,
      objectKey:
        input.objectKey === undefined
          ? existing.objectKey
          : optionalText(input.objectKey),
      jurisdiction,
      entityUseCode:
        input.entityUseCode === undefined
          ? existing.entityUseCode
          : optionalText(input.entityUseCode),
      expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
      status,
    };
    await this.certificates.save(certificate);
    return { ok: true, certificate };
  }
}
