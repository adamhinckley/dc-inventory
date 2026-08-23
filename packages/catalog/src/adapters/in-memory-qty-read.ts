import type { Sku } from "@dc-inventory/shared-kernel";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import type { ProductQty } from "../domain/qty.js";

export class InMemoryQtyReadPort implements IQtyReadPort {
  private readonly bySku = new Map<string, ProductQty>();

  set(sku: string, qty: ProductQty): void {
    this.bySku.set(sku, qty);
  }

  async readBySkus(skus: readonly Sku[]): Promise<ReadonlyMap<string, ProductQty>> {
    const result = new Map<string, ProductQty>();
    for (const sku of skus) {
      const found = this.bySku.get(sku.value);
      if (found !== undefined) {
        result.set(sku.value, found);
      }
    }
    return result;
  }
}
