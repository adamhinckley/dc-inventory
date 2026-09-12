import { OrganizationId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import type { LicensingDrizzle } from "./drizzle-licensing-read-repository.js";
import type { ILicensingTenantProvisioner } from "../domain/ports/licensing-tenant-provisioner.js";
import { subscriptions } from "../persistence/schema.js";

/** Empty licensing twin: trialing subscription, no payments. */
export class DrizzleLicensingTenantProvisioner implements ILicensingTenantProvisioner {
  constructor(private readonly db: LicensingDrizzle) {}

  async ensureEmptyTenant(tenantId: OrganizationId): Promise<void> {
    const existing = await this.db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);
    if (existing.length > 0) {
      return;
    }
    const now = new Date();
    await this.db.insert(subscriptions).values({
      tenantId,
      plan: "twin",
      status: "trialing",
      periodStart: now,
      periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      providerRef: null,
    });
  }
}
