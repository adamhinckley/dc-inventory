import type { OrganizationId } from "@dc-inventory/shared-kernel";

/** Provisions the licensing twin row for a tenant (TenantId === OrganizationId). */
export interface ILicensingTenantProvisioner {
  ensureEmptyTenant(tenantId: OrganizationId): Promise<void>;
}
