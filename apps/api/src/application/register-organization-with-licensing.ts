import type {
  RegisterOrganizationRequest,
  RegisterOrganizationResult,
  RollbackOrganizationRegistrationUseCase,
} from "@dc-inventory/identity";
import type { EnsureLicensingTenantUseCase } from "@dc-inventory/licensing";
import type { RegisterOrganizationUseCase } from "@dc-inventory/identity";

export type RegisterOrganizationWithLicensingResult =
  | RegisterOrganizationResult
  | { ok: false; reason: "licensing_twin_failed" };

export class RegisterOrganizationWithLicensingUseCase {
  constructor(
    private readonly registerOrganization: RegisterOrganizationUseCase,
    private readonly ensureLicensingTenant: EnsureLicensingTenantUseCase,
    private readonly rollbackOrganizationRegistration: RollbackOrganizationRegistrationUseCase,
  ) {}

  async execute(
    input: RegisterOrganizationRequest,
  ): Promise<RegisterOrganizationWithLicensingResult> {
    const result = await this.registerOrganization.execute(input);
    if (!result.ok) {
      return result;
    }

    try {
      await this.ensureLicensingTenant.execute({ tenantId: result.organizationId });
    } catch {
      await this.rollbackOrganizationRegistration.execute({
        organizationId: result.organizationId,
        staffUserId: result.staffUserId,
      });
      return { ok: false, reason: "licensing_twin_failed" };
    }

    return result;
  }
}
