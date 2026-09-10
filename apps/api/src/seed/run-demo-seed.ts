import {
  CustomerTermsReadAdapter,
  InMemoryAccountingUnitOfWork,
  InMemoryArCustomerReadPort,
  InMemoryCustomerArProfileReadPort,
  InMemoryLastOrderDateReadPort,
} from "@dc-inventory/accounting";
import { InMemoryOpenOrderExposureReadAdapter } from "@dc-inventory/sales";
import { InMemoryClock, InMemorySupplierRepository, type ISupplierRepository } from "@dc-inventory/purchasing";
import {
  PHASE2_DEFAULT_LOCATION_CODE,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import { plannedSupplierPoPrefix } from "./planner/master-data.js";
import { LocationId, OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";
import { InMemoryUnitOfWork } from "../adapters/in-memory-unit-of-work.js";
import type { DemoSeedDeadline } from "./demo-seed-deadline.js";
import type { DemoSeedProgressReporter } from "./demo-seed-progress.js";
import type { DemoBookPlan } from "./planner/types.js";
import { InMemoryProductImageSeedRepository } from "./ports/in-memory-product-image-seed.js";
import { InMemoryReorderPolicySeedRepository } from "./ports/in-memory-reorder-policy-seed.js";
import { InMemorySupplierProductSeedRepository } from "./ports/in-memory-supplier-product-seed.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import { assertDemoBook } from "./reconciliation/assert-demo-book.js";
import type { DemoReconciliationExpectations } from "./reconciliation/expectations.js";
import {
  FULL_DEMO_RECONCILIATION_EXPECTATIONS,
  demoExpectationsWithSalesOrderDraftSpill,
} from "./reconciliation/expectations.js";
import { InMemoryDemoBookLoader, type InMemoryDemoBookLoadPorts } from "./reconciliation/in-memory-demo-book-loader.js";
import type { DemoReconciliationResult } from "./reconciliation/contracts.js";
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
import { assertCustomerAccountingShowcase } from "./assert-customer-accounting-showcase.js";
import { runReplayCustomerAccounting } from "./replay-customer-accounting.js";
import { runReplayPayments } from "./replay-payments.js";
import type { Phase1SeedSecrets } from "./run-phase1-seed.js";
import { runWriteReorderPolicies } from "./write-reorder-policies.js";
import { runWriteStaticDemoBook } from "./write-static-demo-book.js";
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
import { InMemoryProductRepository } from "@dc-inventory/catalog";

export type RunDemoSeedInMemoryInput = {
  plan: DemoBookPlan;
  secrets: Phase1SeedSecrets;
  onProgress?: DemoSeedProgressReporter;
  deadline?: DemoSeedDeadline;
  expectations?: DemoReconciliationExpectations;
};

export type RunDemoSeedInMemoryResult = {
  reconciliation: DemoReconciliationResult;
  defaultLocationId: string;
};

function tick(
  input: RunDemoSeedInMemoryInput,
  stage: Parameters<NonNullable<DemoSeedProgressReporter>>[0],
): void {
  input.deadline?.assertWithinBudget();
  input.onProgress?.(stage);
}

function staticSeedPortsForDemo(): StaticDemoSeedPorts & {
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
          poPrefix: plannedSupplierPoPrefix(PHASE2_SUPPLIER_VENDOR_NUMBER),
        });
        return { id, vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER };
      },
    },
  };
}

async function copySuppliers(
  plan: DemoBookPlan,
  from: Pick<ISupplierRepository, "findByVendorNumber">,
  to: ISupplierRepository,
): Promise<void> {
  for (const planned of plan.master.suppliers) {
    const supplier = await from.findByVendorNumber(OrganizationId.DEFAULT, planned.vendorNumber);
    if (supplier !== null) {
      await to.save(supplier);
    }
  }
}

