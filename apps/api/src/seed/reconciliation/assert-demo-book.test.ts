import { describe, expect, it } from "vitest";
import {
  assertDemoBook,
  DEMO_RECONCILIATION_CONTRACTS,
  type DemoReconciliationContract,
} from "./assert-demo-book.js";
import type { DemoBook } from "./demo-book.js";
import { InMemoryDemoBookReader } from "./in-memory-demo-book-reader.js";
import {
  buildValidReducedDemoBook,
  REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
  reducedDemoSeedToday,
} from "./valid-reduced-demo-book.js";

function cloneBook(): DemoBook {
  return structuredClone(buildValidReducedDemoBook());
}

async function reconcile(book: DemoBook) {
  return assertDemoBook(new InMemoryDemoBookReader(book), {
    seedToday: reducedDemoSeedToday(),
    expectations: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
  });
}

function product(book: DemoBook, sku: string) {
  const row = book.products.find((item) => item.sku === sku);
  if (!row) {
    throw new Error(`missing ${sku}`);
  }
  return row;
}

const breaks: Array<{
  contract: DemoReconciliationContract;
  mutate: (book: DemoBook) => void;
}> = [
  {
    contract: "product_count",
    mutate: (book) => {
      book.products.pop();
    },
  },
  {
    contract: "supplier_count",
    mutate: (book) => {
      book.suppliers.pop();
    },
  },
  {
    contract: "customer_count",
    mutate: (book) => {
      book.customers.pop();
    },
  },
  {
    contract: "purchase_order_count",
    mutate: (book) => {
      book.purchaseOrders.pop();
    },
  },
  {
    contract: "sales_order_count",
    mutate: (book) => {
      book.salesOrders.pop();
    },
  },
  {
    contract: "invoice_count",
    mutate: (book) => {
      book.invoices.pop();
    },
  },
  {
    contract: "payment_count",
    mutate: (book) => {
      book.payments.pop();
    },
  },
  {
    contract: "image_count",
    mutate: (book) => {
      book.images.pop();
    },
  },
  {
    contract: "supplier_product_count",
    mutate: (book) => {
      book.supplierProducts.pop();
    },
  },
  {
    contract: "reorder_policy_count",
    mutate: (book) => {
      book.reorderPolicies.pop();
    },
  },
  {
    contract: "document_number_format",
    mutate: (book) => {
      const po = book.purchaseOrders[0];
      if (po) {
        po.documentNumber = "PO-1";
      }
    },
  },
  {
    contract: "document_number_endpoints",
    mutate: (book) => {
      const po = book.purchaseOrders.find(
        (row) => row.supplierId === "sup-003" && row.status === "confirmed",
      );
      if (po) {
        po.documentNumber = "PO-V03-00099";
      }
    },
  },
  {
    contract: "phase1_fixture_preservation",
    mutate: (book) => {
      product(book, "HEX-BOLT-GALV").name = "Drifted hex bolt";
    },
  },
  {
    contract: "identity_rows",
    mutate: (book) => {
      const staff = book.staffUsers[0];
      if (staff) {
        staff.email = "other@local.test";
      }
    },
  },
  {
    contract: "named_customer_fields",
    mutate: (book) => {
      const northstar = book.customers.find((row) => row.name === "Northstar Big Box");
      if (northstar) {
        northstar.creditLimitCents = 1;
      }
    },
  },
  {
    contract: "default_ship_tos",
    mutate: (book) => {
      const acme = book.shipTos.find((row) => row.customerId === "cust-acme");
      if (acme) {
        acme.line1 = "999 Wrong St";
      }
    },
  },
  {
    contract: "shop_visibility",
    mutate: (book) => {
      product(book, "DEM-00001").webWholesale = false;
    },
  },
  {
    contract: "tax_category_metadata",
    mutate: (book) => {
      product(book, "DEM-00001").taxCategoryCode = null;
    },
  },
  {
    contract: "image_key_format",
    mutate: (book) => {
      const image = book.images[0];
      if (image) {
        image.productId = "prod-missing";
      }
    },
  },
  {
    contract: "unique_names",
    mutate: (book) => {
      product(book, "DEM-00002").name = product(book, "DEM-00001").name;
    },
  },
  {
    contract: "no_mix_persona_contacts",
    mutate: (book) => {
      book.contacts.push({
        customerId: "cust-mix-a",
        name: "Pat Mix",
        email: "pat@mix.test",
      });
    },
  },
  {
    contract: "no_extra_users",
    mutate: (book) => {
      book.opsUsers.push({ id: "ops-1", email: "ops@local.test" });
    },
  },
  {
    contract: "vendor_partition",
    mutate: (book) => {
      const assignment = book.supplierProducts.find((row) => row.sku === "DEM-00002");
      if (assignment) {
        assignment.sku = "DEM-00001";
      }
    },
  },
  {
    contract: "repeated_sku",
    mutate: (book) => {
      const line = book.purchaseOrderLines.find((row) => row.purchaseOrderId === "po-1");
      if (line) {
        book.purchaseOrderLines.push({ ...line });
      }
    },
  },
  {
    contract: "stock_from_movements",
    mutate: (book) => {
      const snapshot = book.snapshots[0];
      if (snapshot) {
        snapshot.onHand += 50;
      }
    },
  },
  {
    contract: "invoice_totals",
    mutate: (book) => {
      const invoice = book.invoices[0];
      if (invoice) {
        invoice.taxTotalCents = 1;
      }
    },
  },
  {
    contract: "omitted_tax",
    mutate: (book) => {
      book.taxCommits.push({
        id: "tax-1",
        invoiceId: "inv-so-5",
        organizationId: "DEFAULT",
      });
    },
  },
  {
    contract: "invoice_remainder",
    mutate: (book) => {
      const application = book.paymentApplications[0];
      if (application) {
        application.amountCents = Math.max(1, application.amountCents - 1);
      }
    },
  },
  {
    contract: "payment_completeness",
    mutate: (book) => {
      const newestMix = book.invoices.find((row) => row.id === "inv-so-12");
      const application = book.paymentApplications.find((row) => row.invoiceId === "inv-so-11");
      const payment = book.payments.find((row) => row.id === application?.paymentId);
      if (newestMix && application && payment) {
        application.invoiceId = newestMix.id;
        application.amountCents = newestMix.totalCents;
        payment.amountCents = newestMix.totalCents;
      }
    },
  },
  {
    contract: "named_customer_payments",
    mutate: (book) => {
      const idleUnpaid = book.invoices.find((row) => row.id === "inv-so-3");
      const application = book.paymentApplications.find((row) => row.invoiceId === "inv-so-9");
      const payment = book.payments.find((row) => row.id === application?.paymentId);
      if (idleUnpaid && application && payment) {
        application.invoiceId = idleUnpaid.id;
        application.amountCents = idleUnpaid.totalCents;
        payment.amountCents = idleUnpaid.totalCents;
        payment.customerId = idleUnpaid.customerId;
      }
    },
  },
  {
    contract: "ar_age_buckets",
    mutate: (book) => {
      const ninety = book.invoices.find((row) => row.id === "inv-so-4");
      if (ninety) {
        ninety.postedAt = new Date("2026-08-20T00:00:00.000Z");
      }
    },
  },
  {
    contract: "idle_park_aged_ar",
    mutate: (book) => {
      const idleNinety = book.invoices.find((row) => row.id === "inv-so-4");
      const mixPaid = book.invoices.find((row) => row.id === "inv-so-11");
      const mixUnpaid = book.invoices.find((row) => row.id === "inv-so-12");
      if (idleNinety) {
        idleNinety.postedAt = new Date("2026-08-20T00:00:00.000Z");
      }
      if (mixUnpaid) {
        mixUnpaid.postedAt = new Date("2026-05-16T00:00:00.000Z");
      }
      if (mixPaid) {
        mixPaid.postedAt = new Date("2026-05-15T00:00:00.000Z");
      }
    },
  },
  {
    contract: "open_document_mix",
    mutate: (book) => {
      const leftover = book.salesOrders.find((row) => row.id === "so-13");
      if (leftover) {
        leftover.status = "shipped";
      }
    },
  },
  {
    contract: "leftover_recency",
    mutate: (book) => {
      const draft = book.salesOrders.find((row) => row.id === "so-15");
      if (draft) {
        draft.createdAt = new Date("2026-06-01T00:00:00.000Z");
      }
    },
  },
  {
    contract: "acme_draft",
    mutate: (book) => {
      for (const row of book.salesOrders) {
        if (row.customerId === "cust-acme" && row.status === "draft") {
          row.customerId = "cust-mix-b";
        }
      }
    },
  },
  {
    contract: "idle_park_open_pipeline",
    mutate: (book) => {
      const draft = book.salesOrders.find((row) => row.id === "so-19");
      if (draft) {
        draft.customerId = "cust-idle";
      }
    },
  },
  {
    contract: "low_stock",
    mutate: (book) => {
      for (const policy of book.reorderPolicies) {
        policy.minOnHand = 0;
        const leftover =
          book.snapshots.find((row) => row.sku === policy.sku)?.onHand ?? 0;
        policy.maxOnHand = Math.max(12, leftover);
      }
    },
  },
];

describe("Demo reconciliation", () => {
  it("accepts a valid reduced book", async () => {
    const result = await reconcile(buildValidReducedDemoBook());
    expect(result).toEqual({ ok: true });
  });

  it("covers every named contract with a break case", () => {
    expect([...new Set(breaks.map((row) => row.contract))].sort()).toEqual(
      [...DEMO_RECONCILIATION_CONTRACTS].sort(),
    );
  });

  it.each(breaks)("names $contract on the smallest relevant mismatch", async ({ contract, mutate }) => {
    const book = cloneBook();
    mutate(book);
    const result = await reconcile(book);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.contract).toBe(contract);
    }
  });
});
