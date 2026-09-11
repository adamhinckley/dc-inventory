import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type {
  IPreOrderCaseQtyReadPort,
  IPreOrderReorderPolicyReadPort,
  PreOrderCaseQty,
  PreOrderReorderPolicy,
} from "../domain/ports/pre-order-stock-context.js";

function uniqueSkus(skus: readonly Sku[]): Sku[] {
  return [...new Map(skus.map((sku) => [sku.value, sku])).values()];
}

export class InMemoryPreOrderCaseQtyReadPort implements IPreOrderCaseQtyReadPort {
  private readonly byOrgSku = new Map<string, PreOrderCaseQty>();

  set(organizationId: OrganizationId, sku: string, caseQty: number | null): void {
    this.byOrgSku.set(`${organizationId}:${sku}`, Object.freeze({ caseQty }));
  }

  async readBySkus(organizationId: OrganizationId, skus: readonly Sku[]) {
    const rows = new Map<string, PreOrderCaseQty>();
    for (const sku of uniqueSkus(skus)) {
      rows.set(
        sku.value,
        this.byOrgSku.get(`${organizationId}:${sku.value}`) ??
          Object.freeze({ caseQty: null }),
      );
    }
    return rows;
  }
}

export class InMemoryPreOrderReorderPolicyReadPort
  implements IPreOrderReorderPolicyReadPort
{
  private readonly byOrgLocationSku = new Map<string, PreOrderReorderPolicy>();

  set(
    organizationId: OrganizationId,
    locationId: LocationId,
    sku: string,
    reorderMin: number | null,
    reorderMax: number | null,
  ): void {
    this.byOrgLocationSku.set(
      `${organizationId}:${locationId}:${sku}`,
      Object.freeze({ reorderMin, reorderMax }),
    );
  }

  async readBySkus(
    organizationId: OrganizationId,
    locationId: LocationId,
    skus: readonly Sku[],
  ) {
    const rows = new Map<string, PreOrderReorderPolicy>();
    for (const sku of uniqueSkus(skus)) {
      rows.set(
        sku.value,
        this.byOrgLocationSku.get(`${organizationId}:${locationId}:${sku.value}`) ??
          Object.freeze({ reorderMin: null, reorderMax: null }),
      );
    }
    return rows;
  }
}
