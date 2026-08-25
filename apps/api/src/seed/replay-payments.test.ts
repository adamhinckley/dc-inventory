import {
  InMemoryAccountingUnitOfWork,
  computeRemainingCents,
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
import { SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../adapters/in-memory-unit-of-work.js";
import {
  DEMO_COUNTS,
  DEFAULT_DEMO_SEED,
  PERSONA_ORDER_BUDGETS,
} from "./planner/constants.js";
import { planDemoBook } from "./planner/plan-demo-book.js";
import { selectPaymentReplay, selectUnpaidReplay } from "./planner/payments.js";
import { InMemoryProductImageSeedRepository } from "./ports/in-memory-product-image-seed.js";
import { InMemorySupplierProductSeedRepository } from "./ports/in-memory-supplier-product-seed.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import { DEMO_AR_BUCKETS, DEMO_NAMED_CUSTOMERS } from "./reconciliation/expectations.js";
import {
  demoArBucket,
  utcDayDiff,
} from "./reconciliation/assert-demo-book.js";
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
import { buildSalesOrderIdByPlanKey, runReplayPayments } from "./replay-payments.js";
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

describe("replay payments (in-memory)", () => {
  it("replays the demo payment book through RecordPaymentUseCase after sales invoices exist", async () => {
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

    const replay = await runReplayPayments(
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

    expect(replay.paymentCount).toBe(DEMO_COUNTS.payments);
    expect(selectPaymentReplay(plan.shippedInvoices)).toHaveLength(DEMO_COUNTS.payments);
    expect(selectUnpaidReplay(plan.shippedInvoices)).toHaveLength(DEMO_COUNTS.unpaidInvoices);

    const salesOrderIdByKey = await buildSalesOrderIdByPlanKey(plan, uow.salesOrders);
    const customerKeyById = new Map(
      staticResult.customers.map((row) => {
        const planned = plan.master.customers.find((entry) => entry.name === row.name);
        return [row.id, planned!.key] as const;
      }),
    );

    const paidInvoiceKeys = new Set(selectPaymentReplay(plan.shippedInvoices));
    const unpaidInvoiceKeys = new Set(selectUnpaidReplay(plan.shippedInvoices));
    const paymentsSeen = new Set<string>();
    const invoicesPaid = new Set<string>();
    let paidCount = 0;
    let unpaidCount = 0;

    for (const planned of plan.shippedInvoices) {
      const orderId = salesOrderIdByKey.get(planned.salesOrderKey);
      expect(orderId).toBeDefined();
      const invoice = await uow.invoices.findByOrderId(orderId!);
      expect(invoice).not.toBeNull();

      const applications = await uow.invoices.listApplications(invoice!.id);
      const remaining = computeRemainingCents(invoice!, applications);

      if (paidInvoiceKeys.has(planned.key)) {
        paidCount += 1;
        expect(remaining).toBe(0);
        expect(applications).toHaveLength(1);
        expect(applications[0]!.amount.amountMinor).toBe(invoice!.total.amountMinor);

        const paymentRecord = await uow.invoices.findPaymentByIdempotencyKey(
          `demo:${planned.key}:payment`,
        );
        expect(paymentRecord).not.toBeNull();
        expect(paymentsSeen.has(paymentRecord!.payment.id)).toBe(false);
        paymentsSeen.add(paymentRecord!.payment.id);
        expect(invoicesPaid.has(invoice!.id)).toBe(false);
        invoicesPaid.add(invoice!.id);
        expect(paymentRecord!.payment.customerId).toBe(invoice!.customerId);
        expect(paymentRecord!.payment.amount.amountMinor).toBe(invoice!.total.amountMinor);
        expect(paymentRecord!.payment.createdAt.getTime()).toBe(invoice!.postedAt!.getTime());
        expect(applications[0]!.createdAt.getTime()).toBe(invoice!.postedAt!.getTime());
        expect(invoice!.postedAt?.getTime()).toBe(planned.plannedInstant.getTime());
      } else {
        unpaidCount += 1;
        expect(applications).toHaveLength(0);
        expect(remaining).toBe(invoice!.total.amountMinor);
        expect(
          await uow.invoices.findPaymentByIdempotencyKey(`demo:${planned.key}:payment`),
        ).toBeNull();
      }
    }

    expect(paidCount).toBe(DEMO_COUNTS.payments);
    expect(unpaidCount).toBe(DEMO_COUNTS.unpaidInvoices);
    expect(paymentsSeen.size).toBe(DEMO_COUNTS.payments);

    const idleParkUnpaid = plan.shippedInvoices.filter(
      (row) => row.customerKey === "idlePark" && !row.paid,
    );
    expect(idleParkUnpaid).toHaveLength(PERSONA_ORDER_BUDGETS.idlePark);
    for (const persona of ["acme", "northstar", "harvest"] as const) {
      expect(plan.shippedInvoices.some((row) => row.customerKey === persona && !row.paid)).toBe(
        false,
      );
    }

    const mixUnpaidKeys = new Set(
      plan.shippedInvoices
        .filter((row) => row.customerKey.startsWith("mix-") && !row.paid)
        .map((row) => row.key),
    );
    expect(mixUnpaidKeys.size).toBe(DEMO_COUNTS.mixUnpaidInvoices);
    const expectedMixUnpaidKeys = [...plan.shippedInvoices]
      .filter((row) => row.customerKey.startsWith("mix-"))
      .sort((left, right) => {
        const byInstant = right.plannedInstant.getTime() - left.plannedInstant.getTime();
        if (byInstant !== 0) {
          return byInstant;
        }
        return right.replaySequence - left.replaySequence;
      })
      .slice(0, DEMO_COUNTS.mixUnpaidInvoices)
      .map((row) => row.key);
    expect([...mixUnpaidKeys].sort()).toEqual([...expectedMixUnpaidKeys].sort());
    for (const key of unpaidInvoiceKeys) {
      const row = plan.shippedInvoices.find((invoice) => invoice.key === key);
      expect(row).toBeDefined();
      expect(row!.customerKey === "idlePark" || row!.customerKey.startsWith("mix-")).toBe(true);
    }

    const idleParkCustomerId = staticResult.customers.find(
      (row) => row.name === DEMO_NAMED_CUSTOMERS.idlePark.name,
    )!.id;
    const persistedIdleParkBuckets = new Set<string>();
    const persistedUnpaidBuckets = new Set<string>();
    for (const planned of plan.shippedInvoices.filter((row) => !row.paid)) {
      const invoice = await uow.invoices.findByOrderId(
        salesOrderIdByKey.get(planned.salesOrderKey)!,
      );
      expect(invoice).not.toBeNull();
      expect(invoice!.postedAt).not.toBeNull();
      const bucket = demoArBucket(utcDayDiff(invoice!.postedAt!, SEED_TODAY));
      persistedUnpaidBuckets.add(bucket);
      if (invoice!.customerId === idleParkCustomerId) {
        persistedIdleParkBuckets.add(bucket);
        expect(invoice!.postedAt!.getTime()).toBe(planned.plannedInstant.getTime());
      }
    }
    for (const bucket of DEMO_AR_BUCKETS) {
      expect(persistedIdleParkBuckets.has(bucket)).toBe(true);
      expect(persistedUnpaidBuckets.has(bucket)).toBe(true);
    }

    for (const invoice of plan.shippedInvoices) {
      const customerKey = customerKeyById.get(
        (await uow.invoices.findByOrderId(salesOrderIdByKey.get(invoice.salesOrderKey)!))!
          .customerId,
      );
      if (customerKey === "idlePark") {
        expect(invoice.paid).toBe(false);
      }
      if (customerKey === "acme" || customerKey === "northstar" || customerKey === "harvest") {
        expect(invoice.paid).toBe(true);
      }
    }

  }, 600_000);
});
