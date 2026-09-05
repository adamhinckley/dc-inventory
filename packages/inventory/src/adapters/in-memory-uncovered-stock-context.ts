import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type {
  IUncoveredCaseQtyReadPort,
  IUncoveredReorderPolicyReadPort,
  UncoveredCaseQty,
  UncoveredReorderPolicy,
} from "../domain/ports/uncovered-stock-context.js";

function uniqueSkus(skus: readonly Sku[]): Sku[] {
  return [...new Map(skus.map((sku) => [sku.value, sku])).values()];
}

export class InMemoryUncoveredCaseQtyReadPort implements IUncoveredCaseQtyReadPort {
  private readonly byOrgSku = new Map<string, UncoveredCaseQty>();

  set(organizationId: OrganizationId, sku: string, caseQty: number | null): void {
    this.byOrgSku.set(`${organizationId}:${sku}`, Object.freeze({ caseQty }));
  }

  async readBySkus(organizationId: OrganizationId, skus: readonly Sku[]) {
    const rows = new Map<string, UncoveredCaseQty>();
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

export class InMemoryUncoveredReorderPolicyReadPort
  implements IUncoveredReorderPolicyReadPort
{
  private readonly byOrgLocationSku = new Map<string, UncoveredReorderPolicy>();

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
    const rows = new Map<string, UncoveredReorderPolicy>();
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
