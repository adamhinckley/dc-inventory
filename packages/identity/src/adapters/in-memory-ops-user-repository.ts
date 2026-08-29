import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import type { OpsUser, OpsUserId } from "../domain/ops-user.js";
import type { IOpsUserRepository } from "../domain/ports/ops-user-repository.js";

function emailKey(tenantId: OrganizationId, email: string): string {
  return `${tenantId}:${normalizeEmail(email)}`;
}

export class InMemoryOpsUserRepository implements IOpsUserRepository {
  private readonly byId = new Map<OpsUserId, OpsUser>();
  private readonly byTenantEmail = new Map<string, OpsUser>();

  async findByEmail(tenantId: OrganizationId, email: string): Promise<OpsUser | null> {
    return this.byTenantEmail.get(emailKey(tenantId, email)) ?? null;
  }

  async findById(id: OpsUserId): Promise<OpsUser | null> {
    return this.byId.get(id) ?? null;
  }

  async save(user: OpsUser): Promise<void> {
    const stored = { ...user, email: normalizeEmail(user.email) };
    this.byId.set(stored.id, stored);
    this.byTenantEmail.set(emailKey(stored.tenantId, stored.email), stored);
  }
}
