import { Money, Sku, type OrganizationId, type ProductId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IProductCategoryRepository } from "../domain/ports/product-categories.js";
import type { IProductIdentifierRepository } from "../domain/ports/product-identifiers.js";
import { productIdentifiersFromCodes } from "../domain/ports/product-identifiers.js";
import type { IProductPrimarySupplierReadPort } from "../domain/ports/product-primary-supplier-read.js";
import type { IProductReorderReadPort } from "../domain/ports/product-reorder-read.js";
import type { IProductPackagingRepository, ProductPackaging } from "../domain/ports/product-packaging.js";
import { emptyProductPackaging } from "../domain/ports/product-packaging.js";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import type { Product } from "../domain/product.js";
import { ZERO_QTY, type ProductQty } from "../domain/qty.js";
import { loadProductEnrichment, type ProductEnrichment } from "./product-enrichment.js";
import { hasQtyWriteFields, hasSkuField } from "./write-guards.js";

export type UpdateProductRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  productId?: ProductId;
  sku?: string;
  name?: string;
  uom?: string;
  memberPriceCents?: number;
  listPriceCents?: number | null;
  currency?: string;
  inactive?: boolean;
  discontinued?: boolean;
  webWholesale?: boolean;
  description?: string | null;
  countryOfOrigin?: string | null;
  material?: string | null;
  length?: string | null;
  width?: string | null;
  height?: string | null;
  diameter?: string | null;
  size?: string | null;
  weight?: string | null;
  weightUom?: string | null;
  originalWholesalePriceCents?: number | null;
  catalogPage?: string | null;
  defaultOrderQty?: number | null;
  defaultWeight?: string | null;
  defaultWeightUom?: string | null;
  nonStock?: boolean;
  noExport?: boolean;
  webRetail?: boolean;
  upc?: string | null;
  mfgCode?: string | null;
  altCodes?: readonly string[] | null;
  categoryNames?: readonly string[] | null;
  packLength?: string | null;
  packWidth?: string | null;
  packHeight?: string | null;
  packWeight?: string | null;
  packWeightUom?: string | null;
  innerPackQty?: number | null;
  innerPackLength?: string | null;
  innerPackWidth?: string | null;
  innerPackHeight?: string | null;
  innerPackWeight?: string | null;
  innerPackWeightUom?: string | null;
  caseQty?: number | null;
  caseLength?: string | null;
  caseWidth?: string | null;
  caseHeight?: string | null;
  caseWeight?: string | null;
  caseWeightUom?: string | null;
};

export type UpdateProductResult =
  | { ok: true; product: Product; qty: ProductQty } & ProductEnrichment
  | {
      ok: false;
      reason: "not_found" | "invalid" | "sku_immutable" | "qty_not_allowed";
    };

