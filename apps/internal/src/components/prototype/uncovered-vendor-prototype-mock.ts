/** PROTOTYPE — mock vendor context for uncovered worksheet UX. Wipe when wiring real API. */

export type PrototypeVendor = Readonly<{
  id: string;
  vendorNumber: string;
  name: string;
}>;

export type PrototypeUncoveredRow = Readonly<{
  sku: string;
  uncovered: number;
  onHand: number;
  onOrder: number;
  committed: number;
  caseQty: number | null;
  reorderMin: number | null;
  reorderMax: number | null;
  supplierId: string | null;
  mappingStatus: "mapped" | "unmapped" | "ambiguous";
  draftPurchaseOrder: { id: string; documentNumber: string } | null;
}>;

export const PROTOTYPE_VENDORS: readonly PrototypeVendor[] = [
  { id: "vendor-a", vendorNumber: "FA", name: "Factory A — Guangzhou" },
  { id: "vendor-b", vendorNumber: "FB", name: "Factory B — Yiwu" },
  { id: "vendor-c", vendorNumber: "FC", name: "Factory C — Ningbo" },
];

export const PROTOTYPE_UNCOVERED_ROWS: readonly PrototypeUncoveredRow[] = [
  {
    sku: "DC-1001-RED",
    uncovered: 584,
    onHand: 120,
    onOrder: 0,
    committed: 704,
    caseQty: 100,
    reorderMin: 200,
    reorderMax: 800,
    supplierId: "vendor-a",
    mappingStatus: "mapped",
    draftPurchaseOrder: null,
  },
  {
    sku: "DC-1002-BLU",
    uncovered: 240,
    onHand: 0,
    onOrder: 0,
    committed: 240,
    caseQty: 48,
    reorderMin: 96,
    reorderMax: 480,
    supplierId: "vendor-a",
    mappingStatus: "mapped",
    draftPurchaseOrder: {
      id: "po-draft-a1",
      documentNumber: "PO-2026-0042",
    },
  },
  {
    sku: "DC-1003-GRN",
    uncovered: 72,
    onHand: 48,
    onOrder: 0,
    committed: 120,
    caseQty: 24,
    reorderMin: 48,
    reorderMax: 240,
    supplierId: "vendor-a",
    mappingStatus: "mapped",
    draftPurchaseOrder: null,
  },
  {
    sku: "DC-2001-WHT",
    uncovered: 400,
    onHand: 0,
    onOrder: 200,
    committed: 600,
    caseQty: 50,
    reorderMin: 100,
    reorderMax: 500,
    supplierId: "vendor-b",
    mappingStatus: "mapped",
    draftPurchaseOrder: null,
  },
  {
    sku: "DC-2002-BLK",
    uncovered: 156,
    onHand: 44,
    onOrder: 0,
    committed: 200,
    caseQty: null,
    reorderMin: null,
    reorderMax: null,
    supplierId: "vendor-b",
    mappingStatus: "mapped",
    draftPurchaseOrder: null,
  },
  {
    sku: "DC-2003-GLD",
    uncovered: 96,
    onHand: 0,
    onOrder: 0,
    committed: 96,
    caseQty: 12,
    reorderMin: 24,
    reorderMax: 120,
    supplierId: "vendor-b",
    mappingStatus: "mapped",
    draftPurchaseOrder: {
      id: "po-draft-b1",
      documentNumber: "PO-2026-0043",
    },
  },
  {
    sku: "DC-3001-PNK",
    uncovered: 320,
    onHand: 80,
    onOrder: 0,
    committed: 400,
    caseQty: 40,
    reorderMin: 80,
    reorderMax: 400,
    supplierId: "vendor-c",
    mappingStatus: "mapped",
    draftPurchaseOrder: null,
  },
  {
    sku: "DC-3002-PRP",
    uncovered: 48,
    onHand: 0,
    onOrder: 0,
    committed: 48,
    caseQty: 24,
    reorderMin: 48,
    reorderMax: 144,
    supplierId: "vendor-c",
    mappingStatus: "mapped",
    draftPurchaseOrder: null,
  },
  {
    sku: "DC-9001-NEW",
    uncovered: 120,
    onHand: 0,
    onOrder: 0,
    committed: 120,
    caseQty: 12,
    reorderMin: null,
    reorderMax: null,
    supplierId: null,
    mappingStatus: "unmapped",
    draftPurchaseOrder: null,
  },
  {
    sku: "DC-9002-NEW",
    uncovered: 36,
    onHand: 12,
    onOrder: 0,
    committed: 48,
    caseQty: null,
    reorderMin: null,
    reorderMax: null,
    supplierId: null,
    mappingStatus: "ambiguous",
    draftPurchaseOrder: null,
  },
];

