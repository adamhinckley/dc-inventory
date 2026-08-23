import {
  CustomerId,
  ProductId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryProductRepository } from "../src/adapters/in-memory-product-repository.js";
import { InMemoryQtyReadPort } from "../src/adapters/in-memory-qty-read.js";
import { CreateProductUseCase } from "../src/application/create-product.js";
import { GetProductUseCase } from "../src/application/get-product.js";
import { GetWholesaleProductUseCase } from "../src/application/get-wholesale-product.js";
import { ListStaffProductsUseCase } from "../src/application/list-staff-products.js";
import { ListWholesaleCatalogUseCase } from "../src/application/list-wholesale-catalog.js";
import { UpdateProductUseCase } from "../src/application/update-product.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const OTHER_STAFF = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440020");

function harness() {
  const products = new InMemoryProductRepository();
  const qty = new InMemoryQtyReadPort();
  return {
    products,
    qty,
    create: new CreateProductUseCase(products),
    update: new UpdateProductUseCase(products, qty),
    get: new GetProductUseCase(products, qty),
    getWholesale: new GetWholesaleProductUseCase(products, qty),
    listStaff: new ListStaffProductsUseCase(products, qty),
    listWholesale: new ListWholesaleCatalogUseCase(products, qty),
  };
}

async function createProduct(
  h: ReturnType<typeof harness>,
  overrides: Partial<{
    sku: string;
    name: string;
    uom: string;
    memberPriceCents: number;
    inactive: boolean;
    discontinued: boolean;
    webWholesale: boolean;
  }> = {},
) {
  const created = await h.create.execute({
    staffUserId: STAFF_ID,
    sku: overrides.sku ?? "HEX-BOLT-GALV",
    name: overrides.name ?? "Galvanized hex bolt",
    uom: overrides.uom ?? "EA",
    memberPriceCents: overrides.memberPriceCents ?? 1250,
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
      customerId: CUSTOMER_ID,
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.product.sku.value).toBe("SHOP-OK");
    expect(listed.items[0]?.product.memberPrice.amountMinor).toBe(1250);
  });

  it("treats missing qty snapshots as zero", async () => {
    const h = harness();
    const product = await createProduct(h);
    const listed = await h.listStaff.execute({
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
    });

    h.qty.set(product.sku.value, {
      onHand: 10,
      onOrder: 4,
      allocated: 3,
      available: 7,
    });
    const withSnapshot = await h.get.execute({
      staffUserId: STAFF_ID,
      productId: product.id,
    });
    expect(withSnapshot).toEqual({
      ok: true,
      product,
      qty: { onHand: 10, onOrder: 4, allocated: 3, available: 7 },
    });
  });

  it("rejects qty on create and update", async () => {
    const h = harness();
    const created = await h.create.execute({
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
      staffUserId: STAFF_ID,
      productId: product.id,
      sku: "NEW-SKU",
      name: "Renamed",
    } as Parameters<UpdateProductUseCase["execute"]>[0] & { sku: string });
    expect(updated).toEqual({ ok: false, reason: "sku_immutable" });

    const ok = await h.update.execute({
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

  it("returns not_found for a hidden or missing wholesale product", async () => {
    const h = harness();
    const hidden = await createProduct(h, {
      sku: "HIDDEN",
      webWholesale: false,
    });
    const missing = await h.getWholesale.execute({
      customerId: CUSTOMER_ID,
      productId: ProductId.parse("550e8400-e29b-41d4-a716-446655440099"),
    });
    expect(missing).toEqual({ ok: false, reason: "not_found" });
    const hiddenResult = await h.getWholesale.execute({
      customerId: CUSTOMER_ID,
      productId: hidden.id,
    });
    expect(hiddenResult).toEqual({ ok: false, reason: "not_found" });
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
