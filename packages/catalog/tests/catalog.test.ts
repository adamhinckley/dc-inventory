import {
  CustomerId,
  OrganizationId,
  ProductId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryProductPackagingRepository } from "../src/adapters/in-memory-product-packaging.js";
import { InMemoryProductCategoryRepository } from "../src/adapters/in-memory-product-categories.js";
import { InMemoryProductIdentifierRepository } from "../src/adapters/in-memory-product-identifiers.js";
import { InMemoryProductPrimarySupplierReadPort } from "../src/adapters/in-memory-product-primary-supplier-read.js";
import { InMemoryProductReorderReadPort } from "../src/adapters/in-memory-product-reorder-read.js";
import { InMemoryProductRepository } from "../src/adapters/in-memory-product-repository.js";
import { InMemoryQtyReadPort } from "../src/adapters/in-memory-qty-read.js";
import { InMemoryCatalogCsvWriter } from "../src/adapters/in-memory-catalog-csv-writer.js";
import { InMemoryCatalogListQuery } from "../src/adapters/in-memory-catalog-list-query.js";
import { CreateProductUseCase } from "../src/application/create-product.js";
import { ExportStaffProductsCsvUseCase } from "../src/application/export-staff-products-csv.js";
import { GetProductUseCase } from "../src/application/get-product.js";
import { GetWholesaleProductUseCase } from "../src/application/get-wholesale-product.js";
import { ListStaffProductsUseCase } from "../src/application/list-staff-products.js";
import { ListWholesaleCatalogUseCase } from "../src/application/list-wholesale-catalog.js";
import { UpdateProductUseCase } from "../src/application/update-product.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const OTHER_STAFF = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440020");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

function harness() {
  const products = new InMemoryProductRepository();
  const qty = new InMemoryQtyReadPort();
  const packaging = new InMemoryProductPackagingRepository();
  const categories = new InMemoryProductCategoryRepository(products);
  const identifiers = new InMemoryProductIdentifierRepository();
  const primarySupplier = new InMemoryProductPrimarySupplierReadPort();
  const reorder = new InMemoryProductReorderReadPort();
    const catalogList = new InMemoryCatalogListQuery(products, qty, packaging);
  return {
    products,
    qty,
    categories,
    identifiers,
    primarySupplier,
    reorder,
    create: new CreateProductUseCase(products),
    update: new UpdateProductUseCase(products, qty, packaging, categories, identifiers, primarySupplier, reorder),
    get: new GetProductUseCase(products, qty, packaging, categories, identifiers, primarySupplier, reorder),
    getWholesale: new GetWholesaleProductUseCase(products, qty),
    listStaff: new ListStaffProductsUseCase(catalogList),
    listWholesale: new ListWholesaleCatalogUseCase(catalogList),
    exportStaffCsv: new ExportStaffProductsCsvUseCase(
      catalogList,
      new InMemoryCatalogCsvWriter(),
    ),
  };
}

async function createProduct(
  h: ReturnType<typeof harness>,
  overrides: Partial<{
    sku: string;
    name: string;
    uom: string;
    memberPriceCents: number;
    listPriceCents?: number | null;
    inactive: boolean;
    discontinued: boolean;
    webWholesale: boolean;
  }> = {},
) {
  const created = await h.create.execute({
    organizationId: DEFAULT_ORG,
    staffUserId: STAFF_ID,
    sku: overrides.sku ?? "HEX-BOLT-GALV",
    name: overrides.name ?? "Galvanized hex bolt",
    uom: overrides.uom ?? "EA",
    memberPriceCents: overrides.memberPriceCents ?? 12_000,
    listPriceCents: overrides.listPriceCents ?? 1250,
    currency: "USD",
    inactive: overrides.inactive ?? false,
    discontinued: overrides.discontinued ?? false,
    webWholesale: overrides.webWholesale ?? true,
  });
  if (!created.ok) {
    throw new Error(`expected create, got ${created.reason}`);
  }
  return created.product;
}

