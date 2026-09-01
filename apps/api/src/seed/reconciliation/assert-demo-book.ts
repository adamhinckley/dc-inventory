import { ZERO_STOCK_FIGURES } from "@dc-inventory/inventory/snapshot";
import {
  PHASE1_PRODUCTS,
  PHASE1_PRODUCT_SKUS,
  PHASE1_STAFF_EMAIL,
  PHASE1_WHOLESALE_EMAIL,
} from "../phase1-fixture.js";
import { failContract, type DemoReconciliationResult } from "./contracts.js";
import type { DemoBook, IDemoBookReader } from "./demo-book.js";
import {
  DEMO_AR_BUCKETS,
  DEMO_NAMED_CUSTOMERS,
  FULL_DEMO_RECONCILIATION_EXPECTATIONS,
  type DemoArBucket,
  type DemoReconciliationExpectations,
} from "./expectations.js";
import { recomputeStockFromMovements, stockKey } from "./stock-from-movements.js";

export type { DemoArBucket, DemoReconciliationExpectations };
export { DEMO_AR_BUCKETS, DEMO_NAMED_CUSTOMERS, FULL_DEMO_RECONCILIATION_EXPECTATIONS };
export type { DemoReconciliationContract, DemoReconciliationResult } from "./contracts.js";
export { DEMO_RECONCILIATION_CONTRACTS } from "./contracts.js";
export type { DemoBook, IDemoBookReader } from "./demo-book.js";
export { InMemoryDemoBookReader } from "./in-memory-demo-book-reader.js";
export { PostgresDemoBookReader } from "./postgres-demo-book-reader.js";
export { recomputeStockFromMovements, stockKey };

const NAMED_CUSTOMER_NAMES: ReadonlySet<string> = new Set(
  Object.values(DEMO_NAMED_CUSTOMERS).map((row) => row.name),
);

const PHASE1_BY_SKU = new Map(PHASE1_PRODUCTS.map((row) => [row.sku, row]));

const DOCUMENT_NUMBER = /^(PO|SO|INV)-\d{5}$/;

export type AssertDemoBookOptions = {
  seedToday: Date;
  expectations?: DemoReconciliationExpectations;
};

export function utcDayDiff(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.trunc((end - start) / 86_400_000);
}

export function demoArBucket(ageDays: number): DemoArBucket {
  if (ageDays <= 29) {
    return "current";
  }
  if (ageDays <= 59) {
    return "30_59";
  }
  if (ageDays <= 89) {
    return "60_89";
  }
  return "90_plus";
}

export function isDemoLowStock(onHand: number, minOnHand: number): boolean {
  return onHand <= minOnHand;
}

type Ctx = {
  book: DemoBook;
  seedToday: Date;
  expectations: DemoReconciliationExpectations;
  appliedCentsByInvoice: Map<string, number>;
};

type Check = (ctx: Ctx) => DemoReconciliationResult | undefined;

function countCheck(
  contract: Parameters<typeof failContract>[0],
  actual: number,
  expected: number,
  label: string,
): DemoReconciliationResult | undefined {
  if (actual !== expected) {
    return failContract(contract, `${label} is ${String(actual)}, expected ${String(expected)}`);
  }
  return undefined;
}

