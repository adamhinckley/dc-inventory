import { InMemoryProductRepository } from "@dc-inventory/catalog";
import {
  InMemoryCustomerRepository,
  InMemoryExemptionCertificateRepository,
  InMemoryShipToRepository,
} from "@dc-inventory/customers";
import {
  InMemoryOrganizationRepository,
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
  PERSONA_ORDER_BUDGETS,
  SO_LINE_COUNT_DEFAULT_MEAN,
  SO_LINE_COUNT_IDLE_PARK_MAX,
  SO_LINE_COUNT_IDLE_PARK_MIN,
  SO_LINE_COUNT_NORTHSTAR_MAX,
  SO_LINE_COUNT_NORTHSTAR_MIN,
  SO_LINE_QTY_MAX,
  SO_LINE_QTY_MEAN,
  SO_LINE_QTY_MIN,
} from "./planner/constants.js";
import { mean } from "./planner/corpus-samplers.js";
import { isWithinLastDays } from "./planner/dates.js";
import { allocateInstant } from "./planner/allocate-instant.js";
import { planDemoBook } from "./planner/plan-demo-book.js";
import { PHASE1_PRODUCT_SKUS } from "./phase1-fixture.js";
import { InMemoryProductImageSeedRepository } from "./ports/in-memory-product-image-seed.js";
import { InMemorySupplierProductSeedRepository } from "./ports/in-memory-supplier-product-seed.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import { FULL_DEMO_RECONCILIATION_EXPECTATIONS } from "./reconciliation/expectations.js";
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
    organizations: new InMemoryOrganizationRepository(),
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

