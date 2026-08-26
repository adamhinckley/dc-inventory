import {
  InMemoryAccountingUnitOfWork,
} from "@dc-inventory/accounting";
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
import { DEMO_COUNTS, DEFAULT_DEMO_SEED } from "./planner/constants.js";
import { planDemoBook } from "./planner/plan-demo-book.js";
import { InMemoryProductImageSeedRepository } from "./ports/in-memory-product-image-seed.js";
import { InMemoryReorderPolicySeedRepository } from "./ports/in-memory-reorder-policy-seed.js";
import { InMemorySupplierProductSeedRepository } from "./ports/in-memory-supplier-product-seed.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import {
  FULL_DEMO_RECONCILIATION_EXPECTATIONS,
} from "./reconciliation/expectations.js";
import { isDemoLowStock } from "./reconciliation/assert-demo-book.js";
import {
  productNameBySkuFromPlan,
  runReplayPurchaseOrders,
  supplierIdByKeyFromPlan,
} from "./replay-purchase-orders.js";
import {
  currencyBySkuFromPlan,
  customerIdByKeyFromPlan,
  runReplaySalesOrders,
  taxCategoryBySkuFromPlan,
} from "./replay-sales-orders.js";
import { runReplayPayments } from "./replay-payments.js";
import { runWriteReorderPolicies } from "./write-reorder-policies.js";
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
        const existing = await suppliers.findByVendorNumber(PHASE2_SUPPLIER_VENDOR_NUMBER);
        if (existing) {
          return { id: existing.id, vendorNumber: existing.vendorNumber };
        }
        const id = SupplierId.parse(crypto.randomUUID());
        await suppliers.save({
          id,
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
    const supplier = await from.findByVendorNumber(planned.vendorNumber);
    if (supplier !== null) {
      await to.save(supplier);
    }
  }
}

describe("write reorder policies (in-memory)", () => {
  it("writes one DEFAULT policy per shop SKU after full demo playback", async () => {
    const plan = planDemoBook({ seed: DEFAULT_DEMO_SEED, seedToday: SEED_TODAY });
    const staticPorts = staticSeedPorts();
    const staticResult = await runWriteStaticDemoBook(staticPorts, plan, {
      staffPassword: "staff-placeholder",
      wholesalePassword: "wholesale-placeholder",
    });

    const clock = new InMemoryClock(plan.purchaseOrders[0]!.plannedInstant);
    const uow = new InMemoryUnitOfWork(clock);
    const accountingUow = new InMemoryAccountingUnitOfWork(uow.invoices);
    await copySuppliers(plan, staticPorts.suppliers, uow.suppliers);

    await runReplayPurchaseOrders(
      { uow: uow.purchasing, clock },
      {
        plan,
        supplierIdByKey: await supplierIdByKeyFromPlan(plan, uow.suppliers),
        productNameBySku: productNameBySkuFromPlan(plan),
        staffUserId: staticResult.staff.id,
      },
    );

    await runReplaySalesOrders(
      { uow: uow.sales, clock, customers: staticPorts.customers, invoices: uow.invoices },
      {
        plan,
        customerIdByKey: await customerIdByKeyFromPlan(plan, staticPorts.customers),
        productNameBySku: productNameBySkuFromPlan(plan),
        currencyBySku: currencyBySkuFromPlan(plan),
        taxCategoryBySku: taxCategoryBySkuFromPlan(plan),
        staffUserId: staticResult.staff.id,
      },
    );

    await runReplayPayments(
      {
        accountingUow,
        clock,
        salesOrders: uow.salesOrders,
        invoices: uow.invoices,
      },
      {
        plan,
        staffUserId: staticResult.staff.id,
      },
    );

    const movementCountBeforePolicies = (await uow.inventory.readModel.listMovements()).length;

    const reorderPolicies = new InMemoryReorderPolicySeedRepository();
    const write = await runWriteReorderPolicies(
      {
        products: staticPorts.products,
        inventoryReadModel: uow.inventory.readModel,
        reorderPolicies,
      },
      {
        plan,
        locationId: LocationId.DEFAULT,
      },
    );

    expect(write.policyCount).toBe(DEMO_COUNTS.products);
    expect((await uow.inventory.readModel.listMovements()).length).toBe(
      movementCountBeforePolicies,
    );

    const policies = await reorderPolicies.listAll();
    expect(policies).toHaveLength(DEMO_COUNTS.products);
    expect(new Set(policies.map((row) => row.sku)).size).toBe(DEMO_COUNTS.products);
    expect(policies.every((row) => row.locationId === LocationId.DEFAULT)).toBe(true);

    const listedProducts = await staticPorts.products.listMatching({
      organizationId: OrganizationId.DEFAULT,
      shopVisibleOnly: true,
    });
    expect(listedProducts).toHaveLength(DEMO_COUNTS.products);

    let lowCount = 0;
    let naturalZeros = 0;
    for (const row of listedProducts) {
      const policy = policies.find((entry) => entry.sku === row.product.sku.value);
      expect(policy).toBeDefined();
      const snapshot = await uow.inventory.readModel.getSnapshot(
        row.product.sku,
        LocationId.DEFAULT,
      );
      expect(policy!.maxOnHand).toBe(Math.max(policy!.minOnHand + 12, snapshot.onHand));
      if (snapshot.onHand === 0) {
        naturalZeros += 1;
      }
      if (isDemoLowStock(snapshot.onHand, policy!.minOnHand)) {
        lowCount += 1;
      }
    }

    const { lowStockMin, lowStockMax } = FULL_DEMO_RECONCILIATION_EXPECTATIONS;
    if (naturalZeros > lowStockMax) {
      expect(lowCount).toBeGreaterThanOrEqual(lowStockMin);
    } else {
      expect(lowCount).toBeGreaterThanOrEqual(lowStockMin);
      expect(lowCount).toBeLessThanOrEqual(lowStockMax);
    }
  }, 600_000);
});
