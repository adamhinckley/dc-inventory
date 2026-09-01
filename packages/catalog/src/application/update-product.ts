import { Money, Sku, type OrganizationId, type ProductId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IProductPackagingRepository } from "../domain/ports/product-packaging.js";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import type { Product } from "../domain/product.js";
import { ZERO_QTY, type ProductQty } from "../domain/qty.js";
import { hasQtyWriteFields, hasSkuField } from "./write-guards.js";

export type UpdateProductRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  productId?: ProductId;
  sku?: string;
  name?: string;
  uom?: string;
  masterPackPrice?: number;
  currency?: string;
  inactive?: boolean;
  discontinued?: boolean;
  webWholesale?: boolean;
  description?: string | null;
  taxCategoryCode?: string | null;
  caseQty?: number | null;
};

export type UpdateProductResult =
  | { ok: true; product: Product; qty: ProductQty; caseQty: number | null }
  | {
      ok: false;
      reason: "not_found" | "invalid" | "sku_immutable" | "qty_not_allowed";
    };

export class UpdateProductUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly qty: IQtyReadPort,
    private readonly packaging: IProductPackagingRepository,
  ) {}

  async execute(input: UpdateProductRequest): Promise<UpdateProductResult> {
    void input.staffUserId;
    if (input.productId !== undefined && hasSkuField(input)) {
      return { ok: false, reason: "sku_immutable" };
    }
    if (hasQtyWriteFields(input)) {
      return { ok: false, reason: "qty_not_allowed" };
    }
    if (input.caseQty !== undefined && input.caseQty !== null && input.caseQty <= 0) {
      return { ok: false, reason: "invalid" };
    }
    const existing =
      input.productId !== undefined
        ? await this.products.findById(input.organizationId, input.productId)
        : input.sku !== undefined
          ? await this.products.findBySku(input.organizationId, Sku.parse(input.sku))
          : null;
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    const name = input.name === undefined ? existing.name : input.name.trim();
    const uom = input.uom === undefined ? existing.uom : input.uom.trim();
    if (name.length === 0 || uom.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    const description =
      input.description === undefined
        ? existing.description
        : input.description === null
          ? null
          : input.description.trim() || null;
    const taxCategoryCode =
      input.taxCategoryCode === undefined
        ? existing.taxCategoryCode
        : input.taxCategoryCode === null
          ? null
          : input.taxCategoryCode.trim() || null;
    try {
      const currency = input.currency ?? existing.masterPackPrice.currency;
      const cents = input.masterPackPrice ?? existing.masterPackPrice.amountMinor;
      const product: Product = {
        id: existing.id,
        organizationId: existing.organizationId,
        sku: existing.sku,
        name,
        description,
        uom,
        masterPackPrice: Money.fromMinorUnits(cents, currency),
        inactive: input.inactive ?? existing.inactive,
        discontinued: input.discontinued ?? existing.discontinued,
        webWholesale: input.webWholesale ?? existing.webWholesale,
        taxCategoryCode,
      };
      await this.products.save(product);
      const existingPack = await this.packaging.findByProductId(product.id);
      const caseQty =
        input.caseQty === undefined ? (existingPack?.caseQty ?? null) : input.caseQty;
      if (input.caseQty !== undefined || existingPack !== null) {
        await this.packaging.save({
          productId: product.id,
          caseQty,
          caseLength: existingPack?.caseLength ?? null,
          caseWidth: existingPack?.caseWidth ?? null,
          caseHeight: existingPack?.caseHeight ?? null,
        });
      }
      const snapshots = await this.qty.readBySkus(input.organizationId, [product.sku]);
      return {
        ok: true,
        product,
        qty: snapshots.get(product.sku.value) ?? ZERO_QTY,
        caseQty,
      };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
}
