import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryImportLocationPort } from "../src/adapters/in-memory-import-locations.js";
import { InMemoryProductCategoryRepository } from "../src/adapters/in-memory-product-categories.js";
import { InMemoryProductIdentifierRepository } from "../src/adapters/in-memory-product-identifiers.js";
import { InMemoryProductPackagingRepository } from "../src/adapters/in-memory-product-packaging.js";
import { InMemoryProductReorderReadPort } from "../src/adapters/in-memory-product-reorder-read.js";
import { InMemoryProductRepository } from "../src/adapters/in-memory-product-repository.js";
import { InMemorySupplierLinkPort } from "../src/adapters/in-memory-supplier-link.js";
import { ImportProductBrowserUseCase } from "../src/application/import-product-browser.js";
import { GetProductUseCase } from "../src/application/get-product.js";
import { InMemoryQtyReadPort } from "../src/adapters/in-memory-qty-read.js";
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
  const suppliers = new InMemorySupplierLinkPort();
  const packaging = new InMemoryProductPackagingRepository();
  const categories = new InMemoryProductCategoryRepository(products);
  const identifiers = new InMemoryProductIdentifierRepository();
  const locations = new InMemoryImportLocationPort();
  const reorderPolicies = new InMemoryProductReorderReadPort();
  const qty = new InMemoryQtyReadPort();
  const primarySupplier = {
    async findByCatalogSku() {
      return null;
    },
  };
  return {
    products,
    suppliers,
    packaging,
    categories,
    identifiers,
    locations,
    reorderPolicies,
    qty,
    getProduct: new GetProductUseCase(
      products,
      qty,
      packaging,
      categories,
      identifiers,
      primarySupplier,
      reorderPolicies,
    ),
    importCatalog: new ImportProductBrowserUseCase(
      products,
      suppliers,
      packaging,
      categories,
      identifiers,
      locations,
      reorderPolicies,
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
        productRow({
          product_id: "DC-A",
          item: "Ornament A",
          cs_len: "23.6",
          cs_wid: "15.7",
          cs_ht: "19.7",
        }),
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
      packLength: null,
      packWidth: null,
      packHeight: null,
      packWeight: null,
      packWeightUom: null,
      innerPackQty: null,
      innerPackLength: null,
      innerPackWidth: null,
      innerPackHeight: null,
      innerPackWeight: null,
      innerPackWeightUom: null,
      caseQty: 192,
      caseLength: "23.6",
      caseWidth: "15.7",
      caseHeight: "19.7",
      caseWeight: null,
      caseWeightUom: null,
    });
    expect(await h.packaging.findByProductId(bySku.get("DC-C")!)).toEqual({
      productId: bySku.get("DC-C"),
      packLength: null,
      packWidth: null,
      packHeight: null,
      packWeight: null,
      packWeightUom: null,
      innerPackQty: null,
      innerPackLength: null,
      innerPackWidth: null,
      innerPackHeight: null,
      innerPackWeight: null,
      innerPackWeightUom: null,
      caseQty: 384,
      caseLength: null,
      caseWidth: null,
      caseHeight: null,
      caseWeight: null,
      caseWeightUom: null,
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
      caseLength: null,
      caseWidth: null,
      caseHeight: null,
    });
  });

  it("imports country of origin, default order qty, UPC, and original wholesale price", async () => {
    const h = harness();
    await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [
        productRow({
          c_of_o: "USA",
          def_qty: "12",
          upcode: "743903067861",
          original_wholesale_price: "8.8",
          ip_qty: "6",
          location: "XJB",
          pickbin: "TRUE",
        }),
      ],
    });
    const listed = await h.products.listMatching({ organizationId: ORG });
    const productId = listed[0]!.product.id;
    const savedIdentifiers = await h.identifiers.findByProductId(productId);
    expect(listed[0]?.product.countryOfOrigin).toBe("USA");
    expect(listed[0]?.product.defaultOrderQty).toBe(12);
    expect(listed[0]?.product.originalWholesalePrice?.amountMinor).toBe(880);
    expect(await h.packaging.findByProductId(productId)).toMatchObject({
      innerPackQty: 6,
    });
    expect(savedIdentifiers.find((row) => row.kind === "upc")?.code).toBe("743903067861");
    expect(savedIdentifiers.find((row) => row.kind === "mfg")?.code).toBe("JA149015");
    expect(h.locations.locations.get(`${ORG}:XJB`)).toEqual({ code: "XJB", isPickBin: true });
  });

  it("treats a header-only workbook as zero rows, not missing headers", async () => {
    const h = harness();
    const result = await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: true,
      rows: [],
    });

    expect(result.dryRun).toBe(true);
    expect(result.rowsOk).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("records a row error when packaging save throws instead of rejecting the import", async () => {
    const products = new InMemoryProductRepository();
    const packaging = {
      async findByProductId() {
        return null;
      },
      async save() {
        throw new Error("packaging write failed");
      },
      async saveMany() {
        throw new Error("packaging write failed");
      },
    };
    const importCatalog = new ImportProductBrowserUseCase(
      products,
      new InMemorySupplierLinkPort(),
      packaging,
      new InMemoryProductCategoryRepository(products),
      new InMemoryProductIdentifierRepository(),
      new InMemoryImportLocationPort(),
      new InMemoryProductReorderReadPort(),
    );

    const result = await importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [productRow()],
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.errors).toEqual([
      { row: 2, field: "product_id", message: "Product could not be saved" },
    ]);
    expect(await products.listMatching({ organizationId: ORG })).toHaveLength(1);
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

  it("imports category tags from category_1 through category_10", async () => {
    const h = harness();
    await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [
        productRow({
          product_id: "DC-A",
          category_1: "Shopify",
          category_2: "Christmas-Ville",
          category_3: "",
          category_4: "Shopify",
        }),
        productRow({
          product_id: "DC-B",
          category_1: "Hardware",
        }),
      ],
    });

    const shopify = await h.products.listMatching({
      organizationId: ORG,
      category: ["Shopify"],
    });
    expect(shopify.map((row) => row.product.sku.value)).toEqual(["DC-A"]);

    const hardware = await h.products.listMatching({
      organizationId: ORG,
      category: ["Hardware"],
    });
    expect(hardware.map((row) => row.product.sku.value)).toEqual(["DC-B"]);

    expect(await h.products.listCategoryNames(ORG)).toEqual([
      "Christmas-Ville",
      "Hardware",
      "Shopify",
    ]);

    const dcA = shopify[0]?.product;
    expect(dcA).toBeDefined();
    if (dcA !== undefined) {
      expect(await h.categories.listNamesForProduct(ORG, dcA.id)).toEqual([
        "Shopify",
        "Christmas-Ville",
      ]);
    }
  });

  it("round-trips onhand_min_qty and onhand_max_qty through GET product", async () => {
    const h = harness();
    await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [productRow({ onhand_min_qty: "12", onhand_max_qty: "96" })],
    });

    const listed = await h.products.listMatching({ organizationId: ORG });
    const product = listed[0]?.product;
    expect(product).toBeDefined();
    if (product === undefined) {
      return;
    }

    const result = await h.getProduct.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      productId: product.id,
    });
    expect(result).toMatchObject({
      ok: true,
      reorderMin: 12,
      reorderMax: 96,
    });
  });

  it("does not replace categories or identifiers for more than 500 products at once", async () => {
    const products = new InMemoryProductRepository();
    const categoryBatchSizes: number[] = [];
    const identifierBatchSizes: number[] = [];
    const categories = {
      async listNamesForProduct() {
        return [];
      },
      async replaceForProducts(
        _organizationId: typeof ORG,
        assignments: readonly { productId: string; categoryNames: readonly string[] }[],
      ) {
        categoryBatchSizes.push(assignments.length);
      },
    };
    const identifiers = {
      async findByProductId() {
        return [];
      },
      async replaceForProducts(
        assignments: readonly { productId: string; identifiers: readonly unknown[] }[],
      ) {
        identifierBatchSizes.push(assignments.length);
      },
    };
    const importCatalog = new ImportProductBrowserUseCase(
      products,
      new InMemorySupplierLinkPort(),
      new InMemoryProductPackagingRepository(),
      categories,
      identifiers,
      new InMemoryImportLocationPort(),
      new InMemoryProductReorderReadPort(),
    );

    const rows = Array.from({ length: 501 }, (_, index) =>
      productRow({
        product_id: `DC-${String(index + 1).padStart(4, "0")}`,
        item: `Ornament ${String(index + 1)}`,
        category_1: "Hardware",
        upcode: String(743903000000 + index),
      }),
    );

    const result = await importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows,
    });

    expect(result.created).toBe(501);
    expect(result.errors).toHaveLength(0);
    expect(Math.max(...categoryBatchSizes)).toBeLessThanOrEqual(500);
    expect(Math.max(...identifierBatchSizes)).toBeLessThanOrEqual(500);
    expect(categoryBatchSizes.reduce((sum, size) => sum + size, 0)).toBe(501);
    expect(identifierBatchSizes.reduce((sum, size) => sum + size, 0)).toBe(501);
  });

  it("replaces category tags when a SKU is reimported", async () => {
    const h = harness();
    await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [productRow({ category_1: "Old Tag" })],
    });
    await h.importCatalog.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      dryRun: false,
      rows: [productRow({ category_1: "New Tag" })],
    });

    expect(
      await h.products.listMatching({ organizationId: ORG, category: ["Old Tag"] }),
    ).toHaveLength(0);
    expect(
      await h.products.listMatching({ organizationId: ORG, category: ["New Tag"] }),
    ).toHaveLength(1);
  });
});
