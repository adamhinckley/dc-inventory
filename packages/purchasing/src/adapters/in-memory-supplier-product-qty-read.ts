import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type { ISupplierProductQtyReadPort } from "../domain/ports/supplier-product-repository.js";
import type { SupplierProductQty } from "../domain/qty.js";

function qtyKey(organizationId: OrganizationId, sku: string): string {
  return `${organizationId}:${sku}`;
}

export class InMemorySupplierProductQtyReadPort implements ISupplierProductQtyReadPort {
  private readonly byOrgSku = new Map<string, SupplierProductQty>();

  set(organizationId: OrganizationId, sku: string, qty: SupplierProductQty): void {
    this.byOrgSku.set(qtyKey(organizationId, sku), qty);
  }

  async readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, SupplierProductQty>> {
    const result = new Map<string, SupplierProductQty>();
    for (const sku of skus) {
      const found = this.byOrgSku.get(qtyKey(organizationId, sku.value));
      if (found !== undefined) {
        result.set(sku.value, found);
      }
    }
    return result;
  }
}