function byId<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function padDocument(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(5, "0")}`;
}

function sequenceOf(documentNumber: string, prefix: string): number | null {
  const match = new RegExp(`^${prefix}-(\\d{5})$`).exec(documentNumber);
  if (!match) {
    return null;
  }
  const digits = match[1];
  if (digits === undefined) {
    return null;
  }
  return Number.parseInt(digits, 10);
}

function isCompleteDocumentRun(sequences: readonly number[], expected: number): boolean {
  if (sequences.length !== expected) {
    return false;
  }
  const uniqueSorted = [...new Set(sequences)].sort((left, right) => left - right);
  return uniqueSorted.length === expected && uniqueSorted.every((value, index) => value === index + 1);
}

function indexAppliedCents(applications: DemoBook["paymentApplications"]): Map<string, number> {
  const applied = new Map<string, number>();
  for (const row of applications) {
    applied.set(row.invoiceId, (applied.get(row.invoiceId) ?? 0) + row.amountCents);
  }
  return applied;
}

function customerIdByName(book: DemoBook, name: string): string | undefined {
  return book.customers.find((row) => row.name === name)?.id;
}

const checks: readonly Check[] = [
  (ctx) =>
    countCheck(
      "product_count",
      ctx.book.products.length,
      ctx.expectations.productCount,
      "products",
    ),
  (ctx) =>
    countCheck(
      "supplier_count",
      ctx.book.suppliers.length,
      ctx.expectations.supplierCount,
      "suppliers",
    ),
  (ctx) =>
    countCheck(
      "customer_count",
      ctx.book.customers.length,
      ctx.expectations.customerCount,
      "customers",
    ),
  (ctx) =>
    countCheck(
      "purchase_order_count",
      ctx.book.purchaseOrders.length,
      ctx.expectations.purchaseOrderCount,
      "purchase orders",
    ),
  (ctx) =>
    countCheck(
      "sales_order_count",
      ctx.book.salesOrders.length,
      ctx.expectations.salesOrderCount,
      "sales orders",
    ),
  (ctx) =>
    countCheck(
      "invoice_count",
      ctx.book.invoices.length,
      ctx.expectations.invoiceCount,
      "invoices",
    ),
  (ctx) =>
    countCheck(
      "payment_count",
      ctx.book.payments.length,
      ctx.expectations.paymentCount,
      "payments",
    ),
  (ctx) =>
    countCheck("image_count", ctx.book.images.length, ctx.expectations.imageCount, "images"),
  (ctx) =>
    countCheck(
      "supplier_product_count",
      ctx.book.supplierProducts.length,
      ctx.expectations.supplierProductCount,
      "supplier_products",
    ),
  (ctx) =>
    countCheck(
      "reorder_policy_count",
      ctx.book.reorderPolicies.length,
      ctx.expectations.reorderPolicyCount,
      "reorder policies",
    ),
  checkDocumentNumberFormat,
  checkDocumentNumberEndpoints,
  checkPhase1Fixtures,
  checkIdentityRows,
  checkNamedCustomerFields,
  checkDefaultShipTos,
  checkShopVisibility,
  checkTaxCategoryMetadata,
  checkImageKeyFormat,
  checkUniqueNames,
  checkNoMixPersonaContacts,
  checkNoExtraUsers,
  checkVendorPartition,
  checkRepeatedSku,
  checkStockFromMovements,
  checkInvoiceTotals,
  checkOmittedTax,
  checkInvoiceRemainder,
  checkPaymentCompleteness,
  checkNamedCustomerPayments,
  checkArAgeBuckets,
  checkIdleParkAgedAr,
  checkOpenDocumentMix,
  checkLeftoverRecency,
  checkAcmeDraft,
  checkIdleParkOpenPipeline,
  checkLowStock,
];

function checkDocumentNumberFormat(ctx: Ctx): DemoReconciliationResult | undefined {
  const numbers = [
    ...ctx.book.purchaseOrders.map((row) => row.documentNumber),
    ...ctx.book.salesOrders.map((row) => row.documentNumber),
    ...ctx.book.invoices.map((row) => row.documentNumber),
  ];
  const bad = numbers.find((value) => !DOCUMENT_NUMBER.test(value));
  if (bad !== undefined) {
    return failContract("document_number_format", `${bad} is not a five-digit engine number`);
  }
  return undefined;
}

function checkDocumentNumberEndpoints(ctx: Ctx): DemoReconciliationResult | undefined {
  const groups: Array<{
    rows: { documentNumber: string }[];
    prefix: string;
    expected: number;
    label: string;
  }> = [
    {
      rows: ctx.book.purchaseOrders,
      prefix: "PO",
      expected: ctx.expectations.purchaseOrderCount,
      label: "purchase orders",
    },
    {
      rows: ctx.book.salesOrders,
      prefix: "SO",
      expected: ctx.expectations.salesOrderCount,
      label: "sales orders",
    },
    {
      rows: ctx.book.invoices,
      prefix: "INV",
      expected: ctx.expectations.invoiceCount,
      label: "invoices",
    },
  ];
  for (const group of groups) {
    const sequences = group.rows.map((row) => sequenceOf(row.documentNumber, group.prefix));
    if (sequences.some((value) => value === null)) {
      return failContract(
        "document_number_endpoints",
        `${group.label} are not a ${group.prefix} run`,
      );
    }
    const numbers = sequences as number[];
    if (!isCompleteDocumentRun(numbers, group.expected)) {
      return failContract(
        "document_number_endpoints",
        `${group.label} are not ${padDocument(group.prefix, 1)} through ${padDocument(group.prefix, group.expected)}`,
      );
    }
  }
  return undefined;
}

function checkPhase1Fixtures(ctx: Ctx): DemoReconciliationResult | undefined {
  for (const sku of PHASE1_PRODUCT_SKUS) {
    const product = ctx.book.products.find((row) => row.sku === sku);
    const fixture = PHASE1_BY_SKU.get(sku);
    if (!product || !fixture) {
      return failContract("phase1_fixture_preservation", `missing Phase 1 SKU ${sku}`);
    }
    if (
      product.name !== fixture.name ||
      product.uom !== fixture.uom ||
      product.masterPackPrice !== fixture.masterPackPrice ||
      product.currency !== fixture.currency
    ) {
      return failContract("phase1_fixture_preservation", `${sku} drifted from the Phase 1 fixture`);
    }
  }
  const receivedPoIds = new Set(
    ctx.book.purchaseOrders.filter((row) => row.status === "received").map((row) => row.id),
  );
  const shippedSoIds = new Set(
    ctx.book.salesOrders.filter((row) => row.status === "shipped").map((row) => row.id),
  );
  for (const sku of PHASE1_PRODUCT_SKUS) {
    const onReceivedPo = ctx.book.purchaseOrderLines.some(
      (line) => line.sku === sku && receivedPoIds.has(line.purchaseOrderId),
    );
    const onShippedSo = ctx.book.salesOrderLines.some(
      (line) => line.sku === sku && shippedSoIds.has(line.orderId),
    );
    if (!onReceivedPo || !onShippedSo) {
      return failContract(
        "phase1_fixture_preservation",
        `${sku} must appear on received PO and shipped sales-order history`,
      );
    }
  }
  return undefined;
}

function checkIdentityRows(ctx: Ctx): DemoReconciliationResult | undefined {
  if (ctx.book.staffUsers.length !== 1 || ctx.book.wholesaleUsers.length !== 1) {
    return failContract(
      "identity_rows",
      `staff ${String(ctx.book.staffUsers.length)}, wholesale ${String(ctx.book.wholesaleUsers.length)}`,
    );
  }
  const staff = ctx.book.staffUsers[0];
  const wholesale = ctx.book.wholesaleUsers[0];
  const acmeId = customerIdByName(ctx.book, DEMO_NAMED_CUSTOMERS.acme.name);
  if (!staff || !wholesale || staff.email !== PHASE1_STAFF_EMAIL) {
    return failContract("identity_rows", "staff login is not staff@local.test");
  }
  if (wholesale.email !== PHASE1_WHOLESALE_EMAIL || wholesale.customerId !== acmeId) {
    return failContract("identity_rows", "wholesale login is not wholesale@local.test on Acme");
  }
  return undefined;
}

function checkNamedCustomerFields(ctx: Ctx): DemoReconciliationResult | undefined {
  for (const pin of Object.values(DEMO_NAMED_CUSTOMERS)) {
    const customer = ctx.book.customers.find((row) => row.name === pin.name);
    if (!customer) {
      return failContract("named_customer_fields", `missing ${pin.name}`);
    }
    if (
      customer.creditLimitCents !== pin.creditLimitCents ||
      customer.terms !== ctx.expectations.customerTerms ||
      customer.currency !== ctx.expectations.customerCurrency
    ) {
      return failContract("named_customer_fields", `${pin.name} commercial fields drifted`);
    }
  }
  for (const customer of ctx.book.customers) {
    if (
      customer.terms !== ctx.expectations.customerTerms ||
      customer.currency !== ctx.expectations.customerCurrency
    ) {
      return failContract("named_customer_fields", `${customer.name} is not Net 30 USD`);
    }
    if (
      !NAMED_CUSTOMER_NAMES.has(customer.name) &&
      customer.creditLimitCents !== ctx.expectations.mixCustomerCreditLimitCents
    ) {
      return failContract("named_customer_fields", `${customer.name} mix credit drifted`);
    }
  }
  return undefined;
}

function checkDefaultShipTos(ctx: Ctx): DemoReconciliationResult | undefined {
  for (const customer of ctx.book.customers) {
    const shipTos = ctx.book.shipTos.filter((row) => row.customerId === customer.id);
    const defaults = shipTos.filter((row) => row.isDefault);
    if (shipTos.length !== 1 || defaults.length !== 1) {
      return failContract("default_ship_tos", `${customer.name} must have exactly one default ship-to`);
    }
    const shipTo = defaults[0];
    if (
      !shipTo ||
      shipTo.line2 !== null ||
      shipTo.country !== "US" ||
      shipTo.region.length !== 2
    ) {
      return failContract("default_ship_tos", `${customer.name} ship-to is not a US default`);
    }
  }
  for (const pin of Object.values(DEMO_NAMED_CUSTOMERS)) {
    const customer = ctx.book.customers.find((row) => row.name === pin.name);
    if (!customer) {
      return failContract("default_ship_tos", `missing ${pin.name}`);
    }
    const shipTo = ctx.book.shipTos.find((row) => row.customerId === customer.id);
    if (
      !shipTo ||
      shipTo.line1 !== pin.ship.line1 ||
      shipTo.city !== pin.ship.city ||
      shipTo.region !== pin.ship.region ||
      shipTo.postal !== pin.ship.postal
    ) {
      return failContract("default_ship_tos", `${pin.name} address is not the pinned Demo default`);
    }
  }
  return undefined;
}

function checkShopVisibility(ctx: Ctx): DemoReconciliationResult | undefined {
  const hidden = ctx.book.products.find((row) => !row.webWholesale);
  if (hidden) {
    return failContract("shop_visibility", `${hidden.sku} is not shop-visible`);
  }
  return undefined;
}

function checkTaxCategoryMetadata(ctx: Ctx): DemoReconciliationResult | undefined {
  const wrong = ctx.book.products.find((row) => row.taxCategoryCode !== "TANGIBLE");
  if (wrong) {
    return failContract("tax_category_metadata", `${wrong.sku} tax category is not TANGIBLE`);
  }
  if (ctx.book.exemptionCertificates.length !== ctx.expectations.exemptionCertificateCount) {
    return failContract(
      "tax_category_metadata",
      `exemption rows ${String(ctx.book.exemptionCertificates.length)}, expected ${String(ctx.expectations.exemptionCertificateCount)}`,
    );
  }
  for (const cert of ctx.book.exemptionCertificates) {
    const shipTo = ctx.book.shipTos.find(
      (row) => row.customerId === cert.customerId && row.isDefault,
    );
    if (
      cert.objectKey !== null ||
      cert.entityUseCode !== "RESALE" ||
      cert.status !== "active" ||
      cert.expiresAt === null ||
      cert.expiresAt <= ctx.seedToday ||
      shipTo === undefined ||
      cert.jurisdiction !== shipTo.region
    ) {
      return failContract("tax_category_metadata", "exemption metadata is not an inert RESALE snapshot");
    }
  }
  return undefined;
}

function checkImageKeyFormat(ctx: Ctx): DemoReconciliationResult | undefined {
  const products = byId(ctx.book.products);
  const seen = new Set<string>();
  for (const image of ctx.book.images) {
    const product = products.get(image.productId);
    if (!product) {
      return failContract("image_key_format", "image is not attached to a product");
    }
    const expected = `demo/catalog/${product.sku}.jpg`;
    if (image.objectKey !== expected || image.contentType !== "image/jpeg") {
      return failContract("image_key_format", `${image.objectKey} is not a placeholder JPEG key`);
    }
    if (seen.has(image.productId)) {
      return failContract("image_key_format", `${product.sku} has more than one image row`);
    }
    seen.add(image.productId);
  }
  for (const product of ctx.book.products) {
    if (!seen.has(product.id)) {
      return failContract("image_key_format", `${product.sku} has no image row`);
    }
  }
  return undefined;
}

function checkUniqueNames(ctx: Ctx): DemoReconciliationResult | undefined {
  for (const [label, values] of [
    ["product", ctx.book.products.map((row) => row.name)],
    ["supplier", ctx.book.suppliers.map((row) => row.name)],
    ["customer", ctx.book.customers.map((row) => row.name)],
  ] as const) {
    if (new Set(values).size !== values.length) {
      return failContract("unique_names", `duplicate ${label} name`);
    }
  }
  return undefined;
}

function checkNoMixPersonaContacts(ctx: Ctx): DemoReconciliationResult | undefined {
  const personaAndMix = new Set(
    ctx.book.customers
      .filter((row) => row.name !== DEMO_NAMED_CUSTOMERS.acme.name)
      .map((row) => row.id),
  );
  const extra = ctx.book.contacts.find((row) => personaAndMix.has(row.customerId));
  if (extra) {
    return failContract("no_mix_persona_contacts", "mix or persona customers have contact rows");
  }
  return undefined;
}

function checkNoExtraUsers(ctx: Ctx): DemoReconciliationResult | undefined {
  if (ctx.book.opsUsers.length !== 0) {
    return failContract("no_extra_users", "ops users are present");
  }
  return undefined;
}

function checkVendorPartition(ctx: Ctx): DemoReconciliationResult | undefined {
  const vend001 = ctx.book.suppliers.find((row) => row.vendorNumber === "VEND-001");
  if (!vend001 || vend001.name !== "Demo Supplier") {
    return failContract("vendor_partition", "VEND-001 is not Demo Supplier");
  }
  const bySku = new Map<string, string>();
  const perSupplier = new Map<string, number>();
  for (const assignment of ctx.book.supplierProducts) {
    if (assignment.minOrderQty !== null) {
      return failContract("vendor_partition", `${assignment.sku} has a min_order_qty`);
    }
    if (bySku.has(assignment.sku)) {
      return failContract("vendor_partition", `${assignment.sku} is dual-sourced`);
    }
    bySku.set(assignment.sku, assignment.supplierId);
    perSupplier.set(assignment.supplierId, (perSupplier.get(assignment.supplierId) ?? 0) + 1);
  }
  for (const product of ctx.book.products) {
    if (!bySku.has(product.sku)) {
      return failContract("vendor_partition", `${product.sku} has no supplier`);
    }
  }
  for (const sku of PHASE1_PRODUCT_SKUS) {
    if (bySku.get(sku) !== vend001.id) {
      return failContract("vendor_partition", `${sku} is not on VEND-001`);
    }
  }
  for (const supplier of ctx.book.suppliers) {
    const count = perSupplier.get(supplier.id) ?? 0;
    if (count < ctx.expectations.supplierSkuMin || count > ctx.expectations.supplierSkuMax) {
      return failContract(
        "vendor_partition",
        `${supplier.vendorNumber} owns ${String(count)} SKUs, outside ${String(ctx.expectations.supplierSkuMin)}–${String(ctx.expectations.supplierSkuMax)}`,
      );
    }
  }
  return undefined;
}

function checkRepeatedSku(ctx: Ctx): DemoReconciliationResult | undefined {
  const poLines = new Map<string, string[]>();
  for (const line of ctx.book.purchaseOrderLines) {
    const skus = poLines.get(line.purchaseOrderId) ?? [];
    skus.push(line.sku);
    poLines.set(line.purchaseOrderId, skus);
  }
  const soLines = new Map<string, string[]>();
  for (const line of ctx.book.salesOrderLines) {
    const skus = soLines.get(line.orderId) ?? [];
    skus.push(line.sku);
    soLines.set(line.orderId, skus);
  }
  for (const [id, skus] of [...poLines, ...soLines]) {
    if (new Set(skus).size !== skus.length) {
      return failContract("repeated_sku", `document ${id} repeats a SKU`);
    }
  }
  return undefined;
}

function checkStockFromMovements(ctx: Ctx): DemoReconciliationResult | undefined {
  const recomputed = recomputeStockFromMovements(ctx.book.movements);
  if ("error" in recomputed) {
    return failContract("stock_from_movements", recomputed.error);
  }
  for (const snapshot of ctx.book.snapshots) {
    const figures = recomputed.get(stockKey(snapshot.sku, snapshot.locationId)) ?? ZERO_STOCK_FIGURES;
    if (
      figures.onHand !== snapshot.onHand ||
      figures.onOrder !== snapshot.onOrder ||
      figures.allocated !== snapshot.allocated
    ) {
      return failContract(
        "stock_from_movements",
        `${snapshot.sku} snapshot does not match movements`,
      );
    }
  }
  for (const [key, figures] of recomputed) {
    const [sku, locationId] = key.split("\0");
    if (sku === undefined || locationId === undefined) {
      return failContract("stock_from_movements", "malformed stock key");
    }
    const snapshot = ctx.book.snapshots.find(
      (row) => row.sku === sku && row.locationId === locationId,
    );
    if (!snapshot && (figures.onHand !== 0 || figures.onOrder !== 0 || figures.allocated !== 0)) {
      return failContract("stock_from_movements", `${sku} has movements but no snapshot`);
    }
  }
  return undefined;
}

function checkInvoiceTotals(ctx: Ctx): DemoReconciliationResult | undefined {
  const ordersById = byId(ctx.book.salesOrders);
  const linesByOrder = new Map<string, DemoBook["salesOrderLines"]>();
  for (const line of ctx.book.salesOrderLines) {
    const rows = linesByOrder.get(line.orderId) ?? [];
    rows.push(line);
    linesByOrder.set(line.orderId, rows);
  }
  for (const invoice of ctx.book.invoices) {
    const order = ordersById.get(invoice.orderId);
    if (!order || order.status !== "shipped") {
      return failContract(
        "invoice_totals",
        `${invoice.documentNumber} is not invoice-on-ship`,
      );
    }
    if (invoice.customerId !== order.customerId) {
      return failContract(
        "invoice_totals",
        `${invoice.documentNumber} customer does not match the order`,
      );
    }
    if (invoice.taxTotalCents !== 0 || invoice.totalCents !== invoice.subtotalCents) {
      return failContract(
        "invoice_totals",
        `${invoice.documentNumber} tax/total does not equal omitted-tax subtotal`,
      );
    }
    const lines = linesByOrder.get(invoice.orderId) ?? [];
    const subtotal = lines.reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0);
    if (invoice.subtotalCents !== subtotal) {
      return failContract(
        "invoice_totals",
        `${invoice.documentNumber} subtotal does not match the snapshotted order`,
      );
    }
  }
  return undefined;
}

function checkOmittedTax(ctx: Ctx): DemoReconciliationResult | undefined {
  if (ctx.book.invoiceTaxLines.length !== 0 || ctx.book.taxCommits.length !== 0) {
    return failContract("omitted_tax", "invoice tax lines or tax commits are present");
  }
  return undefined;
}

function remainingCents(ctx: Ctx, invoiceId: string, totalCents: number): number {
  return totalCents - (ctx.appliedCentsByInvoice.get(invoiceId) ?? 0);
}

function checkInvoiceRemainder(ctx: Ctx): DemoReconciliationResult | undefined {
  for (const invoice of ctx.book.invoices) {
    const remaining = remainingCents(ctx, invoice.id, invoice.totalCents);
    if (remaining < 0) {
      return failContract("invoice_remainder", `${invoice.documentNumber} is over-applied`);
    }
    if (remaining !== 0 && remaining !== invoice.totalCents) {
      return failContract("invoice_remainder", `${invoice.documentNumber} is not fully applied`);
    }
  }
  return undefined;
}

function unpaidInvoices(ctx: Ctx) {
  return ctx.book.invoices.filter(
    (invoice) => remainingCents(ctx, invoice.id, invoice.totalCents) === invoice.totalCents,
  );
}

function checkPaymentCompleteness(ctx: Ctx): DemoReconciliationResult | undefined {
  if (ctx.book.paymentApplications.length !== ctx.book.payments.length) {
    return failContract("payment_completeness", "payment applications are not 1:1 with payments");
  }
  const paymentsById = byId(ctx.book.payments);
  const invoicesById = byId(ctx.book.invoices);
  const invoicesSeen = new Set<string>();
  const paymentsSeen = new Set<string>();
  for (const application of ctx.book.paymentApplications) {
    if (paymentsSeen.has(application.paymentId) || invoicesSeen.has(application.invoiceId)) {
      return failContract("payment_completeness", "a payment or invoice is applied more than once");
    }
    paymentsSeen.add(application.paymentId);
    invoicesSeen.add(application.invoiceId);
    const payment = paymentsById.get(application.paymentId);
    const invoice = invoicesById.get(application.invoiceId);
    if (!payment || !invoice) {
      return failContract("payment_completeness", "application points at a missing row");
    }
    if (application.amountCents !== invoice.totalCents || payment.amountCents !== invoice.totalCents) {
      return failContract("payment_completeness", `${invoice.documentNumber} is not paid in full`);
    }
    if (payment.customerId !== invoice.customerId) {
      return failContract(
        "payment_completeness",
        `${invoice.documentNumber} payment is not on the invoice customer`,
      );
    }
  }
  const unpaid = unpaidInvoices(ctx);
  if (unpaid.length !== ctx.expectations.unpaidInvoiceCount) {
    return failContract(
      "payment_completeness",
      `unpaid invoices ${String(unpaid.length)}, expected ${String(ctx.expectations.unpaidInvoiceCount)}`,
    );
  }
  const idleParkId = customerIdByName(ctx.book, DEMO_NAMED_CUSTOMERS.idlePark.name);
  const mixIds = new Set(
    ctx.book.customers
      .filter((row) => !NAMED_CUSTOMER_NAMES.has(row.name))
      .map((row) => row.id),
  );
  const mixUnpaid = unpaid.filter((row) => mixIds.has(row.customerId));
  const mixInvoices = ctx.book.invoices
    .filter((row) => mixIds.has(row.customerId) && row.postedAt !== null)
    .sort((left, right) => {
      const byPosted = (right.postedAt?.getTime() ?? 0) - (left.postedAt?.getTime() ?? 0);
      if (byPosted !== 0) {
        return byPosted;
      }
      return right.documentNumber.localeCompare(left.documentNumber);
    });
  const expectedMixUnpaid = mixInvoices.slice(
    0,
    ctx.expectations.unpaidInvoiceCount -
      ctx.book.invoices.filter((row) => row.customerId === idleParkId).length,
  );
  const actualIds = new Set(mixUnpaid.map((row) => row.id));
  if (
    expectedMixUnpaid.length !== mixUnpaid.length ||
    expectedMixUnpaid.some((row) => !actualIds.has(row.id))
  ) {
    return failContract(
      "payment_completeness",
      "unpaid mix invoices are not the latest mix rows by posted_at",
    );
  }
  return undefined;
}

function checkNamedCustomerPayments(ctx: Ctx): DemoReconciliationResult | undefined {
  const unpaidIds = new Set(unpaidInvoices(ctx).map((row) => row.id));
  const named = {
    acme: customerIdByName(ctx.book, DEMO_NAMED_CUSTOMERS.acme.name),
    northstar: customerIdByName(ctx.book, DEMO_NAMED_CUSTOMERS.northstar.name),
    harvest: customerIdByName(ctx.book, DEMO_NAMED_CUSTOMERS.harvest.name),
    idlePark: customerIdByName(ctx.book, DEMO_NAMED_CUSTOMERS.idlePark.name),
  };
  for (const invoice of ctx.book.invoices) {
    const unpaid = unpaidIds.has(invoice.id);
    if (invoice.customerId === named.idlePark && !unpaid) {
      return failContract("named_customer_payments", "Idle Park has a paid invoice");
    }
    if (
      (invoice.customerId === named.acme ||
        invoice.customerId === named.northstar ||
        invoice.customerId === named.harvest) &&
      unpaid
    ) {
      return failContract("named_customer_payments", "a named paid customer has an unpaid invoice");
    }
  }
  return undefined;
}

function unpaidWithAge(ctx: Ctx) {
  return unpaidInvoices(ctx).flatMap((invoice) => {
    if (invoice.postedAt === null) {
      return [];
    }
    return [
      {
        invoice,
        bucket: demoArBucket(utcDayDiff(invoice.postedAt, ctx.seedToday)),
      },
    ];
  });
}

function checkArAgeBuckets(ctx: Ctx): DemoReconciliationResult | undefined {
  const aged = unpaidWithAge(ctx);
  for (const bucket of DEMO_AR_BUCKETS) {
    if (!aged.some((row) => row.bucket === bucket)) {
      return failContract("ar_age_buckets", `Demo AR age bucket ${bucket} is empty`);
    }
  }
  return undefined;
}

function checkIdleParkAgedAr(ctx: Ctx): DemoReconciliationResult | undefined {
  const idleParkId = customerIdByName(ctx.book, DEMO_NAMED_CUSTOMERS.idlePark.name);
  const aged = unpaidWithAge(ctx).filter((row) => row.invoice.customerId === idleParkId);
  for (const bucket of DEMO_AR_BUCKETS) {
    if (!aged.some((row) => row.bucket === bucket)) {
      return failContract("idle_park_aged_ar", `Idle Park has no wholly unpaid invoice in ${bucket}`);
    }
  }
  return undefined;
}

function checkOpenDocumentMix(ctx: Ctx): DemoReconciliationResult | undefined {
  const cancelledPo = ctx.book.purchaseOrders.find((row) => row.status === "cancelled");
  const cancelledSo = ctx.book.salesOrders.find((row) => row.status === "cancelled");
  if (cancelledPo || cancelledSo) {
    return failContract("open_document_mix", "generated cancelled documents are present");
  }
  const shipped = ctx.book.salesOrders.filter((row) => row.status === "shipped");
  const confirmedSo = ctx.book.salesOrders.filter((row) => row.status === "confirmed");
  const leftoverPo = ctx.book.purchaseOrders.filter((row) => row.status === "confirmed");
  if (shipped.length !== ctx.expectations.shippedSalesOrderCount) {
    return failContract(
      "open_document_mix",
      `shipped sales orders ${String(shipped.length)}, expected ${String(ctx.expectations.shippedSalesOrderCount)}`,
    );
  }
  if (
    confirmedSo.length < ctx.expectations.leftoverConfirmedSalesOrderMin ||
    confirmedSo.length > ctx.expectations.leftoverConfirmedSalesOrderMax
  ) {
    return failContract(
      "open_document_mix",
      `confirmed leftover sales orders ${String(confirmedSo.length)}`,
    );
  }
  if (
    leftoverPo.length < ctx.expectations.leftoverConfirmedPurchaseOrderMin ||
    leftoverPo.length > ctx.expectations.leftoverConfirmedPurchaseOrderMax
  ) {
    return failContract(
      "open_document_mix",
      `confirmed leftover purchase orders ${String(leftoverPo.length)}`,
    );
  }
  const poById = byId(ctx.book.purchaseOrders);
  for (const line of ctx.book.purchaseOrderLines) {
    const po = poById.get(line.purchaseOrderId);
    if (!po) {
      return failContract("open_document_mix", "PO line is missing its header");
    }
    if (po.status === "confirmed" && line.receivedQty !== 0) {
      return failContract("open_document_mix", `${po.documentNumber} leftover line is partly received`);
    }
    if (po.status === "received" && line.receivedQty !== line.qty) {
      return failContract("open_document_mix", `${po.documentNumber} is not received in full`);
    }
  }
  return undefined;
}

function checkLeftoverRecency(ctx: Ctx): DemoReconciliationResult | undefined {
  const leftover = [
    ...ctx.book.purchaseOrders.filter((row) => row.status === "confirmed"),
    ...ctx.book.salesOrders.filter((row) => row.status === "draft" || row.status === "confirmed"),
  ];
  const stale = leftover.find((row) => {
    const ageDays = utcDayDiff(row.createdAt, ctx.seedToday);
    return ageDays > ctx.expectations.leftoverWindowDays || ageDays < 0;
  });
  if (stale) {
    return failContract("leftover_recency", `${stale.documentNumber} is outside the last 7 seed-clock days`);
  }
  return undefined;
}

function checkAcmeDraft(ctx: Ctx): DemoReconciliationResult | undefined {
  const acmeId = customerIdByName(ctx.book, DEMO_NAMED_CUSTOMERS.acme.name);
  const draft = ctx.book.salesOrders.some(
    (row) => row.customerId === acmeId && row.status === "draft",
  );
  if (!draft) {
    return failContract("acme_draft", "Acme Wholesale has no leftover draft");
  }
  return undefined;
}

function checkIdleParkOpenPipeline(ctx: Ctx): DemoReconciliationResult | undefined {
  const idleParkId = customerIdByName(ctx.book, DEMO_NAMED_CUSTOMERS.idlePark.name);
  const leftover = ctx.book.salesOrders.find(
    (row) =>
      row.customerId === idleParkId && (row.status === "draft" || row.status === "confirmed"),
  );
  if (leftover) {
    return failContract("idle_park_open_pipeline", "Idle Park has a leftover sales order");
  }
  return undefined;
}

function leftoverOnHand(ctx: Ctx, sku: string): number {
  const snapshot = ctx.book.snapshots.find(
    (row) => row.sku === sku && row.locationId === ctx.book.defaultLocationId,
  );
  return snapshot?.onHand ?? 0;
}

function checkLowStock(ctx: Ctx): DemoReconciliationResult | undefined {
  const productSkus = new Set(ctx.book.products.map((row) => row.sku));
  const policySkus = new Set<string>();
  for (const policy of ctx.book.reorderPolicies) {
    if (policySkus.has(policy.sku)) {
      return failContract("low_stock", `${policy.sku} has more than one reorder policy`);
    }
    if (!productSkus.has(policy.sku)) {
      return failContract("low_stock", `${policy.sku} policy is not a shop-visible SKU`);
    }
    policySkus.add(policy.sku);
  }
  if (policySkus.size !== productSkus.size) {
    return failContract("low_stock", "reorder policies do not cover every shop-visible SKU");
  }
  let lowCount = 0;
  let naturalZeros = 0;
  for (const policy of ctx.book.reorderPolicies) {
    if (policy.locationId !== ctx.book.defaultLocationId) {
      return failContract("low_stock", `${policy.sku} policy is not at DEFAULT`);
    }
    const onHand = leftoverOnHand(ctx, policy.sku);
    const expectedMax = Math.max(policy.minOnHand + 12, onHand);
    if (policy.maxOnHand !== expectedMax) {
      return failContract("low_stock", `${policy.sku} max_on_hand is not max(min+12, leftover)`);
    }
    if (onHand === 0) {
      naturalZeros += 1;
    }
    if (isDemoLowStock(onHand, policy.minOnHand)) {
      lowCount += 1;
    }
  }
  if (naturalZeros > ctx.expectations.lowStockMax) {
    if (lowCount < ctx.expectations.lowStockMin) {
      return failContract(
        "low_stock",
        `natural zeros exceed ${String(ctx.expectations.lowStockMax)} but low-stock is ${String(lowCount)}`,
      );
    }
    return undefined;
  }
  if (lowCount < ctx.expectations.lowStockMin || lowCount > ctx.expectations.lowStockMax) {
    return failContract(
      "low_stock",
      `low-stock SKUs ${String(lowCount)}, expected ${String(ctx.expectations.lowStockMin)}–${String(ctx.expectations.lowStockMax)}`,
    );
  }
  return undefined;
}

export async function assertDemoBook(
  reader: IDemoBookReader,
  options: AssertDemoBookOptions,
): Promise<DemoReconciliationResult> {
  const book = await reader.load();
  const ctx: Ctx = {
    book,
    seedToday: options.seedToday,
    expectations: options.expectations ?? FULL_DEMO_RECONCILIATION_EXPECTATIONS,
    appliedCentsByInvoice: indexAppliedCents(book.paymentApplications),
  };
  for (const check of checks) {
    const failed = check(ctx);
    if (failed) {
      return failed;
    }
  }
  return { ok: true };
}
