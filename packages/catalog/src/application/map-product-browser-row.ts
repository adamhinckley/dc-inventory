import { Sku } from "@dc-inventory/shared-kernel";
import type { WorkbookRow } from "../domain/ports/workbook-parser.js";

export type ProductBrowserRowError = {
  row: number;
  field: string;
  message: string;
};

export type ProductBrowserMappedRow = {
  sku: string;
  name: string;
  description: string | null;
  uom: string;
  memberPriceCents: number;
  inactive: boolean;
  discontinued: boolean;
  webWholesale: boolean;
  taxCategoryCode: "TANGIBLE";
  vendorNumber: string | null;
  vendorName: string | null;
  supplierSku: string | null;
  minOrderQty: number | null;
  minOrderAmountCents: number | null;
  lastPoCostCents: number | null;
  caseQty: number | null;
};

export type MapProductBrowserRowResult =
  | { ok: true; value: ProductBrowserMappedRow }
  | { ok: false; errors: ProductBrowserRowError[] };

const DEFAULT_UOM = "EA";

export function cell(row: WorkbookRow, key: string): string {
  const direct = row[key];
  if (direct !== undefined) {
    return direct.trim();
  }
  const lower = key.toLowerCase();
  for (const [header, value] of Object.entries(row)) {
    if (header.trim().toLowerCase() === lower) {
      return value.trim();
    }
  }
  return "";
}

export function parseWorkbookBoolean(raw: string): boolean {
  const normalized = raw.trim().toUpperCase();
  return normalized === "TRUE" || normalized === "T" || normalized === "YES" || normalized === "1";
}

/**
 * Convert a decimal dollar string to integer cents. Empty becomes 0.
 * Rounds half-up on the third fractional digit so 2.3808 becomes 238.
 */
export function dollarsToCents(raw: string): { ok: true; cents: number } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, cents: 0 };
  }
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    return { ok: false };
  }
  const whole = match[1];
  const fraction = match[2] ?? "";
  if (whole === undefined) {
    return { ok: false };
  }
  const padded = `${fraction}000`.slice(0, 3);
  const centsPart = padded.slice(0, 2);
  const roundDigit = padded.slice(2, 3);
  let cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(centsPart, 10);
  if (Number.parseInt(roundDigit, 10) >= 5) {
    cents += 1;
  }
  return { ok: true, cents };
}

function optionalPositiveInt(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === "0") {
    return { ok: true, value: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }
  return { ok: true, value: Number.parseInt(trimmed, 10) };
}

function optionalText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function mapProductBrowserRow(row: WorkbookRow, rowNumber: number): MapProductBrowserRowResult {
  const errors: ProductBrowserRowError[] = [];
  const skuRaw = cell(row, "product_id");
  const name = cell(row, "item");
  const detail = cell(row, "detail");
  const item2 = cell(row, "item2");
  const uomRaw = cell(row, "uom");
  const mpRaw = cell(row, "mp_price");
  const vendorNumber = optionalText(cell(row, "vendor_num"));
  const vendorName = optionalText(cell(row, "vendor"));
  const supplierSku = optionalText(cell(row, "mfg_code"));
  const minOrderRaw = cell(row, "vendor_min_order");
  const minOrderAmtRaw = cell(row, "min_order_amt");
  const poCostRaw = cell(row, "po_cost");
  const caseQtyRaw = cell(row, "cs_qty");

  if (skuRaw.length === 0) {
    errors.push({ row: rowNumber, field: "product_id", message: "SKU is required" });
  } else {
    try {
      Sku.parse(skuRaw);
    } catch {
      errors.push({
        row: rowNumber,
        field: "product_id",
        message: "SKU must start with alphanumeric and contain only letters, digits, . _ : -",
      });
    }
  }

  if (name.length === 0) {
    errors.push({ row: rowNumber, field: "item", message: "Name is required" });
  }

  const memberPrice = dollarsToCents(mpRaw);
  if (!memberPrice.ok) {
    errors.push({ row: rowNumber, field: "mp_price", message: "Member price must be a non-negative dollar amount" });
  }

  const minOrderQty = optionalPositiveInt(minOrderRaw);
  if (!minOrderQty.ok) {
    errors.push({ row: rowNumber, field: "vendor_min_order", message: "Minimum order quantity must be a whole number" });
  }

  const minOrderAmount = dollarsToCents(minOrderAmtRaw);
  if (!minOrderAmount.ok) {
    errors.push({
      row: rowNumber,
      field: "min_order_amt",
      message: "Minimum order amount must be a non-negative dollar amount",
    });
  }

  const lastPoCost = dollarsToCents(poCostRaw);
  if (!lastPoCost.ok) {
    errors.push({ row: rowNumber, field: "po_cost", message: "PO cost must be a non-negative dollar amount" });
  }

  const caseQty = optionalPositiveInt(caseQtyRaw);
  if (!caseQty.ok) {
    errors.push({ row: rowNumber, field: "cs_qty", message: "Case quantity must be a whole number" });
  }

  if (vendorName !== null && vendorNumber === null) {
    errors.push({ row: rowNumber, field: "vendor_num", message: "Vendor number is required when vendor name is present" });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const description = optionalText(detail) ?? optionalText(item2);
  const uom = uomRaw.length === 0 ? DEFAULT_UOM : uomRaw;

  return {
    ok: true,
    value: {
      sku: skuRaw,
      name,
      description,
      uom,
      memberPriceCents: memberPrice.ok ? memberPrice.cents : 0,
      inactive: parseWorkbookBoolean(cell(row, "inactive")),
      discontinued: parseWorkbookBoolean(cell(row, "discontin")),
      webWholesale: parseWorkbookBoolean(cell(row, "webwholesale")),
      taxCategoryCode: "TANGIBLE",
      vendorNumber,
      vendorName,
      supplierSku,
      minOrderQty: minOrderQty.ok ? minOrderQty.value : null,
      minOrderAmountCents: minOrderAmount.ok && minOrderAmount.cents > 0 ? minOrderAmount.cents : null,
      lastPoCostCents: lastPoCost.ok && lastPoCost.cents > 0 ? lastPoCost.cents : null,
      caseQty: caseQty.ok ? caseQty.value : null,
    },
  };
}

export const PRODUCT_BROWSER_REQUIRED_HEADERS = [
  "product_id",
  "item",
  "vendor_num",
  "vendor",
] as const;

export function missingProductBrowserHeaders(row: WorkbookRow | undefined): string[] {
  if (row === undefined) {
    return [...PRODUCT_BROWSER_REQUIRED_HEADERS];
  }
  const keys = new Set(Object.keys(row).map((key) => key.trim().toLowerCase()));
  return PRODUCT_BROWSER_REQUIRED_HEADERS.filter((header) => !keys.has(header));
}
