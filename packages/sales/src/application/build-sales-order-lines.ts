import { OrganizationId, ProductId } from "@dc-inventory/shared-kernel";
import { newUuid, SalesOrderLineId } from "../domain/ids.js";
import type { ICatalogProductPort } from "../domain/ports/catalog-product.js";
import type { SalesOrderLine } from "../domain/sales-order.js";

export type SalesOrderLineInput = {
  productId: string;
  qty: number;
};

export type BuildSalesOrderLinesResult =
  | { ok: true; lines: SalesOrderLine[] }
  | {
      ok: false;
      reason:
        | "invalid"
        | "product_not_found"
        | "product_inactive"
        | "product_organization_mismatch";
    };

export function mergeSalesOrderLineInputs(
  lines: readonly SalesOrderLineInput[],
): Map<ProductId, number> | "invalid" {
  const requestedQuantities = new Map<ProductId, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      return "invalid";
    }
    try {
      const productId = ProductId.parse(line.productId);
      requestedQuantities.set(
        productId,
        (requestedQuantities.get(productId) ?? 0) + line.qty,
      );
    } catch {
      return "invalid";
    }
  }
  return requestedQuantities;
}

export async function buildSalesOrderLines(
  organizationId: OrganizationId,
  catalogProducts: ICatalogProductPort,
  lines: readonly SalesOrderLineInput[],
): Promise<BuildSalesOrderLinesResult> {
  const merged = mergeSalesOrderLineInputs(lines);
  if (merged === "invalid") {
    return { ok: false, reason: "invalid" };
  }

  const built: SalesOrderLine[] = [];
  for (const [productId, qty] of merged) {
    const product = await catalogProducts.findById(organizationId, productId);
    if (product === null) {
      return { ok: false, reason: "product_not_found" };
    }
    if (product.organizationId !== organizationId) {
      return { ok: false, reason: "product_organization_mismatch" };
    }
    if (!product.active) {
      return { ok: false, reason: "product_inactive" };
    }
    built.push({
      id: SalesOrderLineId.parse(newUuid()),
      sku: product.sku,
      name: product.name,
      qty,
      unitPrice: product.unitPrice,
      taxCategoryCode: product.taxCategoryCode,
    });
  }

  return { ok: true, lines: built };
}
