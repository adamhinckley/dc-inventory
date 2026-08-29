import { OrganizationId, Sku, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryCatalogSkuLookupPort } from "../src/adapters/in-memory-catalog-sku-lookup.js";
import { InMemorySupplierProductQtyReadPort } from "../src/adapters/in-memory-supplier-product-qty-read.js";
import { InMemorySupplierProductRepository } from "../src/adapters/in-memory-supplier-product-repository.js";
import { InMemorySupplierRepository } from "../src/adapters/in-memory-supplier-repository.js";
import { AssignSupplierProductUseCase } from "../src/application/assign-supplier-product.js";
import { ListSupplierProductsUseCase } from "../src/application/list-supplier-products.js";
import { UnlinkSupplierProductUseCase } from "../src/application/unlink-supplier-product.js";
import { UpdateSupplierProductUseCase } from "../src/application/update-supplier-product.js";
import { CreateSupplierUseCase } from "../src/application/create-supplier.js";
import { SupplierProductId } from "../src/domain/ids.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const DEFAULT_ORG = OrganizationId.DEFAULT;

function harness() {
  const suppliers = new InMemorySupplierRepository();
  const supplierProducts = new InMemorySupplierProductRepository();
  const catalog = new InMemoryCatalogSkuLookupPort();
  const qty = new InMemorySupplierProductQtyReadPort();
  return {
    suppliers,
    supplierProducts,
    catalog,
    qty,
    createSupplier: new CreateSupplierUseCase(suppliers),
    listSupplierProducts: new ListSupplierProductsUseCase(
      suppliers,
      supplierProducts,
      catalog,
      qty,
    ),
    assignSupplierProduct: new AssignSupplierProductUseCase(
      suppliers,
      supplierProducts,
      catalog,
    ),
    updateSupplierProduct: new UpdateSupplierProductUseCase(suppliers, supplierProducts),
    unlinkSupplierProduct: new UnlinkSupplierProductUseCase(suppliers, supplierProducts),
  };
}

