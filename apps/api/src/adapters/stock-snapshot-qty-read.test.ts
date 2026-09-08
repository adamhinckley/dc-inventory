import { GetWholesaleProductUseCase, isWholesaleHiddenBeforeOpen } from "@dc-inventory/catalog";
import { DrizzleProductRepository } from "@dc-inventory/catalog";
import { lockedDraftIncreaseShortage } from "../../../../packages/sales/src/application/draft-line-sellable.js";
import { CustomerId, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { catalogProductPort } from "./catalog-product-port.js";
import { StockSnapshotQtyReadAdapter } from "./stock-snapshot-qty-read.js";
import { createCatalogListQueryPgliteHarness } from "./support/catalog-list-query-pglite.js";

const NOW = new Date("2026-09-03T12:00:00.000Z");
const FUTURE_OPENS = new Date("2026-09-03T13:00:00.000Z");
const WINDOW_CLOSES = new Date("2026-09-03T14:00:00.000Z");
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440020");

describe("StockSnapshotQtyReadAdapter", () => {
  it("projects active SellWindow membership for hide-before-open and draft cart OR rules", async () => {
    const harness = await createCatalogListQueryPgliteHarness();
    try {
      const org = OrganizationId.DEFAULT;
      const sku = Sku.parse("QTY-READ-MEMBERSHIP");
      const productId = ProductId.parse("da209000-0000-4000-8000-000000000601");
      const sellWindowId = "da209000-0000-4000-8000-000000000602";
      await harness.client.query(
        `INSERT INTO catalog.products
          (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
         VALUES ($1, $2, $3, 'Membership qty read', 'EA', 100, 50, true)`,
        [productId, org, sku.value],
      );
      await harness.client.query(
        `INSERT INTO inventory.stock_snapshots
          (organization_id, sku, location_id, on_hand, sticky_locked, window_opens_at)
         VALUES ($1, $2, $3, 4, false, $4)`,
        [org, sku.value, harness.locationId, FUTURE_OPENS.toISOString()],
      );
      await harness.client.query(
        `INSERT INTO inventory.sell_windows
          (id, organization_id, name, filter_snapshot, window_opens_at, window_closes_at, status,
           manually_closed_at, applied_by, applied_at, sku_count)
         VALUES ($1, $2, 'Summer', '{}'::jsonb, $3, $4, 'open', NULL, 'staff', $5, 1)`,
        [
          sellWindowId,
          org,
          "2026-09-03T10:00:00.000Z",
          WINDOW_CLOSES.toISOString(),
          NOW.toISOString(),
        ],
      );
      await harness.client.query(
        `INSERT INTO inventory.sell_window_skus
          (id, organization_id, sell_window_id, sku)
         VALUES ($1, $2, $3, $4)`,
        ["da209000-0000-4000-8000-000000000603", org, sellWindowId, sku.value],
      );

      const qtyRead = new StockSnapshotQtyReadAdapter(harness.db, harness.clock);
      const snapshots = await qtyRead.readBySkus(org, [sku]);
      const qty = snapshots.get(sku.value);
      expect(qty).toMatchObject({
        sellState: "open",
        hasActiveSellWindowMembership: true,
        windowOpensAt: FUTURE_OPENS,
      });
      expect(isWholesaleHiddenBeforeOpen(qty!, { now: NOW })).toBe(false);

      const products = new DrizzleProductRepository(harness.db);
      const getWholesale = new GetWholesaleProductUseCase(
        products,
        qtyRead,
        () => harness.clock.now(),
      );
      const got = await getWholesale.execute({
        organizationId: org,
        customerId: CUSTOMER_ID,
        productId,
      });
      expect(got.ok).toBe(true);

      const catalogProducts = catalogProductPort(products, qtyRead);
      const product = await catalogProducts.findById(org, productId);
      expect(product?.sellState).toBe("open");
      expect(lockedDraftIncreaseShortage(product!, 3, 0, NOW)).toBeNull();
    } finally {
      await harness.close();
    }
  });

  it("freezes post-close draft increases when membership is closed", async () => {
    const harness = await createCatalogListQueryPgliteHarness();
    try {
      const org = OrganizationId.DEFAULT;
      const sku = Sku.parse("QTY-READ-POST-CLOSE");
      const productId = ProductId.parse("da209000-0000-4000-8000-000000000611");
      const pastCloses = new Date("2026-09-03T11:00:00.000Z");
      await harness.client.query(
        `INSERT INTO catalog.products
          (id, organization_id, sku, name, uom, member_price_cents, list_price_cents, web_wholesale)
         VALUES ($1, $2, $3, 'Post-close qty read', 'EA', 100, 50, true)`,
        [productId, org, sku.value],
      );
      await harness.client.query(
        `INSERT INTO inventory.stock_snapshots
          (organization_id, sku, location_id, on_hand, sticky_locked, window_opens_at, window_closes_at)
         VALUES ($1, $2, $3, 5, false, $4, $5)`,
        [
          org,
          sku.value,
          harness.locationId,
          "2026-09-03T10:00:00.000Z",
          pastCloses.toISOString(),
        ],
      );

      const qtyRead = new StockSnapshotQtyReadAdapter(harness.db, harness.clock);
      const products = new DrizzleProductRepository(harness.db);
      const catalogProducts = catalogProductPort(products, qtyRead);
      const product = await catalogProducts.findById(org, productId);
      expect(product?.sellState).toBe("locked");
      expect(product?.hasActiveSellWindowMembership).toBe(false);
      expect(lockedDraftIncreaseShortage(product!, 2, 0, NOW)).toEqual({
        sku: sku.value,
        name: "Post-close qty read",
        requestedQty: 2,
        availableQty: 0,
      });
    } finally {
      await harness.close();
    }
  });
});
