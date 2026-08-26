import { InMemoryProductRepository } from "@dc-inventory/catalog";
import {
  InMemoryCustomerRepository,
  InMemoryExemptionCertificateRepository,
  InMemoryShipToRepository,
} from "@dc-inventory/customers";
import {
  InMemoryPasswordHasher,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import { InMemoryClock, InMemorySupplierRepository } from "@dc-inventory/purchasing";
import {
  PHASE2_DEFAULT_LOCATION_CODE,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import { LocationId, OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../adapters/in-memory-unit-of-work.js";
import {
  DEMO_COUNTS,
  DEFAULT_DEMO_SEED,
  PO_LINE_COUNT_MAX,
  PO_LINE_COUNT_MEAN,
  PO_LINE_COUNT_MIN,
  PO_LINE_QTY_MAX,
  PO_LINE_QTY_MEAN,
  PO_LINE_QTY_MIN,
} from "./planner/constants.js";
import { mean } from "./planner/corpus-samplers.js";
import { isWithinLastDays } from "./planner/dates.js";
import { planDemoBook } from "./planner/plan-demo-book.js";
import { PHASE1_PRODUCT_SKUS } from "./phase1-fixture.js";
import { InMemoryProductImageSeedRepository } from "./ports/in-memory-product-image-seed.js";
import { InMemorySupplierProductSeedRepository } from "./ports/in-memory-supplier-product-seed.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import {
  FULL_DEMO_RECONCILIATION_EXPECTATIONS,
} from "./reconciliation/expectations.js";
import {
  productNameBySkuFromPlan,
  runReplayPurchaseOrders,
  supplierIdByKeyFromPlan,
} from "./replay-purchase-orders.js";
import { runWriteStaticDemoBook } from "./write-static-demo-book.js";

const SEED_TODAY = new Date("2026-08-24T15:30:00.000Z");

function staticSeedPorts(): StaticDemoSeedPorts & {
  locations: Map<string, { id: string; code: string }>;
} {
  const suppliers = new InMemorySupplierRepository();
  const locations = new Map<string, { id: string; code: string }>();
  let locationSeq = 0;

  return {
    products: new InMemoryProductRepository(),
    productImages: new InMemoryProductImageSeedRepository(),
    customers: new InMemoryCustomerRepository(),
    shipTos: new InMemoryShipToRepository(),
    exemptionCertificates: new InMemoryExemptionCertificateRepository(),
    staffUsers: new InMemoryStaffUserRepository(),
    wholesaleUsers: new InMemoryWholesaleUserRepository(),
    passwords: new InMemoryPasswordHasher(),
    suppliers,
    supplierProducts: new InMemorySupplierProductSeedRepository(),
    locations,
    phase2Bootstrap: {
      async upsertDefaultLocation() {
        const existing = locations.get(PHASE2_DEFAULT_LOCATION_CODE);
        if (existing) {
          return existing;
        }
        const row = {
          id: `loc-${String(++locationSeq)}`,
          code: PHASE2_DEFAULT_LOCATION_CODE,
        };
        locations.set(PHASE2_DEFAULT_LOCATION_CODE, row);
        return row;
      },
      async upsertPrerequisiteSupplier() {
        const existing = await suppliers.findByVendorNumber(
          OrganizationId.DEFAULT,
          PHASE2_SUPPLIER_VENDOR_NUMBER,
        );
        if (existing) {
          return { id: existing.id, vendorNumber: existing.vendorNumber };
        }
        const id = SupplierId.parse(crypto.randomUUID());
        await suppliers.save({
          id,
          organizationId: OrganizationId.DEFAULT,
          vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
          name: PHASE2_SUPPLIER_NAME,
        });
        return { id, vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER };
      },
    },
  };
}

async function copySuppliers(
  plan: ReturnType<typeof planDemoBook>,
  from: InMemorySupplierRepository,
  to: InMemorySupplierRepository,
): Promise<void> {
  for (const planned of plan.master.suppliers) {
    const supplier = await from.findByVendorNumber(OrganizationId.DEFAULT, planned.vendorNumber);
    if (supplier !== null) {
      await to.save(supplier);
    }
  }
}

describe("replay purchase orders (in-memory)", () => {
  it("replays the full demo PO book through use cases", async () => {
    const plan = planDemoBook({ seed: DEFAULT_DEMO_SEED, seedToday: SEED_TODAY });
    const staticPorts = staticSeedPorts();
    const staticResult = await runWriteStaticDemoBook(staticPorts, plan, {
      staffPassword: "staff-placeholder",
      wholesalePassword: "wholesale-placeholder",
    });

    const clock = new InMemoryClock(plan.purchaseOrders[0]!.plannedInstant);
    const uow = new InMemoryUnitOfWork(clock);
    await copySuppliers(plan, staticPorts.suppliers, uow.suppliers);

    const replay = await runReplayPurchaseOrders(
      { uow: uow.purchasing, clock },
      {
        plan,
        supplierIdByKey: await supplierIdByKeyFromPlan(plan, uow.suppliers),
        productNameBySku: productNameBySkuFromPlan(plan),
        staffUserId: staticResult.staff.id,
      },
    );

    expect(replay.purchaseOrderCount).toBe(DEMO_COUNTS.purchaseOrders);
    expect(replay.lastDocumentNumber).toBe("PO-03000");
    expect(replay.leftoverConfirmedCount).toBe(plan.leftoverConfirmedPurchaseOrderCount);
    expect(replay.leftoverConfirmedCount).toBeGreaterThanOrEqual(
      FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedPurchaseOrderMin,
    );
    expect(replay.leftoverConfirmedCount).toBeLessThanOrEqual(
      FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedPurchaseOrderMax,
    );
    expect(replay.receivedCount).toBe(
      DEMO_COUNTS.purchaseOrders - plan.leftoverConfirmedPurchaseOrderCount,
    );

    const listed = await uow.purchaseOrders.list({
      organizationId: OrganizationId.DEFAULT,
      page: 1,
      pageSize: 10_000,
    });
    expect(listed.total).toBe(DEMO_COUNTS.purchaseOrders);
    expect(listed.items.every((row) => row.status !== "draft" && row.status !== "cancelled")).toBe(
      true,
    );

    const plannedByKey = new Map(plan.purchaseOrders.map((row) => [row.key, row]));
    const supplierSkusByKey = new Map(
      plan.master.suppliers.map((supplier) => [
        supplier.key,
        new Set(
          plan.master.supplierProducts
            .filter((row) => row.supplierKey === supplier.key)
            .map((row) => row.sku),
        ),
      ]),
    );

    const confirmedUnreceived = listed.items.filter((row) => row.status === "confirmed");
    expect(confirmedUnreceived).toHaveLength(plan.leftoverConfirmedPurchaseOrderCount);
    for (const order of confirmedUnreceived) {
      expect(order.lines.every((line) => line.receivedQty === 0)).toBe(true);
      const sequence = Number.parseInt(order.documentNumber.slice(3), 10);
      const planned = plannedByKey.get(`po-${String(sequence).padStart(5, "0")}`);
      expect(planned?.status).toBe("leftoverConfirmed");
      expect(
        isWithinLastDays(
          order.createdAt,
          SEED_TODAY,
          FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverWindowDays,
        ),
      ).toBe(true);
    }

    for (const order of listed.items) {
      expect(new Set(order.lines.map((line) => line.sku.value)).size).toBe(order.lines.length);
      const sequence = Number.parseInt(order.documentNumber.slice(3), 10);
      const planned = plannedByKey.get(`po-${String(sequence).padStart(5, "0")}`);
      expect(planned).toBeDefined();
      expect(order.createdAt.getTime()).toBe(planned!.plannedInstant.getTime());
      const supplierSkus = supplierSkusByKey.get(planned!.supplierKey);
      expect(supplierSkus).toBeDefined();
      for (const line of order.lines) {
        expect(supplierSkus!.has(line.sku.value)).toBe(true);
      }
    }

    const received = listed.items.filter((row) => row.status === "received");
    expect(received).toHaveLength(replay.receivedCount);
    for (const order of received) {
      expect(order.lines.every((line) => line.receivedQty === line.qty)).toBe(true);
    }

    const poLineCounts = listed.items.map((row) => row.lines.length);
    const poQtys = listed.items.flatMap((row) => row.lines.map((line) => line.qty));
    expect(mean(poLineCounts)).toBe(PO_LINE_COUNT_MEAN);
    expect(mean(poQtys)).toBe(PO_LINE_QTY_MEAN);
    expect(poLineCounts.every((count) => count >= PO_LINE_COUNT_MIN && count <= PO_LINE_COUNT_MAX)).toBe(
      true,
    );
    expect(poQtys.every((qty) => qty >= PO_LINE_QTY_MIN && qty <= PO_LINE_QTY_MAX)).toBe(true);

    const receivedPhase1Skus = new Set<string>();
    for (const order of received) {
      for (const line of order.lines) {
        receivedPhase1Skus.add(line.sku.value);
      }
    }
    for (const sku of PHASE1_PRODUCT_SKUS) {
      expect(receivedPhase1Skus.has(sku)).toBe(true);
    }

    const movements = await uow.inventory.readModel.listMovements({ locationId: LocationId.DEFAULT });
    const inbound = movements.filter((row) => row.movementType === "InboundFromPo");
    const goodsReceived = movements.filter((row) => row.movementType === "GoodsReceived");
    const expectedInboundLines = plan.purchaseOrders.reduce(
      (sum, order) => sum + order.lines.length,
      0,
    );
    const expectedReceivedLines = plan.purchaseOrders
      .filter((order) => order.status === "received")
      .reduce((sum, order) => sum + order.lines.length, 0);
    expect(inbound.length).toBe(expectedInboundLines);
    expect(goodsReceived.length).toBe(expectedReceivedLines);
    expect(inbound.length).toBeGreaterThan(goodsReceived.length);

    const instantByPoId = new Map(
      listed.items.map((order) => {
        const sequence = Number.parseInt(order.documentNumber.slice(3), 10);
        const planned = plannedByKey.get(`po-${String(sequence).padStart(5, "0")}`);
        return [order.id, planned!.plannedInstant] as const;
      }),
    );
    for (const movement of movements) {
      if (movement.refType !== "purchase_order") {
        continue;
      }
      const expectedInstant = instantByPoId.get(movement.refId);
      expect(expectedInstant).toBeDefined();
      expect(movement.createdAt.getTime()).toBe(expectedInstant!.getTime());
    }

    for (const order of confirmedUnreceived) {
      const inboundForPo = inbound.filter((row) => row.refId === order.id);
      expect(inboundForPo.length).toBe(order.lines.length);
      expect(goodsReceived.some((row) => row.refId === order.id)).toBe(false);
    }
  }, 120_000);
});