describe("Catalog use cases (in-memory)", () => {
  it("includes shop-hidden products on the staff list", async () => {
    const h = harness();
    await createProduct(h, { sku: "HEX-BOLT-GALV", name: "Visible bolt", webWholesale: true });
    await createProduct(h, {
      sku: "INTERNAL-ONLY",
      name: "Hidden washer",
      webWholesale: false,
      inactive: true,
    });

    const listed = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: OTHER_STAFF,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(listed.total).toBe(2);
    expect(listed.items.map((row) => row.product.sku.value)).toEqual([
      "HEX-BOLT-GALV",
      "INTERNAL-ONLY",
    ]);
    expect(listed.items[1]?.product.inactive).toBe(true);
    expect(listed.items[1]?.product.webWholesale).toBe(false);
  });

  it("includes caseQty on the staff list", async () => {
    const h = harness();
    const product = await createProduct(h, { sku: "HEX-BOLT-GALV" });
    const updated = await h.update.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      productId: product.id,
      caseQty: 192,
    });
    expect(updated.ok).toBe(true);

    const listed = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: OTHER_STAFF,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(listed.items[0]?.caseQty).toBe(192);
  });

  it("sorts the staff list by caseQty", async () => {
    const h = harness();
    const small = await createProduct(h, { sku: "SMALL", name: "Small case" });
    const large = await createProduct(h, { sku: "LARGE", name: "Large case" });
    await h.update.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      productId: small.id,
      caseQty: 12,
    });
    await h.update.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      productId: large.id,
      caseQty: 192,
    });

    const listed = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: OTHER_STAFF,
      page: 1,
      pageSize: 25,
      sortBy: "caseQty",
      sortOrder: "desc",
    });
    expect(listed.items.map((row) => row.product.sku.value)).toEqual(["LARGE", "SMALL"]);
  });

  it("exports staff products as CSV using the same list filters", async () => {
    const h = harness();
    await createProduct(h, {
      sku: "ALPHA",
      name: 'Bolt, "hex"',
      listPriceCents: 1250,
      memberPriceCents: 12_000,
    });
    await createProduct(h, { sku: "BETA", name: "Washer" });

    const exported = await h.exportStaffCsv.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: OTHER_STAFF,
      q: "ALPHA",
      sortBy: "sku",
      sortOrder: "asc",
    });

    const csv = new TextDecoder().decode(exported.file.bytes);
    expect(exported.file.filename).toBe("products.csv");
    expect(exported.file.contentType).toBe("text/csv; charset=utf-8");
    expect(exported.rowCount).toBe(1);
    expect(exported.truncated).toBe(false);
    expect(csv).toContain("SKU,Name,List price,Unit cost");
    expect(csv).toContain("ALPHA");
    expect(csv).toContain('"Bolt, ""hex"""');
    expect(csv).toContain("1250");
    expect(csv).not.toContain("BETA");
  });

  it("applies shop visibility filters on the wholesale list", async () => {
    const h = harness();
    await createProduct(h, { sku: "SHOP-OK", name: "Shop bolt", webWholesale: true });
    await createProduct(h, {
      sku: "HIDDEN-FLAG",
      name: "Not on shop",
      webWholesale: false,
    });
    await createProduct(h, {
      sku: "INACTIVE",
      name: "Inactive bolt",
      webWholesale: true,
      inactive: true,
    });
    await createProduct(h, {
      sku: "DISCONTINUED",
      name: "Discontinued bolt",
      webWholesale: true,
      discontinued: true,
    });

    const listed = await h.listWholesale.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
      availableOnly: false,
    });
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.product.sku.value).toBe("SHOP-OK");
    expect(listed.items[0]?.product.listPrice?.amountMinor).toBe(1250);
  });

  it("defaults the wholesale list to sellable products only", async () => {
    const h = harness();
    const stocked = await createProduct(h, {
      sku: "SHOP-STOCKED",
      name: "Shop stocked",
    });
    const openEmpty = await createProduct(h, {
      sku: "SHOP-OPEN-EMPTY",
      name: "Shop open empty",
    });
    const onFactoryPo = await createProduct(h, {
      sku: "SHOP-ON-PO",
      name: "Shop on factory PO",
    });
    const lockedLeftoverOnly = await createProduct(h, {
      sku: "SHOP-LOCKED-LEFTOVER",
      name: "Shop locked leftover only",
    });
    const soldOut = await createProduct(h, {
      sku: "SHOP-SOLD-OUT",
      name: "Shop sold out",
    });
    h.qty.set(DEFAULT_ORG, stocked.sku.value, {
      onHand: 4,
      onOrder: 0,
      allocated: 0,
      available: 4,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    h.qty.set(DEFAULT_ORG, openEmpty.sku.value, {
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      available: 0,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    h.qty.set(DEFAULT_ORG, onFactoryPo.sku.value, {
      onHand: 0,
      onOrder: 100,
      allocated: 0,
      available: 0,
      committed: 0,
      sellState: "locked",
      availableToSell: 100,
    });
    h.qty.set(DEFAULT_ORG, lockedLeftoverOnly.sku.value, {
      onHand: 5,
      onOrder: 100,
      allocated: 0,
      available: 5,
      committed: 100,
      sellState: "locked",
      availableToSell: 0,
    });
    h.qty.set(DEFAULT_ORG, soldOut.sku.value, {
      onHand: 0,
      onOrder: 100,
      allocated: 0,
      available: 0,
      committed: 100,
      sellState: "locked",
      availableToSell: 0,
    });

    const listed = await h.listWholesale.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(listed.total).toBe(3);
    expect(listed.items.map((row) => row.product.sku.value).sort()).toEqual([
      "SHOP-ON-PO",
      "SHOP-OPEN-EMPTY",
      "SHOP-STOCKED",
    ]);
    expect(
      listed.items.some((row) => row.product.sku.value === lockedLeftoverOnly.sku.value),
    ).toBe(false);
  });

  it("constrains the wholesale list to products in the requested category", async () => {
    const h = harness();
    const bolt = await createProduct(h, {
      sku: "SHOP-BOLT",
      name: "Shop bolt",
    });
    const ribbon = await createProduct(h, {
      sku: "SHOP-RIBBON",
      name: "Shop ribbon",
    });
    h.products.setCategories(bolt.id, ["Hardware", "Fasteners"]);
    h.products.setCategories(ribbon.id, ["Textiles"]);
    h.qty.set(DEFAULT_ORG, bolt.sku.value, {
      onHand: 3,
      onOrder: 0,
      allocated: 0,
      available: 3,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });

    const listed = await h.listWholesale.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      category: "Hardware",
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(listed.total).toBe(1);
    expect(listed.items[0]?.product.sku.value).toBe("SHOP-BOLT");
  });

  it("constrains the staff list to products in the requested category", async () => {
    const h = harness();
    const bolt = await createProduct(h, { sku: "STAFF-BOLT", name: "Staff bolt" });
    const ribbon = await createProduct(h, { sku: "STAFF-RIBBON", name: "Staff ribbon" });
    h.products.setCategories(bolt.id, ["Hardware"]);
    h.products.setCategories(ribbon.id, ["Textiles"]);

    const listed = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      category: ["Hardware"],
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });

    expect(listed.total).toBe(1);
    expect(listed.items[0]?.product.sku.value).toBe("STAFF-BOLT");
  });

  it("constrains the staff list to products in any of the requested categories", async () => {
    const h = harness();
    const bolt = await createProduct(h, { sku: "STAFF-BOLT", name: "Staff bolt" });
    const ribbon = await createProduct(h, { sku: "STAFF-RIBBON", name: "Staff ribbon" });
    const wreath = await createProduct(h, { sku: "STAFF-WREATH", name: "Staff wreath" });
    h.products.setCategories(bolt.id, ["Hardware"]);
    h.products.setCategories(ribbon.id, ["Textiles"]);
    h.products.setCategories(wreath.id, ["Seasonal"]);

    const listed = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      category: ["Hardware", "Textiles"],
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });

    expect(listed.items.map((row) => row.product.sku.value)).toEqual([
      "STAFF-BOLT",
      "STAFF-RIBBON",
    ]);
  });

  it("constrains the staff list to products linked to the requested factory", async () => {
    const h = harness();
    const acme = await createProduct(h, { sku: "ACME-BOLT", name: "Acme bolt" });
    const other = await createProduct(h, { sku: "OTHER-BOLT", name: "Other bolt" });
    const factoryId = "550e8400-e29b-41d4-a716-446655440030";
    h.products.setSupplierIds(acme.id, [factoryId]);
    h.products.setSupplierIds(other.id, ["550e8400-e29b-41d4-a716-446655440031"]);

    const listed = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: [factoryId],
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });

    expect(listed.total).toBe(1);
    expect(listed.items[0]?.product.sku.value).toBe("ACME-BOLT");
  });

  it("combines category include with primary-supplier exclude filters", async () => {
    const h = harness();
    const factoryA = "550e8400-e29b-41d4-a716-446655440030";
    const factoryB = "550e8400-e29b-41d4-a716-446655440031";
    const bolt = await createProduct(h, { sku: "COMBO-BOLT", name: "Combo bolt" });
    const nail = await createProduct(h, { sku: "COMBO-NAIL", name: "Combo nail" });
    const ribbon = await createProduct(h, { sku: "COMBO-RIBBON", name: "Combo ribbon" });
    const wreath = await createProduct(h, { sku: "COMBO-WREATH", name: "Combo wreath" });
    h.products.setCategories(bolt.id, ["Hardware"]);
    h.products.setCategories(nail.id, ["Hardware"]);
    h.products.setCategories(ribbon.id, ["Hardware"]);
    h.products.setCategories(wreath.id, ["Textiles"]);
    h.products.setSupplierIds(bolt.id, [factoryA, factoryB]);
    h.products.setPrimarySupplierId(bolt.id, factoryA);
    h.products.setSupplierIds(ribbon.id, [factoryB]);
    h.products.setPrimarySupplierId(ribbon.id, factoryB);
    h.products.setSupplierIds(wreath.id, [factoryA]);
    h.products.setPrimarySupplierId(wreath.id, factoryA);

    const byCategoryAndExclude = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      category: ["Hardware"],
      excludeSupplierId: [factoryA],
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(byCategoryAndExclude.items.map((row) => row.product.sku.value)).toEqual([
      "COMBO-NAIL",
      "COMBO-RIBBON",
    ]);

    const byIncludeAndExclude = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      category: ["Hardware"],
      supplierId: [factoryB],
      excludeSupplierId: [factoryA],
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(byIncludeAndExclude.items.map((row) => row.product.sku.value)).toEqual([
      "COMBO-RIBBON",
    ]);
  });

  it("treats missing qty snapshots as zero", async () => {
    const h = harness();
    const product = await createProduct(h);
    const listed = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(listed.items[0]?.qty).toEqual({
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      available: 0,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });

    h.qty.set(DEFAULT_ORG, product.sku.value, {
      onHand: 10,
      onOrder: 4,
      allocated: 3,
      available: 7,
      committed: 2,
      sellState: "locked",
      availableToSell: 12,
    });
    const withSnapshot = await h.get.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      productId: product.id,
    });
    expect(withSnapshot).toMatchObject({
      ok: true,
      product,
      qty: {
        onHand: 10,
        onOrder: 4,
        allocated: 3,
        available: 7,
        committed: 2,
        sellState: "locked",
        availableToSell: 12,
      },
      packaging: null,
      categoryNames: [],
      upc: null,
      mfgCode: null,
      altCodes: [],
      primarySupplier: null,
      reorderMin: null,
      reorderMax: null,
    });
  });

  it("falls back to vendor SKU when MFG identifier is missing", async () => {
    const h = harness();
    const product = await createProduct(h, { sku: "VENDOR-MFG-SKU", name: "Vendor MFG" });
    h.primarySupplier.bySku.set(product.sku.value, {
      vendorNumber: "1075",
      vendorName: "REGXJ",
      supplierSku: "JA149015",
      minOrderQty: null,
      minOrderAmountCents: null,
      lastPoCostCents: null,
    });
    const result = await h.get.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      productId: product.id,
    });
    expect(result).toMatchObject({
      ok: true,
      mfgCode: "JA149015",
    });
  });

  it("sorts the staff list by onHand from qty snapshots", async () => {
    const h = harness();
    const low = await createProduct(h, { sku: "LOW-ON-HAND", name: "Low" });
    const high = await createProduct(h, { sku: "HIGH-ON-HAND", name: "High" });
    h.qty.set(DEFAULT_ORG, low.sku.value, {
      onHand: 2,
      onOrder: 0,
      allocated: 0,
      available: 2,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    h.qty.set(DEFAULT_ORG, high.sku.value, {
      onHand: 40,
      onOrder: 0,
      allocated: 0,
      available: 40,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });

    const listed = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "onHand",
      sortOrder: "desc",
    });
    expect(listed.items.map((row) => row.product.sku.value)).toEqual([
      "HIGH-ON-HAND",
      "LOW-ON-HAND",
    ]);
  });

  it("sorts the staff list by availableToSell and sellState from qty snapshots", async () => {
    const h = harness();
    const openSku = await createProduct(h, { sku: "OPEN-SKU", name: "Open" });
    const lockedLow = await createProduct(h, { sku: "LOCKED-LOW", name: "Locked low" });
    const lockedHigh = await createProduct(h, { sku: "LOCKED-HIGH", name: "Locked high" });
    h.qty.set(DEFAULT_ORG, openSku.sku.value, {
      onHand: 10,
      onOrder: 0,
      allocated: 0,
      available: 10,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    h.qty.set(DEFAULT_ORG, lockedLow.sku.value, {
      onHand: 5,
      onOrder: 2,
      allocated: 0,
      available: 5,
      committed: 4,
      sellState: "locked",
      availableToSell: 3,
    });
    h.qty.set(DEFAULT_ORG, lockedHigh.sku.value, {
      onHand: 20,
      onOrder: 5,
      allocated: 0,
      available: 20,
      committed: 2,
      sellState: "locked",
      availableToSell: 23,
    });

    const byAvailableToSell = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "availableToSell",
      sortOrder: "desc",
    });
    expect(byAvailableToSell.items.map((row) => row.qty.availableToSell)).toEqual([null, 23, 3]);
    expect(byAvailableToSell.items.map((row) => row.product.sku.value)).toEqual([
      "OPEN-SKU",
      "LOCKED-HIGH",
      "LOCKED-LOW",
    ]);

    const bySellState = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "sellState",
      sortOrder: "asc",
    });
    expect(bySellState.items.map((row) => row.qty.sellState)).toEqual(["open", "locked", "locked"]);
    expect(bySellState.items[0]?.product.sku.value).toBe("OPEN-SKU");
  });

  it("can hide catalog rows whose inventory snapshot is all zero", async () => {
    const h = harness();
    const stocked = await createProduct(h, { sku: "STOCKED", name: "Stocked" });
    const empty = await createProduct(h, { sku: "EMPTY", name: "Empty" });
    h.qty.set(DEFAULT_ORG, stocked.sku.value, {
      onHand: 3,
      onOrder: 0,
      allocated: 0,
      available: 3,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    h.qty.set(DEFAULT_ORG, empty.sku.value, {
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      available: 0,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });

    const filtered = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
      hideZeroInventory: true,
    });
    expect(filtered.items.map((row) => row.product.sku.value)).toEqual(["STOCKED"]);
    expect(filtered.total).toBe(1);
  });

  it("constrains the staff list to the requested effective sell state", async () => {
    const h = harness();
    const openSku = await createProduct(h, { sku: "OPEN-SKU", name: "Open" });
    const lockedSku = await createProduct(h, { sku: "LOCKED-SKU", name: "Locked" });
    await createProduct(h, { sku: "UNTOUCHED-SKU", name: "Untouched" });
    h.qty.set(DEFAULT_ORG, openSku.sku.value, {
      onHand: 10,
      onOrder: 0,
      allocated: 0,
      available: 10,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    h.qty.set(DEFAULT_ORG, lockedSku.sku.value, {
      onHand: 4,
      onOrder: 2,
      allocated: 0,
      available: 4,
      committed: 1,
      sellState: "locked",
      availableToSell: 5,
    });

    const openOnly = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
      sellState: "open",
    });
    expect(openOnly.items.map((row) => row.product.sku.value)).toEqual([
      "OPEN-SKU",
      "UNTOUCHED-SKU",
    ]);

    const lockedOnly = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
      sellState: "locked",
    });
    expect(lockedOnly.items.map((row) => row.product.sku.value)).toEqual(["LOCKED-SKU"]);
    expect(lockedOnly.total).toBe(1);

    const exported = await h.exportStaffCsv.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      sortBy: "sku",
      sortOrder: "asc",
      sellState: "locked",
    });
    const csv = new TextDecoder().decode(exported.file.bytes);
    expect(csv).toContain("LOCKED-SKU");
    expect(csv).not.toContain("OPEN-SKU");
    expect(csv).not.toContain("UNTOUCHED-SKU");
  });

  it("includes createdAt on each staff list row", async () => {
    const h = harness();
    const product = await createProduct(h);
    const listed = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(listed.items[0]?.product.id).toBe(product.id);
    expect(listed.items[0]?.createdAt).toBeInstanceOf(Date);
  });

  it("rejects qty on create and update", async () => {
    const h = harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      sku: "HEX-BOLT-GALV",
      name: "Galvanized hex bolt",
      uom: "EA",
      memberPriceCents: 1250,
      available: 99,
    } as Parameters<CreateProductUseCase["execute"]>[0] & { available: number });
    expect(created).toEqual({ ok: false, reason: "qty_not_allowed" });

    const product = await createProduct(h);
    const updated = await h.update.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      productId: product.id,
      name: "Renamed",
      onHand: 5,
    } as Parameters<UpdateProductUseCase["execute"]>[0] & { onHand: number });
    expect(updated).toEqual({ ok: false, reason: "qty_not_allowed" });
  });

  it("keeps sku immutable on update", async () => {
    const h = harness();
    const product = await createProduct(h);
    const updated = await h.update.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      productId: product.id,
      sku: "NEW-SKU",
      name: "Renamed",
    } as Parameters<UpdateProductUseCase["execute"]>[0] & { sku: string });
    expect(updated).toEqual({ ok: false, reason: "sku_immutable" });

    const ok = await h.update.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      productId: product.id,
      name: "Renamed bolt",
      inactive: true,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) {
      return;
    }
    expect(ok.product.sku.value).toBe("HEX-BOLT-GALV");
    expect(ok.product.name).toBe("Renamed bolt");
    expect(ok.product.inactive).toBe(true);
  });

  it("saves caseQty by sku and returns it on get", async () => {
    const h = harness();
    const product = await createProduct(h, { sku: "DCB7925BK" });
    const updated = await h.update.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      sku: "DCB7925BK",
      caseQty: 240,
    });
    expect(updated).toMatchObject({ ok: true, packaging: { caseQty: 240 } });
    const loaded = await h.get.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      sku: "DCB7925BK",
    });
    expect(loaded).toMatchObject({
      ok: true,
      product: { id: product.id },
      packaging: { caseQty: 240 },
    });
  });

  it("returns not_found for a hidden or missing wholesale product", async () => {
    const h = harness();
    const hidden = await createProduct(h, {
      sku: "HIDDEN",
      webWholesale: false,
    });
    const missing = await h.getWholesale.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      productId: ProductId.parse("550e8400-e29b-41d4-a716-446655440099"),
    });
    expect(missing).toEqual({ ok: false, reason: "not_found" });
    const hiddenResult = await h.getWholesale.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      productId: hidden.id,
    });
    expect(hiddenResult).toEqual({ ok: false, reason: "not_found" });
  });

  it("scopes products by organizationId and allows duplicate SKU across orgs", async () => {
    const h = harness();
    const acme = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      sku: "WIDGET-1",
      name: "Acme widget",
      uom: "EA",
      memberPriceCents: 1000,
    });
    const beta = await h.create.execute({
      organizationId: BETA_ORG,
      staffUserId: STAFF_ID,
      sku: "WIDGET-1",
      name: "Beta widget",
      uom: "EA",
      memberPriceCents: 2000,
    });
    expect(acme.ok).toBe(true);
    expect(beta.ok).toBe(true);

    const acmeList = await h.listStaff.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
    expect(acmeList.total).toBe(1);
    expect(acmeList.items[0]?.product.name).toBe("Acme widget");

    const duplicateInAcme = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      sku: "WIDGET-1",
      name: "Duplicate",
      uom: "EA",
      memberPriceCents: 999,
    });
    expect(duplicateInAcme).toEqual({ ok: false, reason: "duplicate_sku" });

    if (!beta.ok) {
      throw new Error("expected beta product");
    }
    const crossOrgGet = await h.get.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      productId: beta.product.id,
    });
    expect(crossOrgGet).toEqual({ ok: false, reason: "not_found" });

    const betaBySku = await h.products.findBySku(BETA_ORG, beta.product.sku);
    expect(betaBySku?.name).toBe("Beta widget");
    const acmeBySku = await h.products.findBySku(DEFAULT_ORG, beta.product.sku);
    expect(acmeBySku?.name).toBe("Acme widget");
  });

  it("keeps application/ free of Fastify, Drizzle, Zod, and adapter SDKs", () => {
    const dir = resolve(import.meta.dirname, "../src/application");
    const forbidden = /fastify|drizzle|zod|minio|better-auth/i;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".ts")) {
        continue;
      }
      const source = readFileSync(resolve(dir, name), "utf8");
      expect(source, name).not.toMatch(forbidden);
    }
  });

  it("never imports inventory tables from the Catalog Postgres adapter", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../src/adapters/drizzle-products.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/stock_snapshots|stockSnapshots|stockMovements/);
    expect(source).not.toContain("schema/inventory");
    expect(source).not.toContain("@dc-inventory/inventory");
  });
});
