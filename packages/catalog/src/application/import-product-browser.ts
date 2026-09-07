import {
  Money,
  ProductId,
  Sku,
  type OrganizationId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import { newUuid } from "../domain/ids.js";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type {
  IProductPackagingRepository,
  ProductPackaging,
} from "../domain/ports/product-packaging.js";
import type {
  ISupplierLinkPort,
  SupplierLinkRequest,
} from "../domain/ports/supplier-link.js";
import type { WorkbookRow } from "../domain/ports/workbook-parser.js";
import type { Product } from "../domain/product.js";
import {
  mapProductBrowserRow,
  missingProductBrowserHeaders,
  type ProductBrowserMappedRow,
  type ProductBrowserRowError,
} from "./map-product-browser-row.js";

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

const IMPORT_BATCH_SIZE = 500;

type PreparedRow = {
  rowNumber: number;
  product: Product;
  packaging: ProductPackaging;
  link: SupplierLinkRequest | null;
  isCreate: boolean;
};

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function buildProduct(
  organizationId: OrganizationId,
  value: ProductBrowserMappedRow,
  existing: Product | null,
): Product {
  return {
    id: existing?.id ?? ProductId.parse(newUuid()),
    organizationId,
    sku: Sku.parse(value.sku),
    name: value.name,
    description: value.description,
    uom: value.uom,
    memberPrice: Money.fromMinorUnits(value.masterPackPriceCents, "USD"),
    listPrice:
      value.listPriceCents === null
        ? null
        : Money.fromMinorUnits(value.listPriceCents, "USD"),
    inactive: value.inactive,
    discontinued: value.discontinued,
    webWholesale: value.webWholesale,
    taxCategoryCode: value.taxCategoryCode,
  };
}

async function loadExistingBySku(
  products: IProductRepository,
  organizationId: OrganizationId,
  skus: readonly Sku[],
): Promise<Map<string, Product>> {
  const merged = new Map<string, Product>();
  for (const batch of chunks(skus, IMPORT_BATCH_SIZE)) {
    const found = await products.findBySkus(organizationId, batch);
    for (const [sku, product] of found) {
      merged.set(sku, product);
    }
  }
  return merged;
}

export class ImportProductBrowserUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly suppliers: ISupplierLinkPort,
    private readonly packaging: IProductPackagingRepository,
  ) {}

  async execute(input: ImportProductBrowserRequest): Promise<ImportProductBrowserResult> {
    if (input.rows.length === 0) {
      return {
        dryRun: input.dryRun,
        rowsOk: 0,
        created: 0,
        updated: 0,
        linked: 0,
        errors: [],
      };
    }

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

    const skus = valid.map(({ value }) => Sku.parse(value.sku));
    const existingBySku = await loadExistingBySku(this.products, input.organizationId, skus);

    const prepared: PreparedRow[] = [];
    for (const { rowNumber, value } of valid) {
      try {
        const existing = existingBySku.get(value.sku) ?? null;
        const product = buildProduct(input.organizationId, value, existing);
        prepared.push({
          rowNumber,
          product,
          packaging: {
            productId: product.id,
            caseQty: value.caseQty,
            caseLength: value.caseLength,
            caseWidth: value.caseWidth,
            caseHeight: value.caseHeight,
          },
          link:
            value.vendorNumber === null || value.vendorName === null
              ? null
              : {
                  organizationId: input.organizationId,
                  staffUserId: input.staffUserId,
                  vendorNumber: value.vendorNumber,
                  vendorName: value.vendorName,
                  sku: value.sku,
                  supplierSku: value.supplierSku,
                  minOrderQty: value.minOrderQty,
                  minOrderAmountCents: value.minOrderAmountCents,
                  lastPoCostCents: value.lastPoCostCents,
                },
          isCreate: existing === null,
        });
      } catch {
        errors.push({
          row: rowNumber,
          field: "product_id",
          message: "Product could not be saved",
        });
      }
    }

    const productSaved = new Set<number>();
    for (const batch of chunks(prepared, IMPORT_BATCH_SIZE)) {
      try {
        await this.products.saveMany(batch.map((row) => row.product));
        for (const row of batch) {
          productSaved.add(row.rowNumber);
        }
      } catch {
        for (const row of batch) {
          try {
            await this.products.save(row.product);
            productSaved.add(row.rowNumber);
          } catch {
            errors.push({
              row: row.rowNumber,
              field: "product_id",
              message: "Product could not be saved",
            });
          }
        }
      }
    }

    let created = 0;
    let updated = 0;
    const packagingSaved = new Set<number>();
    const packagingRows = prepared.filter((row) => productSaved.has(row.rowNumber));
    for (const batch of chunks(packagingRows, IMPORT_BATCH_SIZE)) {
      try {
        await this.packaging.saveMany(batch.map((row) => row.packaging));
        for (const row of batch) {
          packagingSaved.add(row.rowNumber);
          if (row.isCreate) {
            created += 1;
          } else {
            updated += 1;
          }
        }
      } catch {
        for (const row of batch) {
          try {
            await this.packaging.save(row.packaging);
            packagingSaved.add(row.rowNumber);
            if (row.isCreate) {
              created += 1;
            } else {
              updated += 1;
            }
          } catch {
            errors.push({
              row: row.rowNumber,
              field: "product_id",
              message: "Product could not be saved",
            });
          }
        }
      }
    }

    const linkRows = prepared.filter(
      (row) => packagingSaved.has(row.rowNumber) && row.link !== null,
    ) as Array<PreparedRow & { link: SupplierLinkRequest }>;
    const linkResults = await this.suppliers.linkSkus(linkRows.map((row) => row.link));
    let linked = 0;
    for (const [index, row] of linkRows.entries()) {
      const result = linkResults[index];
      if (result?.ok === true) {
        linked += 1;
        continue;
      }
      errors.push({
        row: row.rowNumber,
        field: "vendor",
        message: result?.ok === false ? result.message : "Vendor SKU could not be assigned",
      });
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
