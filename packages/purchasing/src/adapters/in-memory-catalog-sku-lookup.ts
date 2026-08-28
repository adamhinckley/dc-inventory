import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type { ICatalogSkuLookupPort } from "../domain/ports/supplier-product-repository.js";

function catalogKey(organizationId: OrganizationId, sku: string): string {
  return `${organizationId}:${sku}`;
}

export class InMemoryCatalogSkuLookupPort implements ICatalogSkuLookupPort {
  private readonly byOrgSku = new Map<string, { name: string }>();

  set(organizationId: OrganizationId, sku: string, name: string): void {
    this.byOrgSku.set(catalogKey(organizationId, sku), { name });
  }

  async findBySku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<{ name: string } | null> {
    return this.byOrgSku.get(catalogKey(organizationId, sku.value)) ?? null;
  }
}
