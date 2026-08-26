import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import { assertDemoBook } from "./assert-demo-book.js";
import { demoBookToRowBundle } from "./demo-book-assembler.js";
import { InMemoryDemoBookReader } from "./in-memory-demo-book-reader.js";
import { PostgresDemoBookReader } from "./postgres-demo-book-reader.js";
import {
  buildValidReducedDemoBook,
  REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
  reducedDemoSeedToday,
} from "./valid-reduced-demo-book.js";

const EXPECTED_SELECT_SHAPES: readonly (readonly string[])[] = [
  [
    "id",
    "sku",
    "name",
    "description",
    "uom",
    "memberPriceCents",
    "listPriceCents",
    "currency",
    "webWholesale",
    "taxCategoryCode",
  ],
  ["productId", "sku", "objectKey", "contentType"],
  ["id", "vendorNumber", "name"],
  ["supplierId", "sku", "minOrderQty"],
  ["id", "name", "creditLimitCents", "currency", "terms"],
  ["id", "customerId", "line1", "line2", "city", "region", "postal", "country", "isDefault"],
  ["customerId", "name", "email"],
  ["customerId", "objectKey", "jurisdiction", "entityUseCode", "expiresAt", "status"],
  ["id", "email"],
  ["id", "email", "customerId"],
  ["id", "email"],
  ["id", "supplierId", "status", "documentNumber", "createdAt"],
  ["purchaseOrderId", "sku", "qty", "receivedQty"],
  [
    "id",
    "customerId",
    "status",
    "documentNumber",
    "createdAt",
    "shipLine1",
    "shipLine2",
    "shipCity",
    "shipRegion",
    "shipPostal",
    "shipCountry",
  ],
  ["orderId", "sku", "qty", "unitPriceCents"],
  [
    "id",
    "orderId",
    "customerId",
    "documentNumber",
    "postedAt",
    "subtotalCents",
    "taxTotalCents",
    "totalCents",
  ],
  ["invoiceId"],
  ["id", "customerId", "amountCents"],
  ["paymentId", "invoiceId", "amountCents"],
  ["id", "invoiceId", "organizationId"],
  ["sku", "locationId", "movementType", "qty", "createdAt"],
  ["sku", "locationId", "onHand", "onOrder", "allocated"],
  ["sku", "locationId", "minOnHand", "maxOnHand"],
];

function pick<T extends Record<string, unknown>>(row: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = row[key];
  }
  return out;
}

function isImageJoinShape(keys: readonly string[]): boolean {
  return keys.includes("productId") && keys.includes("sku") && keys.includes("objectKey");
}

function isTaxCommitShape(keys: readonly string[]): boolean {
  return keys.includes("organizationId") && keys.includes("invoiceId");
}

function mockDbFromBundle(bundle: ReturnType<typeof demoBookToRowBundle>) {
  const parallelRows = [
    bundle.products,
    bundle.images,
    bundle.suppliers,
    bundle.supplierProducts,
    bundle.customers,
    bundle.shipTos,
    bundle.contacts,
    bundle.exemptionCertificates,
    bundle.staffUsers,
    bundle.wholesaleUsers,
    bundle.opsUsers,
    bundle.purchaseOrders,
    bundle.purchaseOrderLines,
    bundle.salesOrders,
    bundle.salesOrderLines,
    bundle.invoices,
    bundle.invoiceTaxLines,
    bundle.payments,
    bundle.paymentApplications,
    bundle.taxCommits,
    bundle.movements.map((row) => ({
      sku: row.sku,
      locationId: row.locationId,
      movementType: row.movementType,
      qty: row.quantity,
      createdAt: row.createdAt,
    })),
    bundle.snapshots,
    bundle.reorderPolicies,
  ];

  const shapesPerLoad: string[][] = [];
  let parallelIndex = 0;

  const db = {
    select: vi.fn((shape: Record<string, unknown>) => {
      const keys = Object.keys(shape);

      const locationLookup = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              parallelIndex = 0;
              shapesPerLoad.push([]);
              return [{ id: bundle.defaultLocationId }];
            }),
          })),
        })),
      };

      if (keys.length === 1 && keys[0] === "id") {
        return locationLookup;
      }

      const loadShapes = shapesPerLoad[shapesPerLoad.length - 1];
      if (!loadShapes) {
        throw new Error("parallel select before DEFAULT location lookup");
      }
      loadShapes.push(keys);

      const rows = parallelRows[parallelIndex] ?? [];
      parallelIndex += 1;

      if (isImageJoinShape(keys)) {
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(async () => rows.map((row) => pick(row as Record<string, unknown>, keys))),
          })),
        };
      }

      if (isTaxCommitShape(keys)) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(async () =>
              rows
                .filter(
                  (row) =>
                    (row as { organizationId?: string }).organizationId ===
                      OrganizationId.DEFAULT ||
                    (row as { organizationId?: string }).organizationId ===
                      undefined,
                )
                .map((row) => pick(row as Record<string, unknown>, keys)),
            ),
          })),
        };
      }

      return {
        from: vi.fn(async () => rows.map((row) => pick(row as Record<string, unknown>, keys))),
      };
    }),
  };

  return { db, shapesPerLoad };
}

describe("PostgresDemoBookReader", () => {
  it("loads the same reconciliation facts as the in-memory reduced book", async () => {
    const source = buildValidReducedDemoBook();
    const bundle = demoBookToRowBundle(source);
    const { db, shapesPerLoad } = mockDbFromBundle(bundle);
    const options = {
      seedToday: reducedDemoSeedToday(),
      expectations: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
    };

    const reader = new PostgresDemoBookReader(db as never);
    const loaded = await reader.load();
    const memoryResult = await assertDemoBook(new InMemoryDemoBookReader(source), options);
    const postgresViaLoad = await assertDemoBook(new InMemoryDemoBookReader(loaded), options);
    const postgresDirect = await assertDemoBook(reader, options);

    expect(shapesPerLoad).toHaveLength(2);
    for (const loadShapes of shapesPerLoad) {
      expect(loadShapes).toEqual(EXPECTED_SELECT_SHAPES);
    }
    expect(db.select).toHaveBeenCalledTimes(
      2 * (1 + EXPECTED_SELECT_SHAPES.length),
    );
    expect(memoryResult).toEqual({ ok: true });
    expect(postgresViaLoad).toEqual({ ok: true });
    expect(postgresDirect).toEqual({ ok: true });
    expect(postgresDirect).toEqual(memoryResult);
    expect(loaded).toEqual(source);
  });
});
