import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { Sku } from "@dc-inventory/shared-kernel";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IProductPackagingRepository } from "../domain/ports/product-packaging.js";
import type { ISupplierLinkPort } from "../domain/ports/supplier-link.js";
import type { WorkbookRow } from "../domain/ports/workbook-parser.js";
import { CreateProductUseCase } from "./create-product.js";
import {
  mapProductBrowserRow,
  missingProductBrowserHeaders,
  type ProductBrowserMappedRow,
  type ProductBrowserRowError,
} from "./map-product-browser-row.js";
import { UpdateProductUseCase } from "./update-product.js";

export type ImportProductBrowserRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  rows: readonly WorkbookRow[];
  dryRun: boolean;
};

export type ImportProductBrowserResult = {
  dryRun: boolean;
  rowsOk: number;
  created: number;
  updated: number;
  linked: number;
  errors: ProductBrowserRowError[];
};

export class ImportProductBrowserUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly suppliers: ISupplierLinkPort,
    private readonly packaging: IProductPackagingRepository,
  ) {}

  async execute(input: ImportProductBrowserRequest): Promise<ImportProductBrowserResult> {
    const headerErrors = missingProductBrowserHeaders(input.rows[0]);
    if (headerErrors.length > 0) {
      return {
        dryRun: input.dryRun,
        rowsOk: 0,
        created: 0,
        updated: 0,
        linked: 0,
        errors: headerErrors.map((field) => ({
          row: 1,
          field,
          message: "Product Browser header is missing",
        })),
      };
    }

    const errors: ProductBrowserRowError[] = [];
    const seen = new Map<string, number>();
    const valid: Array<{ rowNumber: number; value: ProductBrowserMappedRow }> = [];
    for (const [index, row] of input.rows.entries()) {
      const rowNumber = index + 2;
      const result = mapProductBrowserRow(row, rowNumber);
      if (!result.ok) {
        errors.push(...result.errors);
        continue;
      }
      const previous = seen.get(result.value.sku);
      if (previous !== undefined) {
        errors.push({
          row: rowNumber,
          field: "product_id",
          message: `Duplicate SKU; first seen on row ${String(previous)}`,
        });
        continue;
      }
      seen.set(result.value.sku, rowNumber);
      valid.push({ rowNumber, value: result.value });
    }

    if (input.dryRun) {
      return {
        dryRun: true,
        rowsOk: valid.length,
        created: 0,
        updated: 0,
        linked: 0,
        errors,
      };
    }

    let created = 0;
    let updated = 0;
    let linked = 0;
    for (const { rowNumber, value } of valid) {
      const sku = Sku.parse(value.sku);
      const existing = await this.products.findBySku(input.organizationId, sku);
      if (existing === null) {
        const createdResult = await this.createProduct.execute({
          organizationId: input.organizationId,
          staffUserId: input.staffUserId,
          sku: value.sku,
          name: value.name,
          uom: value.uom,
          memberPriceCents: value.memberPriceCents,
          currency: "USD",
          inactive: value.inactive,
          discontinued: value.discontinued,
          webWholesale: value.webWholesale,
          description: value.description,
          taxCategoryCode: value.taxCategoryCode,
        });
        if (!createdResult.ok) {
          errors.push({
            row: rowNumber,
            field: "product_id",
            message: createdResult.reason === "duplicate_sku" ? "SKU already exists" : "Product could not be created",
          });
          continue;
        }
        created += 1;
        await this.packaging.save({
          productId: createdResult.product.id,
          caseQty: value.caseQty,
        });
      } else {
        const updatedResult = await this.updateProduct.execute({
          organizationId: input.organizationId,
          staffUserId: input.staffUserId,
          productId: existing.id,
          name: value.name,
          uom: value.uom,
          memberPriceCents: value.memberPriceCents,
          currency: "USD",
          inactive: value.inactive,
          discontinued: value.discontinued,
          webWholesale: value.webWholesale,
          description: value.description,
          taxCategoryCode: value.taxCategoryCode,
        });
        if (!updatedResult.ok) {
          errors.push({
            row: rowNumber,
            field: "product_id",
            message: "Product could not be updated",
          });
          continue;
        }
        updated += 1;
        await this.packaging.save({
          productId: existing.id,
          caseQty: value.caseQty,
        });
      }

      if (value.vendorNumber === null || value.vendorName === null) {
        continue;
      }
      const link = await this.suppliers.linkSku({
        organizationId: input.organizationId,
        staffUserId: input.staffUserId,
        vendorNumber: value.vendorNumber,
        vendorName: value.vendorName,
        sku: value.sku,
        supplierSku: value.supplierSku,
        minOrderQty: value.minOrderQty,
        minOrderAmountCents: value.minOrderAmountCents,
        lastPoCostCents: value.lastPoCostCents,
      });
      if (!link.ok) {
        errors.push({
          row: rowNumber,
          field: "vendor",
          message: link.message,
        });
        continue;
      }
      linked += 1;
    }

    return {
      dryRun: false,
      rowsOk: valid.length,
      created,
      updated,
      linked,
      errors,
    };
  }
}
