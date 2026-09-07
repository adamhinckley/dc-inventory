import type { ISupplierLinkPort, SupplierLinkRequest, SupplierLinkResult } from "@dc-inventory/catalog";
import {
  CreateSupplierUseCase,
  UpdateSupplierUseCase,
  type ICatalogSkuLookupPort,
  type ISupplierProductRepository,
  type ISupplierRepository,
  type SupplierProduct,
} from "@dc-inventory/purchasing";
import { SupplierProductId } from "@dc-inventory/purchasing";
import { Sku, type SupplierId } from "@dc-inventory/shared-kernel";

const LINK_BATCH_SIZE = 500;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeOptionalInt(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

export class PurchasingSupplierLinkAdapter implements ISupplierLinkPort {
  private readonly createSupplier: CreateSupplierUseCase;
  private readonly updateSupplier: UpdateSupplierUseCase;

  constructor(
    private readonly suppliers: ISupplierRepository,
    private readonly supplierProducts: ISupplierProductRepository,
    private readonly catalog: ICatalogSkuLookupPort,
  ) {
    this.createSupplier = new CreateSupplierUseCase(suppliers);
    this.updateSupplier = new UpdateSupplierUseCase(suppliers);
  }

  async linkSku(input: SupplierLinkRequest): Promise<SupplierLinkResult> {
    const [result] = await this.linkSkus([input]);
    return result ?? { ok: false, message: "Vendor SKU could not be assigned" };
  }

  async linkSkus(inputs: readonly SupplierLinkRequest[]): Promise<readonly SupplierLinkResult[]> {
    if (inputs.length === 0) {
      return [];
    }

    const organizationId = inputs[0]!.organizationId;
    const vendorNumbers = [...new Set(inputs.map((input) => input.vendorNumber))];
    const existingVendors = await this.suppliers.findByVendorNumbers(organizationId, vendorNumbers);
    const vendorToSupplierId = new Map<string, SupplierId>();
    const failedVendors = new Set<string>();
    const failedVendorUpdates = new Set<string>();

    for (const vendorNumber of vendorNumbers) {
      const sample = inputs.find((input) => input.vendorNumber === vendorNumber);
      if (sample === undefined) {
        continue;
      }
      let supplier = existingVendors.get(vendorNumber) ?? null;
      if (supplier === null) {
        const created = await this.createSupplier.execute({
          organizationId,
          staffUserId: sample.staffUserId,
          name: sample.vendorName,
          vendorNumber,
        });
        if (!created.ok) {
          supplier = await this.suppliers.findByVendorNumber(organizationId, vendorNumber);
          if (supplier === null) {
            failedVendors.add(vendorNumber);
            continue;
          }
        } else {
          supplier = created.supplier;
        }
      } else if (supplier.name !== sample.vendorName) {
        const updated = await this.updateSupplier.execute({
          organizationId,
          staffUserId: sample.staffUserId,
          supplierId: supplier.id,
          name: sample.vendorName,
        });
        if (!updated.ok) {
          failedVendorUpdates.add(vendorNumber);
          continue;
        }
      }
      vendorToSupplierId.set(vendorNumber, supplier.id);
    }

    const prefetchPairs: Array<{ supplierId: SupplierId; sku: Sku }> = [];
    for (const input of inputs) {
      if (failedVendors.has(input.vendorNumber) || failedVendorUpdates.has(input.vendorNumber)) {
        continue;
      }
      const supplierId = vendorToSupplierId.get(input.vendorNumber);
      if (supplierId === undefined) {
        continue;
      }
      try {
        prefetchPairs.push({ supplierId, sku: Sku.parse(input.sku) });
      } catch {
        continue;
      }
    }
    const existingProducts = await this.supplierProducts.findBySupplierSkuPairs(prefetchPairs);
    const bySupplierSku = new Map<string, SupplierProduct>();
    for (const product of existingProducts) {
      bySupplierSku.set(`${product.supplierId}:${product.sku.value}`, product);
    }

    const catalogChecked = new Map<string, boolean>();
    const results: SupplierLinkResult[] = [];
    const pending: Array<{ product: SupplierProduct; resultIndex: number }> = [];

    for (const input of inputs) {
      if (failedVendors.has(input.vendorNumber)) {
        results.push({ ok: false, message: "Vendor could not be created" });
        continue;
      }
      if (failedVendorUpdates.has(input.vendorNumber)) {
        results.push({ ok: false, message: "Vendor could not be updated" });
        continue;
      }
      const supplierId = vendorToSupplierId.get(input.vendorNumber);
      if (supplierId === undefined) {
        results.push({ ok: false, message: "Vendor could not be created" });
        continue;
      }
      let sku: Sku;
      try {
        sku = Sku.parse(input.sku);
      } catch {
        results.push({ ok: false, message: "Vendor SKU could not be assigned" });
        continue;
      }
      const catalogKey = sku.value;
      let catalogKnown = catalogChecked.get(catalogKey);
      if (catalogKnown === undefined) {
        const catalogRow = await this.catalog.findBySku(organizationId, sku);
        catalogKnown = catalogRow !== null;
        catalogChecked.set(catalogKey, catalogKnown);
      }
      if (!catalogKnown) {
        results.push({ ok: false, message: "Vendor SKU could not be assigned" });
        continue;
      }
      const key = `${supplierId}:${sku.value}`;
      const existing = bySupplierSku.get(key);
      const product: SupplierProduct = {
        id: existing?.id ?? SupplierProductId.parse(crypto.randomUUID()),
        supplierId,
        sku,
        supplierSku: normalizeOptionalString(input.supplierSku),
        minOrderQty: normalizeOptionalInt(input.minOrderQty),
        minOrderAmountCents: normalizeOptionalInt(input.minOrderAmountCents),
        lastPoCostCents: normalizeOptionalInt(input.lastPoCostCents),
        currency: "USD",
      };
      bySupplierSku.set(key, product);
      results.push({ ok: true });
      pending.push({ product, resultIndex: results.length - 1 });
    }

    for (const batch of chunks(pending, LINK_BATCH_SIZE)) {
      try {
        await this.supplierProducts.saveMany(batch.map((row) => row.product));
      } catch {
        for (const row of batch) {
          try {
            await this.supplierProducts.save(row.product);
          } catch {
            results[row.resultIndex] = { ok: false, message: "Vendor SKU could not be assigned" };
          }
        }
      }
    }

    return results;
  }
}