describe("replay sales orders (in-memory)", () => {
  it("replays the full demo sales book through use cases after PO stock is loaded", async () => {
    const plan = planDemoBook({ seed: DEFAULT_DEMO_SEED, seedToday: SEED_TODAY });
    const staticPorts = staticSeedPorts();
    const staticResult = await runWriteStaticDemoBook(staticPorts, plan, {
      staffPassword: "staff-placeholder",
      wholesalePassword: "wholesale-placeholder",
    });

    const clock = new InMemoryClock(plan.purchaseOrders[0]!.plannedInstant);
    const uow = new InMemoryUnitOfWork(clock);
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

    const replay = await runReplaySalesOrders(
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

    expect(replay.salesOrderCount).toBe(DEMO_COUNTS.salesOrders);
    expect(replay.lastSalesDocumentNumber).toBe("SO-15000");
    expect(replay.shippedCount).toBe(DEMO_COUNTS.shippedSalesOrders);
    expect(replay.lastInvoiceDocumentNumber).toBe("INV-12000");
    expect(replay.leftoverConfirmedCount).toBe(plan.leftoverConfirmedSalesOrderCount);
    expect(replay.leftoverConfirmedCount).toBeGreaterThanOrEqual(
      FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedSalesOrderMin,
    );
    expect(replay.leftoverConfirmedCount).toBeLessThanOrEqual(
      FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedSalesOrderMax,
    );
    expect(replay.leftoverDraftCount).toBe(
      DEMO_COUNTS.salesOrders - DEMO_COUNTS.shippedSalesOrders - plan.leftoverConfirmedSalesOrderCount,
    );

    const listed = await uow.salesOrders.list({
      organizationId: OrganizationId.DEFAULT,
      page: 1,
      pageSize: 20_000,
    });
    expect(listed.total).toBe(DEMO_COUNTS.salesOrders);
    expect(listed.items.every((row) => row.status !== "cancelled")).toBe(true);

    const plannedByIndex = plan.salesOrders;
    const shipInstantBySalesOrderKey = new Map(
      plan.shippedInvoices.map((row) => [row.salesOrderKey, row.plannedInstant]),
    );
    const plannedForDocumentNumber = (documentNumber: string) => {
      const sequence = Number.parseInt(documentNumber.slice(3), 10);
      return plannedByIndex[sequence - 1];
    };
    const customerKeyById = new Map(
      plan.master.customers.map((row) => {
        const customer = staticResult.customers.find((entry) => entry.name === row.name);
        return [customer!.id, row.key] as const;
      }),
    );

    const shipped = listed.items.filter((row) => row.status === "shipped");
    const confirmed = listed.items.filter((row) => row.status === "confirmed");
    const drafts = listed.items.filter((row) => row.status === "draft");

    expect(shipped).toHaveLength(DEMO_COUNTS.shippedSalesOrders);
    expect(confirmed).toHaveLength(plan.leftoverConfirmedSalesOrderCount);
    expect(drafts).toHaveLength(replay.leftoverDraftCount);

    expect(drafts.some((row) => customerKeyById.get(row.customerId) === "acme")).toBe(true);
    expect(
      listed.items.every(
        (row) =>
          customerKeyById.get(row.customerId) !== "idlePark" || row.status === "shipped",
      ),
    ).toBe(true);

    const personaCounts = new Map<string, number>();
    for (const order of listed.items) {
      const key = customerKeyById.get(order.customerId);
      if (key !== undefined) {
        personaCounts.set(key, (personaCounts.get(key) ?? 0) + 1);
      }
    }
    expect(personaCounts.get("northstar")).toBe(PERSONA_ORDER_BUDGETS.northstar);
    expect(personaCounts.get("harvest")).toBe(PERSONA_ORDER_BUDGETS.harvest);
    expect(personaCounts.get("idlePark")).toBe(PERSONA_ORDER_BUDGETS.idlePark);
    expect([...personaCounts.values()].reduce((sum, value) => sum + value, 0)).toBe(
      DEMO_COUNTS.salesOrders,
    );

    for (const order of [...confirmed, ...drafts]) {
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
      const planned = plannedForDocumentNumber(order.documentNumber);
      expect(planned).toBeDefined();
      expect(customerKeyById.get(order.customerId)).toBe(planned!.customerKey);
      expect(order.createdAt.getTime()).toBe(planned!.plannedInstant.getTime());
      expect(order.shipLine1).toBe(planned!.shipTo.line1);
      expect(order.shipCity).toBe(planned!.shipTo.city);
      expect(order.shipRegion).toBe(planned!.shipTo.region);
      expect(order.shipPostal).toBe(planned!.shipTo.postal);
      expect(order.shipCountry).toBe(planned!.shipTo.country);
    }

    for (const order of shipped) {
      expect(order.lines.every((line) => line.qty > 0)).toBe(true);
      const invoice = await uow.invoices.findByOrderId(OrganizationId.DEFAULT, order.id);
      expect(invoice).not.toBeNull();
      // In-memory omitted-tax path: AccountingCommandAdapter never writes tax lines or commits.
      expect(invoice?.taxTotal.amountMinor).toBe(0);
      const subtotal = order.lines.reduce(
        (sum, line) => sum + line.qty * line.unitPrice.amountMinor,
        0,
      );
      expect(invoice?.subtotal.amountMinor).toBe(subtotal);
      expect(invoice?.total.amountMinor).toBe(subtotal);
      expect(invoice?.total.amountMinor).toBe(invoice?.subtotal.amountMinor);
      const planned = plannedForDocumentNumber(order.documentNumber);
      const expectedPostedAt =
        shipInstantBySalesOrderKey.get(planned!.key) ?? planned!.plannedInstant;
      expect(invoice?.postedAt?.getTime()).toBe(expectedPostedAt.getTime());
    }

    const soLineCounts = listed.items.map((row) => row.lines.length);
    const soQtys = listed.items.flatMap((row) => row.lines.map((line) => line.qty));
    expect(mean(soQtys)).toBe(SO_LINE_QTY_MEAN);
    expect(soQtys.every((qty) => qty >= SO_LINE_QTY_MIN && qty <= SO_LINE_QTY_MAX)).toBe(true);

    const defaultPersonaLineCounts = listed.items
      .filter((row) => {
        const key = customerKeyById.get(row.customerId);
        return key === "acme" || key?.startsWith("mix-");
      })
      .map((row) => row.lines.length);
    if (defaultPersonaLineCounts.length > 0) {
      expect(mean(defaultPersonaLineCounts)).toBe(SO_LINE_COUNT_DEFAULT_MEAN);
    }

    const northstarLineCounts = listed.items
      .filter((row) => customerKeyById.get(row.customerId) === "northstar")
      .map((row) => row.lines.length);
    expect(
      northstarLineCounts.every(
        (count) => count >= SO_LINE_COUNT_NORTHSTAR_MIN && count <= SO_LINE_COUNT_NORTHSTAR_MAX,
      ),
    ).toBe(true);

    const idleParkLineCounts = listed.items
      .filter((row) => customerKeyById.get(row.customerId) === "idlePark")
      .map((row) => row.lines.length);
    expect(
      idleParkLineCounts.every(
        (count) => count >= SO_LINE_COUNT_IDLE_PARK_MIN && count <= SO_LINE_COUNT_IDLE_PARK_MAX,
      ),
    ).toBe(true);

    const shippedPhase1Skus = new Set<string>();
    for (const order of shipped) {
      for (const line of order.lines) {
        shippedPhase1Skus.add(line.sku.value);
      }
    }
    for (const sku of PHASE1_PRODUCT_SKUS) {
      expect(shippedPhase1Skus.has(sku)).toBe(true);
    }

    const movements = await uow.inventory.readModel.listMovements({ locationId: LocationId.DEFAULT });
    const allocated = movements.filter((row) => row.movementType === "Allocated");
    const shippedMovements = movements.filter((row) => row.movementType === "Shipped");
    const expectedAllocatedLines = plan.salesOrders
      .filter((order) => order.status !== "leftoverDraft")
      .reduce((sum, order) => sum + order.lines.length, 0);
    const expectedShippedLines = plan.salesOrders
      .filter((order) => order.status === "shipped")
      .reduce((sum, order) => sum + order.lines.length, 0);
    expect(allocated.length).toBe(expectedAllocatedLines);
    expect(shippedMovements.length).toBe(expectedShippedLines);
    expect(allocated.length).toBeGreaterThan(shippedMovements.length);

    const orderById = new Map(listed.items.map((row) => [row.id, row]));
    for (const movement of movements) {
      if (movement.refType !== "sales_order") {
        continue;
      }
      const order = orderById.get(movement.refId);
      expect(order).toBeDefined();
      const planned = plannedForDocumentNumber(order!.documentNumber);
      const shipAt = shipInstantBySalesOrderKey.get(planned!.key) ?? planned!.plannedInstant;
      const expectedInstant =
        movement.movementType === "Shipped"
          ? shipAt
          : allocateInstant(planned!.plannedInstant, shipAt, planned!.status === "shipped");
      expect(movement.createdAt.getTime()).toBe(expectedInstant.getTime());
    }

    for (const order of confirmed) {
      const allocatedForSo = allocated.filter((row) => row.refId === order.id);
      expect(allocatedForSo.length).toBe(order.lines.length);
      expect(shippedMovements.some((row) => row.refId === order.id)).toBe(false);
    }
  }, 600_000);
});
