import {
  CustomerTermsReadAdapter,
  GetCustomerAccountingSummaryUseCase,
  InMemoryAccountingUnitOfWork,
  InMemoryArCustomerReadPort,
  InMemoryCustomerArProfileReadPort,
  InMemoryLastOrderDateReadPort,
} from "@dc-inventory/accounting";
import { InMemoryProductRepository } from "@dc-inventory/catalog";
import {
  InMemoryCustomerRepository,
  InMemoryExemptionCertificateRepository,
  InMemoryShipToRepository,
} from "@dc-inventory/customers";
import { InMemoryOpenOrderExposureReadAdapter } from "@dc-inventory/sales";
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
import { OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../adapters/in-memory-unit-of-work.js";
import { planReducedDemoBook } from "./planner/plan-reduced-demo-book.js";
import { CUSTOMER_ACCOUNTING_SHOWCASE_KEY } from "./planner/customer-accounting-showcase.js";
import { DEMO_NAMED_CUSTOMERS } from "./reconciliation/expectations.js";
import {
  productNameBySkuFromPlan,
  supplierIdByKeyFromPlan,
} from "./replay-purchase-orders.js";
import {
  currencyBySkuFromPlan,
  customerIdByKeyFromPlan,
  permissiveDemoBillToSnapshotPort,
  permissiveDemoCreditCheckPort,
  taxCategoryBySkuFromPlan,
} from "./replay-sales-orders.js";
import { runReplayDemoOrders } from "./replay-demo-orders.js";
import { runReplayCustomerAccounting } from "./replay-customer-accounting.js";
import { runReplayPayments } from "./replay-payments.js";
import { runWriteStaticDemoBook } from "./write-static-demo-book.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import { InMemoryProductImageSeedRepository } from "./ports/in-memory-product-image-seed.js";
import { InMemorySupplierProductSeedRepository } from "./ports/in-memory-supplier-product-seed.js";

const SEED_TODAY = new Date("2026-08-24T15:30:00.000Z");
const AS_OF = new Date("2026-09-09T00:00:00.000Z");

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
          poPrefix: "V01",
        });
        return { id, vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER };
      },
    },
  };
}

async function copySuppliers(
  plan: ReturnType<typeof planReducedDemoBook>,
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

describe("runReplayCustomerAccounting", () => {
  it("enriches Idle Park with a full customer Accounting tab fixture", async () => {
    const plan = planReducedDemoBook(SEED_TODAY);
    const staticPorts = staticSeedPorts();
    const staticResult = await runWriteStaticDemoBook(staticPorts, plan, {
      staffPassword: "staff-placeholder",
      wholesalePassword: "wholesale-placeholder",
    });

    const clock = new InMemoryClock(plan.purchaseOrders[0]!.plannedInstant);
    const uow = new InMemoryUnitOfWork(
      permissiveDemoBillToSnapshotPort(),
      new CustomerTermsReadAdapter(staticPorts.customers),
      clock,
    );
    const accountingUow = new InMemoryAccountingUnitOfWork(uow.invoices);
    await copySuppliers(plan, staticPorts.suppliers, uow.suppliers);

    await runReplayDemoOrders(
      {
        purchasing: uow.purchasing,
        sales: uow.sales,
        clock,
        customers: staticPorts.customers,
        shipTos: staticPorts.shipTos,
        products: staticPorts.products,
        invoices: uow.invoices,
        billToSnapshot: permissiveDemoBillToSnapshotPort(),
        creditCheck: permissiveDemoCreditCheckPort(),
      },
      {
        plan,
        supplierIdByKey: await supplierIdByKeyFromPlan(plan, uow.suppliers),
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
      { plan, staffUserId: staticResult.staff.id },
    );

    const replay = await runReplayCustomerAccounting(
      {
        accountingUow,
        clock,
        customers: staticPorts.customers,
        invoices: uow.invoices,
      },
      { plan, staffUserId: staticResult.staff.id },
    );

    const customerIdByKey = await customerIdByKeyFromPlan(plan, staticPorts.customers);
    expect(replay.showcaseCustomerId).toBe(customerIdByKey.get(CUSTOMER_ACCOUNTING_SHOWCASE_KEY));
    expect(replay.eventCount).toBe(7);

    const arCustomerRead = new InMemoryArCustomerReadPort(uow.invoices);
    const customerProfiles = new InMemoryCustomerArProfileReadPort(staticPorts.customers);
    const openOrderExposure = new InMemoryOpenOrderExposureReadAdapter(uow.salesOrders);
    const lastOrderDate = new InMemoryLastOrderDateReadPort();
    const getCustomerSummary = new GetCustomerAccountingSummaryUseCase(
      arCustomerRead,
      customerProfiles,
      openOrderExposure,
      lastOrderDate,
    );

    const summary = await getCustomerSummary.execute({
      organizationId: OrganizationId.DEFAULT,
      customerId: replay.showcaseCustomerId,
      asOf: AS_OF,
    });

    const statuses = new Set(summary.openInvoices.map((row) => row.status));
    expect(statuses.has("open")).toBe(true);
    expect(statuses.has("past_due")).toBe(true);
    expect(
      summary.openInvoices.some(
        (row) =>
          row.remainingCents > 0 && row.remainingCents < row.invoice.total.amountMinor,
      ),
    ).toBe(true);

    expect(summary.unappliedCreditCents).toBe(75_000);
    expect(summary.plan).not.toBeNull();
    expect(summary.planExpectations?.installmentsExpectedSoFar).toBeGreaterThan(0);
    expect(summary.stats.creditMemoCount).toBe(1);
    expect(summary.recentPayments.some((row) => row.voided)).toBe(true);
    expect(summary.recentPayments.some((row) => row.unappliedCents > 0)).toBe(true);

    const idlePark = await staticPorts.customers.findByName(
      OrganizationId.DEFAULT,
      DEMO_NAMED_CUSTOMERS.idlePark.name,
    );
    expect(idlePark?.name).toBe("Idle Park Distributors");
  });
});
