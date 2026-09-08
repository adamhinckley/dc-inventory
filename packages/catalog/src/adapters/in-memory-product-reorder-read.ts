import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type {
  IImportReorderPolicyPort,
  ImportReorderPolicySeed,
} from "../domain/ports/import-reorder-policies.js";
import type {
  IProductReorderReadPort,
  ProductReorderPolicy,
} from "../domain/ports/product-reorder-read.js";

export class InMemoryProductReorderReadPort
  implements IProductReorderReadPort, IImportReorderPolicyPort
{
  readonly bySku = new Map<string, ProductReorderPolicy>();

  async upsertPolicies(
    _organizationId: OrganizationId,
    policies: readonly ImportReorderPolicySeed[],
  ): Promise<void> {
    for (const policy of policies) {
      this.bySku.set(policy.sku.value, {
        reorderMin: policy.reorderMin,
        reorderMax: policy.reorderMax,
      });
    }
  }

  async findByCatalogSku(
    _organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductReorderPolicy | null> {
    return this.bySku.get(sku.value) ?? null;
  }
}
