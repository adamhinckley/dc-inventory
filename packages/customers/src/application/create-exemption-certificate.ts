import type { CustomerId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { ExemptionCertificate } from "../domain/exemption-certificate.js";
import { ExemptionCertificateId, newUuid } from "../domain/ids.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IExemptionCertificateRepository } from "../domain/ports/exemption-certificate-repository.js";

export type CreateExemptionCertificateRequest = {
  staffUserId: StaffUserId;
  customerId: CustomerId;
  jurisdiction: string;
  status: string;
  entityUseCode?: string | null;
  expiresAt?: Date | null;
  objectKey?: string | null;
};

export type CreateExemptionCertificateResult =
  | { ok: true; certificate: ExemptionCertificate }
  | { ok: false; reason: "not_found" | "invalid" };

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

export class CreateExemptionCertificateUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly certificates: IExemptionCertificateRepository,
  ) {}

  async execute(
    input: CreateExemptionCertificateRequest,
  ): Promise<CreateExemptionCertificateResult> {
    void input.staffUserId;
    const jurisdiction = input.jurisdiction.trim();
    const status = input.status.trim();
    if (jurisdiction.length === 0 || status.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    const customer = await this.customers.findById(input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    const certificate: ExemptionCertificate = {
      id: ExemptionCertificateId.parse(newUuid()),
      customerId: input.customerId,
      objectKey: optionalText(input.objectKey),
      jurisdiction,
      entityUseCode: optionalText(input.entityUseCode),
      expiresAt: input.expiresAt ?? null,
      status,
    };
    await this.certificates.save(certificate);
    return { ok: true, certificate };
  }
}
