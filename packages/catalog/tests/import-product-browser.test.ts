import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryProductPackagingRepository } from "../src/adapters/in-memory-product-packaging.js";
import { InMemoryProductRepository } from "../src/adapters/in-memory-product-repository.js";
import { InMemoryQtyReadPort } from "../src/adapters/in-memory-qty-read.js";
import { InMemorySupplierLinkPort } from "../src/adapters/in-memory-supplier-link.js";
import { CreateProductUseCase } from "../src/application/create-product.js";
import { ImportProductBrowserUseCase } from "../src/application/import-product-browser.js";
import { UpdateProductUseCase } from "../src/application/update-product.js";
import type { WorkbookRow } from "../src/domain/ports/workbook-parser.js";

const ORG = OrganizationId.DEFAULT;
const STAFF = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");

function productRow(overrides: Record<string, string> = {}): WorkbookRow {
  return {
    product_id: "DC10274LTGD",
    item: "Crystal Drop Branch",
    detail: "Light gold",
    item2: "",
    mp_price: "10.2",
    uom: "",
    inactive: "FALSE",
    discontin: "FALSE",
    webwholesale: "TRUE",
    vendor_num: "1075",
    vendor: "REGXJ",
    mfg_code: "JA149015",
    vendor_min_order: "0",
    min_order_amt: "0",
    po_cost: "3.57",
    cs_qty: "192",
    onhand_qty: "12",
    ...overrides,
  };
}

function harness() {
  const products = new InMemoryProductRepository();
  const qty = new InMemoryQtyReadPort();
  const suppliers = new InMemorySupplierLinkPort();
  const packaging = new InMemoryProductPackagingRepository();
  return {
    products,
    suppliers,
    packaging,
    importCatalog: new ImportProductBrowserUseCase(
      products,
      new CreateProductUseCase(products),
      new UpdateProductUseCase(products, qty),
      suppliers,
      packaging,
    ),
  };
}

describe("ImportProductBrowserUseCase", () => {
  it("dry-run reports valid rows and SKU errors without writing", async () => {
    const h = harness();
    const result = await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: true,
      rows: [
        productRow(),
        productRow({ product_id: "CANCELLATION~~FEE", item: "", vendor_num: "", vendor: "" }),
      ],
    });

    expect(result.dryRun).toBe(true);
    expect(result.rowsOk).toBe(1);
    expect(result.created).toBe(0);
    expect(result.errors.some((error) => error.field === "product_id")).toBe(true);
    expect(await h.products.listMatching({ organizationId: ORG })).toHaveLength(0);
    expect(h.suppliers.links).toHaveLength(0);
  });

  it("commit creates products and vendors, linking every SKU for a vendor", async () => {
    const h = harness();
    const result = await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [
        productRow({ product_id: "DC-A", item: "Ornament A" }),
        productRow({ product_id: "DC-B", item: "Ornament B" }),
        productRow({
          product_id: "DC-C",
          item: "Ribbon C",
          vendor_num: "1076",
          vendor: "REGYT",
          cs_qty: "384",
        }),
      ],
    });

    expect(result.created).toBe(3);
    expect(result.linked).toBe(3);
    expect(result.errors).toHaveLength(0);

    const listed = await h.products.listMatching({ organizationId: ORG });
    expect(listed.map((row) => row.product.sku.value).sort()).toEqual(["DC-A", "DC-B", "DC-C"]);
    expect(listed[0]?.product.uom).toBe("EA");

    const vendors = h.suppliers.suppliersFor(ORG).map((row) => row.vendorNumber).sort();
    expect(vendors).toEqual(["1075", "1076"]);
    expect(h.suppliers.links.filter((row) => row.vendorNumber === "1075").map((row) => row.sku).sort()).toEqual([
      "DC-A",
      "DC-B",
    ]);
    expect(h.suppliers.links.filter((row) => row.vendorNumber === "1076").map((row) => row.sku)).toEqual(["DC-C"]);

    const bySku = new Map(listed.map((row) => [row.product.sku.value, row.product.id]));
    expect(await h.packaging.findByProductId(bySku.get("DC-A")!)).toEqual({
      productId: bySku.get("DC-A"),
      caseQty: 192,
    });
    expect(await h.packaging.findByProductId(bySku.get("DC-C")!)).toEqual({
      productId: bySku.get("DC-C"),
      caseQty: 384,
    });
  });

  it("commit updates an existing SKU instead of duplicating it", async () => {
    const h = harness();
    await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [productRow({ item: "Old name" })],
    });
    const second = await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [productRow({ item: "New name", mp_price: "11.5" })],
    });

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    const listed = await h.products.listMatching({ organizationId: ORG });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.product.name).toBe("New name");
    expect(listed[0]?.product.memberPrice.amountMinor).toBe(1150);
    expect(await h.packaging.findByProductId(listed[0]!.product.id)).toMatchObject({
      caseQty: 192,
    });
  });

  it("treats a header-only workbook as zero rows, not missing headers", async () => {
    const h = harness();
    const result = await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: true,
      rows: [],
    });

    expect(result).toEqual({
      dryRun: true,
      rowsOk: 0,
      created: 0,
      updated: 0,
      linked: 0,
      errors: [],
    });
  });

  it("does not write qty fields from the dump", async () => {
    const h = harness();
    await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [productRow({ onhand_qty: "999", on_order_qty: "12" })],
    });
    const listed = await h.products.listMatching({ organizationId: ORG });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.product).not.toHaveProperty("onHand");
  });
});
