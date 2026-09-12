import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { ILicensingTenantProvisioner } from "../domain/ports/licensing-tenant-provisioner.js";

export type EnsureLicensingTenantRequest = {
  tenantId: OrganizationId;
};

export class EnsureLicensingTenantUseCase {
  constructor(private readonly provisioner: ILicensingTenantProvisioner) {}

  async execute(input: EnsureLicensingTenantRequest): Promise<void> {
    await this.provisioner.ensureEmptyTenant(input.tenantId);
  }
}
