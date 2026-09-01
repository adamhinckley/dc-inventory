import {
  PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
  PHASE1_CUSTOMER_CURRENCY,
  PHASE1_CUSTOMER_NAME,
  PHASE1_CUSTOMER_TERMS,
  PHASE1_PRODUCTS,
  PHASE1_STAFF_EMAIL,
  PHASE1_WHOLESALE_EMAIL,
} from "../phase1-fixture.js";
import type { DemoBook, DemoMovementRow, DemoSnapshotRow } from "./demo-book.js";
import { DEMO_NAMED_CUSTOMERS, type DemoReconciliationExpectations } from "./expectations.js";
import { recomputeStockFromMovements, stockKey } from "./stock-from-movements.js";

/** Reduced in-memory book for reconciliation tests. Not a public seed profile. */

const LOCATION = "loc-default";
const SEED_TODAY = new Date("2026-08-24T15:30:00.000Z");
const LEFTOVER_DAY_SEVEN = new Date("2026-08-17T00:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(SEED_TODAY.getTime() - days * 86_400_000);
}

function pad(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

const GENERATED_PRODUCTS = [
  { sku: "DEM-00001", name: "Grade 5 hex cap", memberPriceCents: 100 },
  { sku: "DEM-00002", name: "Steel fender washer", memberPriceCents: 200 },
  { sku: "DEM-00003", name: "Coarse mill stud", memberPriceCents: 300 },
] as const;

export const REDUCED_DEMO_RECONCILIATION_EXPECTATIONS: DemoReconciliationExpectations = {
  productCount: 8,
  supplierCount: 3,
  customerCount: 6,
  purchaseOrderCount: 10,
  salesOrderCount: 20,
  invoiceCount: 12,
  paymentCount: 7,
  imageCount: 8,
  supplierProductCount: 8,
  reorderPolicyCount: 8,
  shippedSalesOrderCount: 12,
  unpaidInvoiceCount: 5,
  leftoverConfirmedSalesOrderMin: 1,
  leftoverConfirmedSalesOrderMax: 2,
  leftoverConfirmedPurchaseOrderMin: 1,
  leftoverConfirmedPurchaseOrderMax: 2,
  leftoverWindowDays: 7,
  lowStockMin: 2,
  lowStockMax: 4,
  exemptionCertificateCount: 5,
  supplierSkuMin: 1,
  supplierSkuMax: 5,
  mixCustomerCreditLimitCents: 1_000_000,
  customerTerms: PHASE1_CUSTOMER_TERMS,
  customerCurrency: PHASE1_CUSTOMER_CURRENCY,
};

export function reducedDemoSeedToday(): Date {
  return new Date(SEED_TODAY);
}

export function buildValidReducedDemoBook(): DemoBook {
  const products: DemoBook["products"] = [
    ...PHASE1_PRODUCTS.map((row) => ({
      id: `prod-${row.sku}`,
      sku: row.sku,
      name: row.name,
      description: null,
      uom: row.uom,
      memberPriceCents: row.memberPriceCents,
      listPriceCents: null,
      currency: row.currency,
      webWholesale: true,
      taxCategoryCode: "TANGIBLE",
    })),
    ...GENERATED_PRODUCTS.map((row) => ({
      id: `prod-${row.sku}`,
      sku: row.sku,
      name: row.name,
      description: null,
      uom: "EA",
      memberPriceCents: row.memberPriceCents,
      listPriceCents: null,
      currency: "USD" as const,
      webWholesale: true,
      taxCategoryCode: "TANGIBLE",
    })),
  ];

  const images = products.map((row) => ({
    productId: row.id,
    sku: row.sku,
    objectKey: `demo/catalog/${row.sku}.jpg`,
    contentType: "image/jpeg",
  }));

  const suppliers = [
    { id: "sup-001", vendorNumber: "VEND-001", name: "Demo Supplier" },
    { id: "sup-002", vendorNumber: "VEND-002", name: "Northern mill" },
    { id: "sup-003", vendorNumber: "VEND-003", name: "Summit mill" },
  ];

  const supplierProducts = [
    ...PHASE1_PRODUCTS.map((row) => ({
      supplierId: "sup-001",
      sku: row.sku,
      minOrderQty: null,
    })),
    { supplierId: "sup-002", sku: "DEM-00001", minOrderQty: null },
    { supplierId: "sup-002", sku: "DEM-00002", minOrderQty: null },
    { supplierId: "sup-003", sku: "DEM-00003", minOrderQty: null },
  ];

  const customers = [
    {
      id: "cust-acme",
      name: PHASE1_CUSTOMER_NAME,
      creditLimitCents: PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
      currency: PHASE1_CUSTOMER_CURRENCY,
      terms: PHASE1_CUSTOMER_TERMS,
    },
    {
      id: "cust-northstar",
      name: DEMO_NAMED_CUSTOMERS.northstar.name,
      creditLimitCents: DEMO_NAMED_CUSTOMERS.northstar.creditLimitCents,
      currency: "USD",
      terms: PHASE1_CUSTOMER_TERMS,
    },
    {
      id: "cust-harvest",
      name: DEMO_NAMED_CUSTOMERS.harvest.name,
      creditLimitCents: DEMO_NAMED_CUSTOMERS.harvest.creditLimitCents,
      currency: "USD",
      terms: PHASE1_CUSTOMER_TERMS,
    },
    {
      id: "cust-idle",
      name: DEMO_NAMED_CUSTOMERS.idlePark.name,
      creditLimitCents: DEMO_NAMED_CUSTOMERS.idlePark.creditLimitCents,
      currency: "USD",
      terms: PHASE1_CUSTOMER_TERMS,
    },
    {
      id: "cust-mix-a",
      name: "Lakeside Hardware Co.",
      creditLimitCents: 1_000_000,
      currency: "USD",
      terms: PHASE1_CUSTOMER_TERMS,
    },
    {
      id: "cust-mix-b",
      name: "Prairie Fastener Supply",
      creditLimitCents: 1_000_000,
      currency: "USD",
      terms: PHASE1_CUSTOMER_TERMS,
    },
  ];

  const shipTos = [
    ship("ship-acme", "cust-acme", DEMO_NAMED_CUSTOMERS.acme.ship),
    ship("ship-northstar", "cust-northstar", DEMO_NAMED_CUSTOMERS.northstar.ship),
    ship("ship-harvest", "cust-harvest", DEMO_NAMED_CUSTOMERS.harvest.ship),
    ship("ship-idle", "cust-idle", DEMO_NAMED_CUSTOMERS.idlePark.ship),
    ship("ship-mix-a", "cust-mix-a", {
      line1: "10 Cedar St",
      city: "Boise",
      region: "ID",
      postal: "83702",
    }),
    ship("ship-mix-b", "cust-mix-b", {
      line1: "200 Pine Ave",
      city: "Denver",
      region: "CO",
      postal: "80202",
    }),
  ];

  const exemptionCertificates = customers
    .filter((row) => row.id !== "cust-idle")
    .map((row) => {
      const shipTo = shipTos.find((item) => item.customerId === row.id);
      return {
        customerId: row.id,
        objectKey: null,
        jurisdiction: shipTo?.region ?? "UT",
        entityUseCode: "RESALE",
        expiresAt: daysAgo(-365),
        status: "active",
      };
    });

  const receivedSkus = [
    "HEX-BOLT-GALV",
    "WASHER-SS-PACK",
    "LOCK-NUT-NYL",
    "FLAT-WASHER-ZINC",
    "COUPLING-NUT-GR8",
    "DEM-00001",
    "DEM-00002",
    "DEM-00003",
    "HEX-BOLT-GALV",
  ] as const;

  const supplierForSku: Record<string, string> = {
    "HEX-BOLT-GALV": "sup-001",
    "WASHER-SS-PACK": "sup-001",
    "LOCK-NUT-NYL": "sup-001",
    "FLAT-WASHER-ZINC": "sup-001",
    "COUPLING-NUT-GR8": "sup-001",
    "DEM-00001": "sup-002",
    "DEM-00002": "sup-002",
    "DEM-00003": "sup-003",
  };

  const purchaseOrders: DemoBook["purchaseOrders"] = receivedSkus.map((sku, index) => ({
    id: `po-${String(index + 1)}`,
    supplierId: supplierForSku[sku] ?? "sup-001",
    status: "received" as const,
    documentNumber: pad("PO", index + 1),
    createdAt: daysAgo(200 - index),
  }));
  purchaseOrders.push({
    id: "po-10",
    supplierId: "sup-003",
    status: "confirmed",
    documentNumber: pad("PO", 10),
    createdAt: LEFTOVER_DAY_SEVEN,
  });

  const purchaseOrderLines: DemoBook["purchaseOrderLines"] = [
    ...receivedSkus.map((sku, index) => ({
      purchaseOrderId: `po-${String(index + 1)}`,
      sku,
      qty: 12,
      receivedQty: 12,
    })),
    { purchaseOrderId: "po-10", sku: "DEM-00003", qty: 6, receivedQty: 0 },
  ];

  const priceBySku = new Map(products.map((row) => [row.sku, row.memberPriceCents]));

  type ShippedSpec = {
    id: string;
    customerId: string;
    sku: string;
    postedDaysAgo: number;
    documentNumber: string;
    invoiceNumber: string;
    paid: boolean;
  };

  const shipped: ShippedSpec[] = [
    shipSpec("so-1", "cust-idle", "HEX-BOLT-GALV", 10, 1, true),
    shipSpec("so-2", "cust-idle", "WASHER-SS-PACK", 40, 2, true),
    shipSpec("so-3", "cust-idle", "LOCK-NUT-NYL", 70, 3, true),
    shipSpec("so-4", "cust-idle", "FLAT-WASHER-ZINC", 100, 4, true),
    shipSpec("so-5", "cust-acme", "COUPLING-NUT-GR8", 30, 5, false),
    shipSpec("so-6", "cust-acme", "DEM-00001", 31, 6, false),
    shipSpec("so-7", "cust-northstar", "DEM-00001", 32, 7, false),
    shipSpec("so-8", "cust-northstar", "DEM-00002", 33, 8, false),
    shipSpec("so-9", "cust-harvest", "DEM-00002", 34, 9, false),
    shipSpec("so-10", "cust-harvest", "DEM-00003", 35, 10, false),
    shipSpec("so-11", "cust-mix-a", "DEM-00003", 20, 11, false),
    shipSpec("so-12", "cust-mix-a", "HEX-BOLT-GALV", 5, 12, true),
  ];

  // Idle Park all unpaid (paid=false). Mix unpaid is the newest mix invoice (so-12).
  // Recompute paid flags: idle 1-4 unpaid, mix so-12 unpaid, rest paid.
  for (const row of shipped) {
    row.paid = !(row.customerId === "cust-idle" || row.id === "so-12");
  }

  const salesOrders: DemoBook["salesOrders"] = [
    ...shipped.map((row) =>
      salesOrder(row.id, row.customerId, "shipped", row.documentNumber, daysAgo(row.postedDaysAgo)),
    ),
    salesOrder("so-13", "cust-acme", "confirmed", pad("SO", 13), daysAgo(1)),
    salesOrder("so-14", "cust-northstar", "confirmed", pad("SO", 14), daysAgo(1)),
    salesOrder("so-15", "cust-acme", "draft", pad("SO", 15), daysAgo(1)),
    salesOrder("so-16", "cust-acme", "draft", pad("SO", 16), daysAgo(2)),
    salesOrder("so-17", "cust-acme", "draft", pad("SO", 17), daysAgo(2)),
    salesOrder("so-18", "cust-acme", "draft", pad("SO", 18), daysAgo(3)),
    salesOrder("so-19", "cust-mix-b", "draft", pad("SO", 19), daysAgo(3)),
    salesOrder("so-20", "cust-mix-b", "draft", pad("SO", 20), daysAgo(3)),
  ];

  const leftoverLines: Array<{ orderId: string; sku: string }> = [
    { orderId: "so-13", sku: "HEX-BOLT-GALV" },
    { orderId: "so-14", sku: "WASHER-SS-PACK" },
    { orderId: "so-15", sku: "DEM-00001" },
    { orderId: "so-16", sku: "DEM-00002" },
    { orderId: "so-17", sku: "DEM-00003" },
    { orderId: "so-18", sku: "LOCK-NUT-NYL" },
    { orderId: "so-19", sku: "FLAT-WASHER-ZINC" },
    { orderId: "so-20", sku: "COUPLING-NUT-GR8" },
  ];

  const salesOrderLines: DemoBook["salesOrderLines"] = [
    ...shipped.map((row) => ({
      orderId: row.id,
      sku: row.sku,
      qty: 1,
      unitPriceCents: priceBySku.get(row.sku) ?? 0,
    })),
    ...leftoverLines.map((row) => ({
      orderId: row.orderId,
      sku: row.sku,
      qty: 1,
      unitPriceCents: priceBySku.get(row.sku) ?? 0,
    })),
  ];

  const invoices: DemoBook["invoices"] = shipped.map((row) => ({
    id: `inv-${row.id}`,
    orderId: row.id,
    customerId: row.customerId,
    documentNumber: row.invoiceNumber,
    postedAt: daysAgo(row.postedDaysAgo),
    subtotalCents: priceBySku.get(row.sku) ?? 0,
    taxTotalCents: 0,
    totalCents: priceBySku.get(row.sku) ?? 0,
  }));

  const paidInvoices = shipped.filter((row) => row.paid);
  const payments: DemoBook["payments"] = paidInvoices.map((row, index) => ({
    id: `pay-${String(index + 1)}`,
    customerId: row.customerId,
    amountCents: priceBySku.get(row.sku) ?? 0,
  }));
  const paymentApplications: DemoBook["paymentApplications"] = paidInvoices.map((row, index) => ({
    paymentId: `pay-${String(index + 1)}`,
    invoiceId: `inv-${row.id}`,
    amountCents: priceBySku.get(row.sku) ?? 0,
  }));

  const movements: DemoMovementRow[] = [];
  for (const [index, sku] of receivedSkus.entries()) {
    const at = daysAgo(200 - index);
    movements.push(
      { sku, locationId: LOCATION, movementType: "InboundFromPo", quantity: 12, createdAt: at },
      { sku, locationId: LOCATION, movementType: "GoodsReceived", quantity: 12, createdAt: at },
    );
  }
  movements.push({
    sku: "DEM-00003",
    locationId: LOCATION,
    movementType: "InboundFromPo",
    quantity: 6,
    createdAt: daysAgo(2),
  });
  for (const row of shipped) {
    const at = daysAgo(row.postedDaysAgo);
    movements.push(
      {
        sku: row.sku,
        locationId: LOCATION,
        movementType: "Committed",
        quantity: 1,
        createdAt: at,
      },
      {
        sku: row.sku,
        locationId: LOCATION,
        movementType: "Allocated",
        quantity: 1,
        createdAt: at,
      },
      { sku: row.sku, locationId: LOCATION, movementType: "Shipped", quantity: 1, createdAt: at },
    );
  }
  movements.push(
    {
      sku: "HEX-BOLT-GALV",
      locationId: LOCATION,
      movementType: "Committed",
      quantity: 1,
      createdAt: daysAgo(1),
    },
    {
      sku: "HEX-BOLT-GALV",
      locationId: LOCATION,
      movementType: "Allocated",
      quantity: 1,
      createdAt: daysAgo(1),
    },
    {
      sku: "WASHER-SS-PACK",
      locationId: LOCATION,
      movementType: "Committed",
      quantity: 1,
      createdAt: daysAgo(1),
    },
    {
      sku: "WASHER-SS-PACK",
      locationId: LOCATION,
      movementType: "Allocated",
      quantity: 1,
      createdAt: daysAgo(1),
    },
  );

  const recomputed = recomputeStockFromMovements(movements);
  if ("error" in recomputed) {
    throw new Error(recomputed.error);
  }
  const snapshots: DemoSnapshotRow[] = [...recomputed.entries()].map(([key, figures]) => {
    const [sku, locationId] = key.split("\0");
    return {
      sku: sku ?? "",
      locationId: locationId ?? LOCATION,
      onHand: figures.onHand,
      onOrder: figures.onOrder,
      allocated: figures.allocated,
    };
  });

  const onHand = (sku: string): number =>
    snapshots.find((row) => stockKey(row.sku, row.locationId) === stockKey(sku, LOCATION))
      ?.onHand ?? 0;

  const raised = new Set(["LOCK-NUT-NYL", "FLAT-WASHER-ZINC"]);
  const reorderPolicies = products.map((row) => {
    const leftover = onHand(row.sku);
    const minOnHand = raised.has(row.sku) ? leftover + 1 : 0;
    return {
      sku: row.sku,
      locationId: LOCATION,
      minOnHand,
      maxOnHand: Math.max(minOnHand + 12, leftover),
    };
  });

  return {
    defaultLocationId: LOCATION,
    products,
    images,
    suppliers,
    supplierProducts,
    customers,
    shipTos,
    contacts: [],
    exemptionCertificates,
    staffUsers: [{ id: "staff-1", email: PHASE1_STAFF_EMAIL }],
    wholesaleUsers: [
      { id: "wholesale-1", email: PHASE1_WHOLESALE_EMAIL, customerId: "cust-acme" },
    ],
    opsUsers: [],
    purchaseOrders,
    purchaseOrderLines,
    salesOrders,
    salesOrderLines,
    invoices,
    invoiceTaxLines: [],
    payments,
    paymentApplications,
    taxCommits: [],
    movements,
    snapshots,
    reorderPolicies,
  };
}

function ship(
  id: string,
  customerId: string,
  pin: { line1: string; city: string; region: string; postal: string },
): DemoBook["shipTos"][number] {
  return {
    id,
    customerId,
    line1: pin.line1,
    line2: null,
    city: pin.city,
    region: pin.region,
    postal: pin.postal,
    country: "US",
    isDefault: true,
  };
}

function shipSpec(
  id: string,
  customerId: string,
  sku: string,
  postedDaysAgo: number,
  sequence: number,
  paid: boolean,
): {
  id: string;
  customerId: string;
  sku: string;
  postedDaysAgo: number;
  documentNumber: string;
  invoiceNumber: string;
  paid: boolean;
} {
  return {
    id,
    customerId,
    sku,
    postedDaysAgo,
    documentNumber: pad("SO", sequence),
    invoiceNumber: pad("INV", sequence),
    paid,
  };
}

function salesOrder(
  id: string,
  customerId: string,
  status: DemoBook["salesOrders"][number]["status"],
  documentNumber: string,
  createdAt: Date,
): DemoBook["salesOrders"][number] {
  const shipTo = {
    "cust-acme": DEMO_NAMED_CUSTOMERS.acme.ship,
    "cust-northstar": DEMO_NAMED_CUSTOMERS.northstar.ship,
    "cust-harvest": DEMO_NAMED_CUSTOMERS.harvest.ship,
    "cust-idle": DEMO_NAMED_CUSTOMERS.idlePark.ship,
    "cust-mix-a": {
      line1: "10 Cedar St",
      city: "Boise",
      region: "ID",
      postal: "83702",
    },
    "cust-mix-b": {
      line1: "200 Pine Ave",
      city: "Denver",
      region: "CO",
      postal: "80202",
    },
  }[customerId];
  return {
    id,
    customerId,
    status,
    documentNumber,
    createdAt,
    shipLine1: shipTo?.line1 ?? null,
    shipLine2: null,
    shipCity: shipTo?.city ?? null,
    shipRegion: shipTo?.region ?? null,
    shipPostal: shipTo?.postal ?? null,
    shipCountry: "US",
  };
}