function optionalString(
  input: string | null | undefined,
  existing: string | null,
): string | null {
  if (input === undefined) {
    return existing;
  }
  if (input === null) {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optionalPositiveInt(
  input: number | null | undefined,
  existing: number | null,
): number | null {
  return input === undefined ? existing : input;
}

function hasPackagingPatch(input: UpdateProductRequest): boolean {
  return (
    input.packLength !== undefined ||
    input.packWidth !== undefined ||
    input.packHeight !== undefined ||
    input.packWeight !== undefined ||
    input.packWeightUom !== undefined ||
    input.innerPackQty !== undefined ||
    input.innerPackLength !== undefined ||
    input.innerPackWidth !== undefined ||
    input.innerPackHeight !== undefined ||
    input.innerPackWeight !== undefined ||
    input.innerPackWeightUom !== undefined ||
    input.caseQty !== undefined ||
    input.caseLength !== undefined ||
    input.caseWidth !== undefined ||
    input.caseHeight !== undefined ||
    input.caseWeight !== undefined ||
    input.caseWeightUom !== undefined
  );
}

function mergePackaging(
  productId: ProductId,
  existing: ProductPackaging | null,
  input: UpdateProductRequest,
): ProductPackaging {
  const base = existing ?? emptyProductPackaging(productId);
  return {
    productId,
    packLength: optionalString(input.packLength, base.packLength),
    packWidth: optionalString(input.packWidth, base.packWidth),
    packHeight: optionalString(input.packHeight, base.packHeight),
    packWeight: optionalString(input.packWeight, base.packWeight),
    packWeightUom: optionalString(input.packWeightUom, base.packWeightUom),
    innerPackQty: optionalPositiveInt(input.innerPackQty, base.innerPackQty),
    innerPackLength: optionalString(input.innerPackLength, base.innerPackLength),
    innerPackWidth: optionalString(input.innerPackWidth, base.innerPackWidth),
    innerPackHeight: optionalString(input.innerPackHeight, base.innerPackHeight),
    innerPackWeight: optionalString(input.innerPackWeight, base.innerPackWeight),
    innerPackWeightUom: optionalString(input.innerPackWeightUom, base.innerPackWeightUom),
    caseQty: optionalPositiveInt(input.caseQty, base.caseQty),
    caseLength: optionalString(input.caseLength, base.caseLength),
    caseWidth: optionalString(input.caseWidth, base.caseWidth),
    caseHeight: optionalString(input.caseHeight, base.caseHeight),
    caseWeight: optionalString(input.caseWeight, base.caseWeight),
    caseWeightUom: optionalString(input.caseWeightUom, base.caseWeightUom),
  };
}

function invalidPositiveInts(input: UpdateProductRequest): boolean {
  const ints = [input.caseQty, input.innerPackQty, input.defaultOrderQty];
  return ints.some((value) => value !== undefined && value !== null && value <= 0);
}

export class UpdateProductUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly qty: IQtyReadPort,
    private readonly packaging: IProductPackagingRepository,
    private readonly categories: IProductCategoryRepository,
    private readonly identifiers: IProductIdentifierRepository,
    private readonly primarySupplier: IProductPrimarySupplierReadPort,
    private readonly reorder: IProductReorderReadPort,
  ) {}

  async execute(input: UpdateProductRequest): Promise<UpdateProductResult> {
    void input.staffUserId;
    if (input.productId !== undefined && hasSkuField(input)) {
      return { ok: false, reason: "sku_immutable" };
    }
    if (hasQtyWriteFields(input)) {
      return { ok: false, reason: "qty_not_allowed" };
    }
    if (invalidPositiveInts(input)) {
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
    try {
      const currency = input.currency ?? existing.memberPrice.currency;
      const cents = input.memberPriceCents ?? existing.memberPrice.amountMinor;
      const listCents =
        input.listPriceCents === undefined
          ? (existing.listPrice?.amountMinor ?? null)
          : input.listPriceCents;
      const originalWholesalePriceCents =
        input.originalWholesalePriceCents === undefined
          ? (existing.originalWholesalePrice?.amountMinor ?? null)
          : input.originalWholesalePriceCents;
      const product: Product = {
        id: existing.id,
        organizationId: existing.organizationId,
        sku: existing.sku,
        name,
        description,
        uom,
        memberPrice: Money.fromMinorUnits(cents, currency),
        listPrice: listCents === null ? null : Money.fromMinorUnits(listCents, currency),
        inactive: input.inactive ?? existing.inactive,
        discontinued: input.discontinued ?? existing.discontinued,
        webWholesale: input.webWholesale ?? existing.webWholesale,
        taxCategoryCode: null,
        countryOfOrigin: optionalString(input.countryOfOrigin, existing.countryOfOrigin),
        material: optionalString(input.material, existing.material),
        length: optionalString(input.length, existing.length),
        width: optionalString(input.width, existing.width),
        height: optionalString(input.height, existing.height),
        diameter: optionalString(input.diameter, existing.diameter),
        size: optionalString(input.size, existing.size),
        weight: optionalString(input.weight, existing.weight),
        weightUom: optionalString(input.weightUom, existing.weightUom),
        originalWholesalePrice:
          originalWholesalePriceCents === null
            ? null
            : Money.fromMinorUnits(originalWholesalePriceCents, currency),
        catalogPage: optionalString(input.catalogPage, existing.catalogPage),
        defaultOrderQty: optionalPositiveInt(input.defaultOrderQty, existing.defaultOrderQty),
        defaultWeight: optionalString(input.defaultWeight, existing.defaultWeight),
        defaultWeightUom: optionalString(input.defaultWeightUom, existing.defaultWeightUom),
        nonStock: input.nonStock ?? existing.nonStock,
        noExport: input.noExport ?? existing.noExport,
        webRetail: input.webRetail ?? existing.webRetail,
      };
      await this.products.save(product);
      const existingPack = await this.packaging.findByProductId(product.id);
      if (hasPackagingPatch(input) || existingPack !== null) {
        await this.packaging.save(mergePackaging(product.id, existingPack, input));
      }
      if (input.upc !== undefined || input.mfgCode !== undefined || input.altCodes !== undefined) {
        const current = await this.identifiers.findByProductId(product.id);
        const upc =
          input.upc === undefined
            ? (current.find((row) => row.kind === "upc")?.code ?? null)
            : optionalString(input.upc, null);
        const mfgCode =
          input.mfgCode === undefined
            ? (current.find((row) => row.kind === "mfg")?.code ?? null)
            : optionalString(input.mfgCode, null);
        const altCodes =
          input.altCodes === undefined
            ? current.filter((row) => row.kind === "alt").map((row) => row.code)
            : input.altCodes === null
              ? []
              : input.altCodes;
        await this.identifiers.replaceForProducts([
          {
            productId: product.id,
            identifiers: productIdentifiersFromCodes(product.id, upc, mfgCode, altCodes),
          },
        ]);
      }
      if (input.categoryNames !== undefined) {
        await this.categories.replaceForProducts(input.organizationId, [
          {
            productId: product.id,
            categoryNames: input.categoryNames ?? [],
          },
        ]);
      }
      const snapshots = await this.qty.readBySkus(input.organizationId, [product.sku]);
      const enrichment = await loadProductEnrichment(
        input.organizationId,
        product.id,
        product.sku,
        this.packaging,
        this.categories,
        this.identifiers,
        this.primarySupplier,
        this.reorder,
      );
      return {
        ok: true,
        product,
        qty: snapshots.get(product.sku.value) ?? ZERO_QTY,
        ...enrichment,
      };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
}
