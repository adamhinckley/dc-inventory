import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IImportReorderPolicyPort,
  ImportReorderPolicySeed,
} from "../domain/ports/import-reorder-policies.js";

export class InMemoryImportReorderPolicyPort implements IImportReorderPolicyPort {
  readonly policies = new Map<string, ImportReorderPolicySeed>();

  async upsertPolicies(
    organizationId: OrganizationId,
    policies: readonly ImportReorderPolicySeed[],
  ): Promise<void> {
    for (const policy of policies) {
      this.policies.set(`${organizationId}:${policy.sku.value}`, policy);
    }
  }
}
