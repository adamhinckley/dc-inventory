import { OrganizationId } from "@dc-inventory/shared-kernel";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppDrizzle } from "../infrastructure/db.js";
import { schema } from "../infrastructure/schema.js";
import { preOrderOpenDraftPurchaseOrderReadPort } from "./pre-order-open-draft-purchase-order-read-port.js";
import {
  createPreOrderListQueryPgliteHarness,
  preOrderListQueryPgliteIds,
} from "./support/pre-order-list-query-pglite.js";

describe("preOrderOpenDraftPurchaseOrderReadPort (Drizzle / PGlite)", () => {
  let harness: Awaited<ReturnType<typeof createPreOrderListQueryPgliteHarness>>;

  beforeAll(async () => {
    harness = await createPreOrderListQueryPgliteHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it("looks up an open draft by supplier uuid and sku without uuid = text", async () => {
    const db = drizzle(harness.client, { schema }) as unknown as AppDrizzle;
    const port = preOrderOpenDraftPurchaseOrderReadPort(db);

    const refs = await port.findOpenDraftsForSupplierSkus(OrganizationId.DEFAULT, [
      {
        supplierId: preOrderListQueryPgliteIds.supplierA,
        sku: preOrderListQueryPgliteIds.skuA,
      },
    ]);

    expect(refs.get(`${preOrderListQueryPgliteIds.supplierA}:${preOrderListQueryPgliteIds.skuA.value}`)).toEqual({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      documentNumber: "PO-00042",
    });
  });
});
