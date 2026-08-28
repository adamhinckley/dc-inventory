import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type {
  FactorySendCatalogRow,
  IFactorySendCatalogPort,
} from "../domain/ports/factory-send-catalog.js";

function catalogKey(organizationId: OrganizationId, sku: string): string {
  return `${organizationId}:${sku}`;
}

export class InMemoryFactorySendCatalogPort implements IFactorySendCatalogPort {
  private readonly byOrgSku = new Map<string, FactorySendCatalogRow>();

  set(organizationId: OrganizationId, sku: string, row: FactorySendCatalogRow): void {
    this.byOrgSku.set(catalogKey(organizationId, sku), row);
  }

  async readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, FactorySendCatalogRow>> {
    const result = new Map<string, FactorySendCatalogRow>();
    for (const sku of skus) {
      result.set(
        sku.value,
        this.byOrgSku.get(catalogKey(organizationId, sku.value)) ?? { caseQty: null },
      );
    }
    return result;
  }
}
