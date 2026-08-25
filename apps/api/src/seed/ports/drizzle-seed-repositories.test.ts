import { describe, expect, it, vi } from "vitest";
import { DrizzleProductImageSeedRepository } from "./drizzle-product-image-seed.js";
import { DrizzleSupplierProductSeedRepository } from "./drizzle-supplier-product-seed.js";

describe("DrizzleProductImageSeedRepository", () => {
  it("inserts placeholder metadata on first save and updates on repeat", async () => {
    const selectRows: unknown[] = [];
    const insertValues: unknown[] = [];
    const updateSets: unknown[] = [];

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => selectRows),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async (row: unknown) => {
          insertValues.push(row);
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async (row: unknown) => {
            updateSets.push(row);
          }),
        })),
      })),
    };

    const repo = new DrizzleProductImageSeedRepository(db as never);
    await repo.save({
      productId: "prod-1",
      objectKey: "demo/catalog/SKU.jpg",
      contentType: "image/jpeg",
    });
    expect(insertValues).toHaveLength(1);

    selectRows.push({ id: "img-1" });
    await repo.save({
      productId: "prod-1",
      objectKey: "demo/catalog/SKU-rotated.jpg",
      contentType: "image/jpeg",
    });
    expect(updateSets).toHaveLength(1);
    expect(insertValues).toHaveLength(1);
  });
});

describe("DrizzleSupplierProductSeedRepository", () => {
  it("inserts supplier-product rows and updates min order qty on conflict", async () => {
    const selectRows: unknown[] = [];
    const insertValues: unknown[] = [];
    const updateSets: unknown[] = [];

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => selectRows),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async (row: unknown) => {
          insertValues.push(row);
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async (row: unknown) => {
            updateSets.push(row);
          }),
        })),
      })),
    };

    const repo = new DrizzleSupplierProductSeedRepository(db as never);
    await repo.save({ supplierId: "sup-1", sku: "HEX-BOLT-GALV", minOrderQty: null });
    expect(insertValues).toHaveLength(1);

    selectRows.push({ id: "sp-1" });
    await repo.save({ supplierId: "sup-1", sku: "HEX-BOLT-GALV", minOrderQty: 6 });
    expect(updateSets).toHaveLength(1);
    expect(insertValues).toHaveLength(1);
  });
});
