import { Sku, type OrganizationId } from "@dc-inventory/shared-kernel";
import type { ICatalogSkuLookupPort } from "../domain/ports/supplier-product-repository.js";

function catalogKey(organizationId: OrganizationId, sku: string): string {
  return `${organizationId}:${sku}`;
}

export class InMemoryCatalogSkuLookupPort implements ICatalogSkuLookupPort {
  private readonly byOrgSku = new Map<string, { sku: Sku; name: string; archived: boolean }>();

  set(
    organizationId: OrganizationId,
    sku: string,
    name: string,
    options: { archived?: boolean } = {},
  ): void {
    const parsedSku = Sku.parse(sku);
    this.byOrgSku.set(catalogKey(organizationId, parsedSku.value), {
      sku: parsedSku,
      name,
      archived: options.archived ?? false,
    });
  }

  async findBySku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<{ sku: Sku; name: string; archived: boolean } | null> {
    return this.byOrgSku.get(catalogKey(organizationId, sku.value)) ?? null;
  }

  async findBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, { sku: Sku; name: string; archived: boolean }>> {
    const result = new Map<string, { sku: Sku; name: string; archived: boolean }>();
    for (const sku of skus) {
      const found = await this.findBySku(organizationId, sku);
      if (found !== null) {
        result.set(sku.value, found);
      }
    }
    return result;
  }
}