export function vendorById(vendorId: string): PrototypeVendor | undefined {
  return PROTOTYPE_VENDORS.find((vendor) => vendor.id === vendorId);
}

export function vendorLabel(vendorId: string | null): string {
  if (vendorId === null) {
    return "—";
  }
  const vendor = vendorById(vendorId);
  if (vendor === undefined) {
    return vendorId;
  }
  return vendor.name;
}

/** Route key for SKUs with no unique vendor mapping. */
export const NEEDS_MAPPING_VENDOR_KEY = "needs-mapping";

export type PrototypeVendorSummaryRow = Readonly<{
  key: string;
  vendorNumber: string;
  name: string;
  productCount: number;
  totalUncovered: number;
  needsAttention: boolean;
}>;

export function rowsForVendorKey(
  vendorKey: string,
): readonly PrototypeUncoveredRow[] {
  if (vendorKey === NEEDS_MAPPING_VENDOR_KEY) {
    return PROTOTYPE_UNCOVERED_ROWS.filter(
      (row) => row.mappingStatus !== "mapped",
    );
  }
  return PROTOTYPE_UNCOVERED_ROWS.filter(
    (row) => row.supplierId === vendorKey && row.mappingStatus === "mapped",
  );
}

export function summarizeUncoveredByVendor(): readonly PrototypeVendorSummaryRow[] {
  const summaries: PrototypeVendorSummaryRow[] = [];

  for (const vendor of PROTOTYPE_VENDORS) {
    const rows = rowsForVendorKey(vendor.id);
    if (rows.length === 0) {
      continue;
    }
    summaries.push({
      key: vendor.id,
      vendorNumber: vendor.vendorNumber,
      name: vendor.name,
      productCount: rows.length,
      totalUncovered: rows.reduce((sum, row) => sum + row.uncovered, 0),
      needsAttention: false,
    });
  }

  const unmappedRows = rowsForVendorKey(NEEDS_MAPPING_VENDOR_KEY);
  if (unmappedRows.length > 0) {
    summaries.push({
      key: NEEDS_MAPPING_VENDOR_KEY,
      vendorNumber: "—",
      name: "Needs factory mapping",
      productCount: unmappedRows.length,
      totalUncovered: unmappedRows.reduce((sum, row) => sum + row.uncovered, 0),
      needsAttention: true,
    });
  }

  return summaries;
}

export function vendorSummaryByKey(
  vendorKey: string,
): PrototypeVendorSummaryRow | undefined {
  return summarizeUncoveredByVendor().find((row) => row.key === vendorKey);
}

export function skusForVendorKeys(
  vendorKeys: readonly string[],
): readonly string[] {
  const skus: string[] = [];
  for (const key of vendorKeys) {
    for (const row of rowsForVendorKey(key)) {
      skus.push(row.sku);
    }
  }
  return skus;
}

export type PrototypeDraftResult = Readonly<{
  purchaseOrderId: string;
  documentNumber: string;
  supplierId: string;
  supplierName: string;
  lineCount: number;
}>;

let draftCounter = 44;

/** Simulates DraftPurchaseOrdersFromUncoveredSkus — one draft per vendor in selection. */
export function prototypeDraftPurchaseOrders(
  rows: readonly PrototypeUncoveredRow[],
  selectedSkus: readonly string[],
): Readonly<{
  drafts: readonly PrototypeDraftResult[];
  unmappedSkus: readonly string[];
}> {
  const selected = rows.filter((row) => selectedSkus.includes(row.sku));
  const unmappedSkus = selected
    .filter((row) => row.mappingStatus !== "mapped" || row.supplierId === null)
    .map((row) => row.sku);
  const mapped = selected.filter(
    (row) => row.mappingStatus === "mapped" && row.supplierId !== null,
  );

  const byVendor = new Map<string, PrototypeUncoveredRow[]>();
  for (const row of mapped) {
    const vendorId = row.supplierId as string;
    const bucket = byVendor.get(vendorId);
    if (bucket === undefined) {
      byVendor.set(vendorId, [row]);
    } else {
      bucket.push(row);
    }
  }

  const drafts: PrototypeDraftResult[] = [];
  for (const [supplierId, lines] of byVendor) {
    draftCounter += 1;
    const vendor = vendorById(supplierId);
    drafts.push({
      purchaseOrderId: `po-prototype-${String(draftCounter)}`,
      documentNumber: `PO-2026-${String(draftCounter).padStart(4, "0")}`,
      supplierId,
      supplierName: vendor?.name ?? supplierId,
      lineCount: lines.length,
    });
  }

  return { drafts, unmappedSkus };
}
