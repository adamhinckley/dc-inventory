import { OrganizationId, ProductId } from "@dc-inventory/shared-kernel";
import { newUuid, SalesOrderLineId } from "../domain/ids.js";
import type { ICatalogProductPort, ProductSnapshot } from "../domain/ports/catalog-product.js";
import type { SalesOrderLine } from "../domain/sales-order.js";
import type { ConfirmSalesOrderShortage } from "./confirm-sales-order.js";
import { lockedDraftIncreaseShortage } from "./draft-line-sellable.js";

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
        | "product_organization_mismatch"
        | "insufficient_atp";
      shortage?: ConfirmSalesOrderShortage;
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
  existingQtyBySku: ReadonlyMap<string, number> = new Map(),
  existingLines: readonly SalesOrderLine[] = [],
): Promise<BuildSalesOrderLinesResult> {
  const merged = mergeSalesOrderLineInputs(lines);
  if (merged === "invalid") {
    return { ok: false, reason: "invalid" };
  }

  const existingBySku = new Map<string, SalesOrderLine>();
  for (const line of existingLines) {
    if (!existingBySku.has(line.sku.value)) {
      existingBySku.set(line.sku.value, line);
    }
  }

  const productIds = [...merged.keys()];
  if (existingLines.length === 0) {
    const products = await catalogProducts.findByIds(organizationId, productIds);
    const created: SalesOrderLine[] = [];
    for (const [productId, qty] of merged) {
      const product = products.get(productId);
      if (product === undefined) {
        return { ok: false, reason: "product_not_found" };
      }
      if (product.organizationId !== organizationId) {
        return { ok: false, reason: "product_organization_mismatch" };
      }
      if (!product.active) {
        return { ok: false, reason: "product_inactive" };
      }
      const shortage = lockedDraftIncreaseShortage(
        product,
        qty,
        existingQtyBySku.get(product.sku.value) ?? 0,
      );
      if (shortage !== null) {
        return { ok: false, reason: "insufficient_atp", shortage };
      }
      created.push({
        id: SalesOrderLineId.parse(newUuid()),
        sku: product.sku,
        name: product.name,
        qty,
        unitPrice: product.unitPrice,
        taxCategoryCode: product.taxCategoryCode,
      });
    }
    return { ok: true, lines: created };
  }

  const identities = await catalogProducts.findByIds(organizationId, productIds, {
    includeQty: false,
  });

  const increasedIds: ProductId[] = [];
  for (const [productId, qty] of merged) {
    const product = identities.get(productId);
    if (product === undefined) {
      return { ok: false, reason: "product_not_found" };
    }
    if (product.organizationId !== organizationId) {
      return { ok: false, reason: "product_organization_mismatch" };
    }
    if (!product.active) {
      return { ok: false, reason: "product_inactive" };
    }
    const alreadyOnDraft = existingQtyBySku.get(product.sku.value) ?? 0;
    if (qty > alreadyOnDraft) {
      increasedIds.push(productId);
    }
  }

  const qtyByProductId: ReadonlyMap<string, ProductSnapshot> =
    increasedIds.length === 0
      ? new Map()
      : await catalogProducts.findByIds(organizationId, increasedIds);

  const built: SalesOrderLine[] = [];
  for (const [productId, qty] of merged) {
    const identity = identities.get(productId);
    if (identity === undefined) {
      return { ok: false, reason: "product_not_found" };
    }
    const existing = existingBySku.get(identity.sku.value);
    if (existing !== undefined && qty <= (existingQtyBySku.get(identity.sku.value) ?? 0)) {
      built.push({ ...existing, qty });
      continue;
    }
    const product = qtyByProductId.get(productId) ?? identity;
    const shortage = lockedDraftIncreaseShortage(
      product,
      qty,
      existingQtyBySku.get(product.sku.value) ?? 0,
    );
    if (shortage !== null) {
      return { ok: false, reason: "insufficient_atp", shortage };
    }
    built.push({
      id: existing?.id ?? SalesOrderLineId.parse(newUuid()),
      sku: product.sku,
      name: product.name,
      qty,
      unitPrice: product.unitPrice,
      taxCategoryCode: product.taxCategoryCode,
    });
  }

  return { ok: true, lines: built };
}