describe("Supplier products use cases (in-memory)", () => {
  it("assigns, lists with catalog name and qty hydration, updates, and unlinks", async () => {
    const h = harness();
    const created = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme Supply",
      vendorNumber: "VEND-001",
    });
    if (!created.ok) {
      throw new Error("expected supplier");
    }
    h.catalog.set(DEFAULT_ORG, "WIDGET-1", "Blue Widget");
    h.qty.set(DEFAULT_ORG, "WIDGET-1", {
      onHand: 10,
      onOrder: 5,
      allocated: 2,
      available: 8,
    });

    const assigned = await h.assignSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      sku: "WIDGET-1",
      supplierSku: "ACME-W1",
      minOrderQty: 12,
      lastPoCostCents: 499,
    });
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      return;
    }

    const listed = await h.listSupplierProducts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.total).toBe(1);
    expect(listed.items[0]).toMatchObject({
      id: assigned.product.id,
      sku: "WIDGET-1",
      catalogName: "Blue Widget",
      supplierSku: "ACME-W1",
      minOrderQty: 12,
      lastPoCostCents: 499,
      qty: { onHand: 10, onOrder: 5, allocated: 2, available: 8 },
    });

    const updated = await h.updateSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      productId: assigned.product.id,
      supplierSku: "ACME-W1-NEW",
      lastPoCostCents: 599,
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.product.supplierSku).toBe("ACME-W1-NEW");
      expect(updated.product.lastPoCostCents).toBe(599);
    }

    const unlinked = await h.unlinkSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      productId: assigned.product.id,
    });
    expect(unlinked).toEqual({ ok: true });

    const empty = await h.listSupplierProducts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(empty.ok).toBe(true);
    if (empty.ok) {
      expect(empty.total).toBe(0);
    }
  });

  it("searches and sorts supplier products by declared table fields", async () => {
    const h = harness();
    const created = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme Supply",
      vendorNumber: "VEND-001",
    });
    if (!created.ok) {
      throw new Error("expected supplier");
    }
    h.catalog.set(DEFAULT_ORG, "WIDGET-A", "Alpha Widget");
    h.catalog.set(DEFAULT_ORG, "WIDGET-B", "Beta Widget");
    for (const [sku, supplierSku] of [
      ["WIDGET-A", "VENDOR-A"],
      ["WIDGET-B", "VENDOR-B"],
    ] as const) {
      const assigned = await h.assignSupplierProduct.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        supplierId: created.supplier.id,
        sku,
        supplierSku,
      });
      expect(assigned.ok).toBe(true);
    }

    const sorted = await h.listSupplierProducts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      page: 1,
      pageSize: 25,
      sortBy: "supplierSku",
      sortOrder: "desc",
    });
    expect(sorted.ok).toBe(true);
    if (sorted.ok) {
      expect(sorted.items.map((row) => row.supplierSku)).toEqual([
        "VENDOR-B",
        "VENDOR-A",
      ]);
    }

    const searched = await h.listSupplierProducts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      q: "vendor-a",
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(searched.ok).toBe(true);
    if (searched.ok) {
      expect(searched.items.map((row) => row.sku)).toEqual(["WIDGET-A"]);
    }
  });

  it("rejects unknown SKU on assign", async () => {
    const h = harness();
    const created = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme Supply",
      vendorNumber: "VEND-001",
    });
    if (!created.ok) {
      throw new Error("expected supplier");
    }

    const result = await h.assignSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      sku: "MISSING-SKU",
    });
    expect(result).toEqual({ ok: false, reason: "unknown_sku" });
  });

  it("rejects duplicate supplier+sku on assign", async () => {
    const h = harness();
    const created = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme Supply",
      vendorNumber: "VEND-001",
    });
    if (!created.ok) {
      throw new Error("expected supplier");
    }
    h.catalog.set(DEFAULT_ORG, "WIDGET-1", "Blue Widget");

    const first = await h.assignSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      sku: "WIDGET-1",
    });
    expect(first.ok).toBe(true);

    const duplicate = await h.assignSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      sku: "WIDGET-1",
    });
    expect(duplicate).toEqual({ ok: false, reason: "duplicate_sku" });
  });

  it("allows the same SKU on different suppliers", async () => {
    const h = harness();
    const firstSupplier = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Vendor A",
      vendorNumber: "V-A",
    });
    const secondSupplier = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Vendor B",
      vendorNumber: "V-B",
    });
    if (!firstSupplier.ok || !secondSupplier.ok) {
      throw new Error("expected suppliers");
    }
    h.catalog.set(DEFAULT_ORG, "WIDGET-1", "Blue Widget");

    const onA = await h.assignSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: firstSupplier.supplier.id,
      sku: "WIDGET-1",
    });
    const onB = await h.assignSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: secondSupplier.supplier.id,
      sku: "WIDGET-1",
    });
    expect(onA.ok).toBe(true);
    expect(onB.ok).toBe(true);
  });

  it("uses zero qty when snapshot is missing", async () => {
    const h = harness();
    const created = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme Supply",
      vendorNumber: "VEND-001",
    });
    if (!created.ok) {
      throw new Error("expected supplier");
    }
    h.catalog.set(DEFAULT_ORG, "WIDGET-1", "Blue Widget");
    await h.assignSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      sku: "WIDGET-1",
    });

    const listed = await h.listSupplierProducts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.items[0]?.qty).toEqual({
        onHand: 0,
        onOrder: 0,
        allocated: 0,
        available: 0,
      });
    }
  });

  it("returns not_found for missing supplier or product", async () => {
    const h = harness();
    const missingSupplier = await h.listSupplierProducts.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(missingSupplier).toEqual({ ok: false, reason: "not_found" });

    const created = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme",
      vendorNumber: "V-1",
    });
    if (!created.ok) {
      throw new Error("expected supplier");
    }

    const missingProduct = await h.unlinkSupplierProduct.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      productId: SupplierProductId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    });
    expect(missingProduct).toEqual({ ok: false, reason: "not_found" });
  });
});
