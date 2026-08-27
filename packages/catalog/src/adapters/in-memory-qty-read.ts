import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import type { ProductQty } from "../domain/qty.js";

function qtyKey(organizationId: OrganizationId, sku: string): string {
  return `${organizationId}:${sku}`;
}

export class InMemoryQtyReadPort implements IQtyReadPort {
  private readonly byOrgSku = new Map<string, ProductQty>();

  set(organizationId: OrganizationId, sku: string, qty: ProductQty): void {
    this.byOrgSku.set(qtyKey(organizationId, sku), qty);
  }

  async readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, ProductQty>> {
    const result = new Map<string, ProductQty>();
    for (const sku of skus) {
      const found = this.byOrgSku.get(qtyKey(organizationId, sku.value));
      if (found !== undefined) {
        result.set(sku.value, found);
      }
    }
    return result;
  }
}
