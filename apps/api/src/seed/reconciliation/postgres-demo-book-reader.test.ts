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

  let parallelIndex = 0;
  let locationLookup = false;

  const db = {
    select: vi.fn(() => {
      if (!locationLookup) {
        locationLookup = true;
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: bundle.defaultLocationId }]),
            })),
          })),
        };
      }

      const rows = parallelRows[parallelIndex] ?? [];
      const index = parallelIndex;
      parallelIndex += 1;

      if (index === 1) {
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(async () => rows),
          })),
        };
      }

      return {
        from: vi.fn(async () => rows),
      };
    }),
  };

  return db;
}

describe("PostgresDemoBookReader", () => {
  it("loads the same reconciliation facts as the in-memory reduced book", async () => {
    const source = buildValidReducedDemoBook();
    const bundle = demoBookToRowBundle(source);
    const db = mockDbFromBundle(bundle);

    const loaded = await new PostgresDemoBookReader(db as never).load();
    const memoryResult = await assertDemoBook(new InMemoryDemoBookReader(source), {
      seedToday: reducedDemoSeedToday(),
      expectations: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
    });
    const postgresResult = await assertDemoBook(new InMemoryDemoBookReader(loaded), {
      seedToday: reducedDemoSeedToday(),
      expectations: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
    });

    expect(memoryResult).toEqual({ ok: true });
    expect(postgresResult).toEqual({ ok: true });
    expect(loaded).toEqual(source);
  });
});