export async function runDemoSeedInMemory(
  input: RunDemoSeedInMemoryInput,
): Promise<RunDemoSeedInMemoryResult> {
  const staticPorts = staticSeedPortsForDemo();
  const assertWithinBudget = (): void => {
    input.deadline?.assertWithinBudget();
  };

  tick(input, "static master data");
  const staticResult = await runWriteStaticDemoBook(staticPorts, input.plan, input.secrets);

  const clock = new InMemoryClock(input.plan.purchaseOrders[0]!.plannedInstant);
  const uow = new InMemoryUnitOfWork(
    permissiveDemoBillToSnapshotPort(),
    new CustomerTermsReadAdapter(staticPorts.customers),
    clock,
  );
  const accountingUow = new InMemoryAccountingUnitOfWork(uow.invoices);
  await copySuppliers(input.plan, staticPorts.suppliers, uow.suppliers);

  tick(input, "order playback");
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
      plan: input.plan,
      supplierIdByKey: await supplierIdByKeyFromPlan(input.plan, uow.suppliers),
      customerIdByKey: await customerIdByKeyFromPlan(input.plan, staticPorts.customers),
      productNameBySku: productNameBySkuFromPlan(input.plan),
      currencyBySku: currencyBySkuFromPlan(input.plan),
      taxCategoryBySku: taxCategoryBySkuFromPlan(input.plan),
      staffUserId: staticResult.staff.id,
      assertWithinBudget,
    },
  );

  tick(input, "payment playback");
  await runReplayPayments(
    {
      accountingUow,
      clock,
      salesOrders: uow.salesOrders,
      invoices: uow.invoices,
    },
    {
      plan: input.plan,
      staffUserId: staticResult.staff.id,
      assertWithinBudget,
    },
  );

  tick(input, "reorder policies");
  const reorderPolicies = new InMemoryReorderPolicySeedRepository();
  const defaultLocationId = LocationId.DEFAULT;
  await runWriteReorderPolicies(
    {
      products: staticPorts.products,
      inventoryReadModel: uow.inventory.readModel,
      reorderPolicies,
    },
    {
      plan: input.plan,
      locationId: defaultLocationId,
      expectations: input.expectations,
    },
  );

  tick(input, "reconciliation");
  const reconciliation = await assertDemoBook(
    new InMemoryDemoBookLoader({
      defaultLocationId,
      staffEmail: input.plan.master.staffEmail,
      wholesaleEmails: [
        input.plan.master.wholesaleEmail,
        input.plan.master.secondaryWholesaleEmail,
      ],
      products: staticPorts.products,
      productImages: staticPorts.productImages,
      suppliers: staticPorts.suppliers as unknown as InMemoryDemoBookLoadPorts["suppliers"],
      supplierProducts: staticPorts.supplierProducts,
      customers: staticPorts.customers,
      shipTos: staticPorts.shipTos,
      exemptionCertificates: staticPorts.exemptionCertificates,
      staffUsers: staticPorts.staffUsers,
      wholesaleUsers: staticPorts.wholesaleUsers,
      purchaseOrders: uow.purchaseOrders,
      salesOrders: uow.salesOrders,
      invoices: uow.invoices,
      readModel: uow.inventory.readModel,
      reorderPolicies,
    }),
    {
      seedToday: input.plan.seedToday,
      expectations:
        input.expectations ??
        demoExpectationsWithSalesOrderDraftSpill(
          FULL_DEMO_RECONCILIATION_EXPECTATIONS,
          input.plan.salesOrderDraftSpillToShipped,
        ),
    },
  );
  if (!reconciliation.ok) {
    throw new Error(reconciliation.message);
  }

  tick(input, "customer accounting playback");
  const showcaseReplay = await runReplayCustomerAccounting(
    {
      accountingUow,
      clock,
      customers: staticPorts.customers,
      invoices: uow.invoices,
    },
    {
      plan: input.plan,
      staffUserId: staticResult.staff.id,
      assertWithinBudget,
    },
  );

  tick(input, "customer accounting showcase validation");
  const showcaseAssertion = await assertCustomerAccountingShowcase(
    {
      arCustomerRead: new InMemoryArCustomerReadPort(uow.invoices),
      customerProfiles: new InMemoryCustomerArProfileReadPort(staticPorts.customers),
      openOrderExposure: new InMemoryOpenOrderExposureReadAdapter(uow.salesOrders),
      lastOrderDate: new InMemoryLastOrderDateReadPort(),
    },
    {
      customerId: showcaseReplay.showcaseCustomerId,
      asOf: input.plan.seedToday,
    },
  );
  if (!showcaseAssertion.ok) {
    throw new Error(showcaseAssertion.message);
  }

  input.deadline?.assertWithinBudget();

  return {
    reconciliation,
    defaultLocationId,
  };
}

/** Test-only export: in-memory ports for static demo seed wiring. */
export { staticSeedPortsForDemo };
