import type { IProductReorderReadPort, ProductReorderPolicy } from "@dc-inventory/catalog";
import type { AppDrizzle } from "../infrastructure/db.js";
import { preOrderReorderPolicyReadPort } from "./pre-order-stock-context-ports.js";
import { LocationId, type OrganizationId, type Sku } from "@dc-inventory/shared-kernel";

export class DrizzleProductReorderReadAdapter implements IProductReorderReadPort {
  private readonly reorderRead;

  constructor(db: AppDrizzle) {
    this.reorderRead = preOrderReorderPolicyReadPort(db);
  }

  async findByCatalogSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductReorderPolicy | null> {
    const rows = await this.reorderRead.readBySkus(
      organizationId,
      LocationId.DEFAULT,
      [sku],
    );
    const policy = rows.get(sku.value);
    if (policy === undefined) {
      return null;
    }
    return {
      reorderMin: policy.reorderMin,
      reorderMax: policy.reorderMax,
    };
  }
}
