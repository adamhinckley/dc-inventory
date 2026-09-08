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
  masterPackPriceCents: number;
  listPriceCents: number | null;
  originalWholesalePriceCents: number | null;
  inactive: boolean;
  discontinued: boolean;
  webWholesale: boolean;
  webRetail: boolean;
  countryOfOrigin: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  diameter: string | null;
  weight: string | null;
  weightUom: string | null;
  defaultOrderQty: number | null;
  defaultWeight: string | null;
  defaultWeightUom: string | null;
  locationCode: string | null;
  locationIsPickBin: boolean;
  vendorNumber: string | null;
  vendorName: string | null;
  supplierSku: string | null;
  upc: string | null;
  altCodes: readonly string[];
  catalogPage: string | null;
  material: string | null;
  size: string | null;
  nonStock: boolean;
  noExport: boolean;
  packLength: string | null;
  packWidth: string | null;
  packHeight: string | null;
  packWeight: string | null;
  packWeightUom: string | null;
  innerPackWeight: string | null;
  reorderMin: number | null;
  reorderMax: number | null;
  minOrderQty: number | null;
  minOrderAmountCents: number | null;
  lastPoCostCents: number | null;
  innerPackQty: number | null;
  innerPackLength: string | null;
  innerPackWidth: string | null;
  innerPackHeight: string | null;
  innerPackWeightUom: string | null;
  caseQty: number | null;
  caseLength: string | null;
  caseWidth: string | null;
  caseHeight: string | null;
  caseWeight: string | null;
  categoryNames: readonly string[];
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

function optionalDollarsToCents(raw: string): { ok: true; cents: number | null } | { ok: false } {
  const parsed = dollarsToCents(raw);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, cents: parsed.cents > 0 ? parsed.cents : null };
}

function optionalPositiveInt(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }
  const parsed = Number.parseInt(trimmed, 10);
  return { ok: true, value: parsed === 0 ? null : parsed };
}

function optionalPositiveDecimal(
  raw: string,
): { ok: true; value: string | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return { ok: false };
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: true, value: null };
  }
  return { ok: true, value: trimmed };
}

function optionalText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const PRODUCT_BROWSER_CATEGORY_HEADERS = [
  "category_1",
  "category_2",
  "category_3",
  "category_4",
  "category_5",
  "category_6",
  "category_7",
  "category_8",
  "category_9",
  "category_10",
] as const;

export function parseProductBrowserCategoryNames(row: WorkbookRow): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const header of PRODUCT_BROWSER_CATEGORY_HEADERS) {
    const name = cell(row, header);
    if (name.length === 0 || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

function validateOptionalDecimalField(
  errors: ProductBrowserRowError[],
  rowNumber: number,
  field: string,
  label: string,
  raw: string,
): { ok: true; value: string | null } | { ok: false } {
  const parsed = optionalPositiveDecimal(raw);
  if (!parsed.ok) {
    errors.push({ row: rowNumber, field, message: `${label} must be a non-negative number` });
  }
  return parsed;
}

export function mapProductBrowserRow(row: WorkbookRow, rowNumber: number): MapProductBrowserRowResult {
  const errors: ProductBrowserRowError[] = [];
  const skuRaw = cell(row, "product_id");
  const name = cell(row, "item");
  const detail = cell(row, "detail");
  const item2 = cell(row, "item2");
  const uomRaw = cell(row, "uom");
  const mpRaw = cell(row, "mp_price");
  const lpRaw = cell(row, "lp_price");
  const originalWholesaleRaw = cell(row, "original_wholesale_price");
  const vendorNumber = optionalText(cell(row, "vendor_num"));
  const vendorName = optionalText(cell(row, "vendor"));
  const supplierSku = optionalText(cell(row, "mfg_code"));
  const upc = optionalText(cell(row, "upcode"));
  const minOrderRaw = cell(row, "vendor_min_order");
  const minOrderAmtRaw = cell(row, "min_order_amt");
  const poCostRaw = cell(row, "po_cost");
  const defaultOrderQtyRaw = cell(row, "def_qty");
  const innerPackQtyRaw = cell(row, "ip_qty");
  const caseQtyRaw = cell(row, "cs_qty");
  const reorderMinRaw = cell(row, "onhand_min_qty");
  const reorderMaxRaw = cell(row, "onhand_max_qty");

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

  const masterPackPrice = dollarsToCents(mpRaw);
  if (!masterPackPrice.ok) {
    errors.push({
      row: rowNumber,
      field: "mp_price",
      message: "Master pack price must be a non-negative dollar amount",
    });
  }

  const listPrice = optionalDollarsToCents(lpRaw);
  if (!listPrice.ok) {
    errors.push({
      row: rowNumber,
      field: "lp_price",
      message: "List price must be a non-negative dollar amount",
    });
  }

  const originalWholesalePrice = optionalDollarsToCents(originalWholesaleRaw);
  if (!originalWholesalePrice.ok) {
    errors.push({
      row: rowNumber,
      field: "original_wholesale_price",
      message: "Original wholesale price must be a non-negative dollar amount",
    });
  }

  const minOrderQty = optionalPositiveInt(minOrderRaw);
  if (!minOrderQty.ok) {
    errors.push({ row: rowNumber, field: "vendor_min_order", message: "Minimum order quantity must be a whole number" });
  }

  const minOrderAmount = optionalDollarsToCents(minOrderAmtRaw);
  if (!minOrderAmount.ok) {
    errors.push({
      row: rowNumber,
      field: "min_order_amt",
      message: "Minimum order amount must be a non-negative dollar amount",
    });
  }

  const lastPoCost = optionalDollarsToCents(poCostRaw);
  if (!lastPoCost.ok) {
    errors.push({ row: rowNumber, field: "po_cost", message: "PO cost must be a non-negative dollar amount" });
  }

  const defaultOrderQty = optionalPositiveInt(defaultOrderQtyRaw);
  if (!defaultOrderQty.ok) {
    errors.push({ row: rowNumber, field: "def_qty", message: "Default order quantity must be a whole number" });
  }

  const innerPackQty = optionalPositiveInt(innerPackQtyRaw);
  if (!innerPackQty.ok) {
    errors.push({ row: rowNumber, field: "ip_qty", message: "Inner pack quantity must be a whole number" });
  }

  const caseQty = optionalPositiveInt(caseQtyRaw);
  if (!caseQty.ok) {
    errors.push({ row: rowNumber, field: "cs_qty", message: "Case quantity must be a whole number" });
  }

  const reorderMin = optionalPositiveInt(reorderMinRaw);
  if (!reorderMin.ok) {
    errors.push({
      row: rowNumber,
      field: "onhand_min_qty",
      message: "Reorder minimum must be a whole number",
    });
  }

  const reorderMax = optionalPositiveInt(reorderMaxRaw);
  if (!reorderMax.ok) {
    errors.push({
      row: rowNumber,
      field: "onhand_max_qty",
      message: "Reorder maximum must be a whole number",
    });
  }

  const packLength = validateOptionalDecimalField(errors, rowNumber, "pkg_len", "Pack length", cell(row, "pkg_len"));
  const width = validateOptionalDecimalField(errors, rowNumber, "width", "Width", cell(row, "width"));
  const height = validateOptionalDecimalField(errors, rowNumber, "height", "Height", cell(row, "height"));
  const diameter = validateOptionalDecimalField(errors, rowNumber, "diameter", "Diameter", cell(row, "diameter"));
  const weight = validateOptionalDecimalField(errors, rowNumber, "wt", "Weight", cell(row, "wt"));
  const defaultWeight = validateOptionalDecimalField(errors, rowNumber, "def_wt", "Default weight", cell(row, "def_wt"));
  const innerPackLength = validateOptionalDecimalField(errors, rowNumber, "ip_len", "Inner pack length", cell(row, "ip_len"));
  const innerPackWidth = validateOptionalDecimalField(errors, rowNumber, "ip_wid", "Inner pack width", cell(row, "ip_wid"));
  const innerPackHeight = validateOptionalDecimalField(errors, rowNumber, "ip_ht", "Inner pack height", cell(row, "ip_ht"));
  const innerPackWeight = validateOptionalDecimalField(errors, rowNumber, "ip_wt", "Inner pack weight", cell(row, "ip_wt"));
  const caseLength = validateOptionalDecimalField(errors, rowNumber, "cs_len", "Case length", cell(row, "cs_len"));
  const caseWidth = validateOptionalDecimalField(errors, rowNumber, "cs_wid", "Case width", cell(row, "cs_wid"));
  const caseHeight = validateOptionalDecimalField(errors, rowNumber, "cs_ht", "Case height", cell(row, "cs_ht"));
  const caseWeight = validateOptionalDecimalField(errors, rowNumber, "cs_wt", "Case weight", cell(row, "cs_wt"));
  const packWidth = validateOptionalDecimalField(errors, rowNumber, "pkg_wid", "Pack width", cell(row, "pkg_wid"));
  const packHeight = validateOptionalDecimalField(errors, rowNumber, "pkg_ht", "Pack height", cell(row, "pkg_ht"));
  const packWeight = validateOptionalDecimalField(errors, rowNumber, "pkg_wt", "Pack weight", cell(row, "pkg_wt"));
  const length = validateOptionalDecimalField(errors, rowNumber, "length", "Length", cell(row, "length"));

  if (vendorName !== null && vendorNumber === null) {
    errors.push({ row: rowNumber, field: "vendor_num", message: "Vendor number is required when vendor name is present" });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const description = optionalText(detail) ?? optionalText(item2);
  const uom = uomRaw.length === 0 ? DEFAULT_UOM : uomRaw;
  const altCodes = [cell(row, "alt_code"), cell(row, "alt2_code"), cell(row, "alt3_code")]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return {
    ok: true,
    value: {
      sku: skuRaw,
      name,
      description,
      uom,
      masterPackPriceCents: masterPackPrice.ok ? masterPackPrice.cents : 0,
      listPriceCents: listPrice.ok ? listPrice.cents : null,
      originalWholesalePriceCents: originalWholesalePrice.ok ? originalWholesalePrice.cents : null,
      inactive: parseWorkbookBoolean(cell(row, "inactive")),
      discontinued: parseWorkbookBoolean(cell(row, "discontin")),
      webWholesale: parseWorkbookBoolean(cell(row, "webwholesale")),
      webRetail: parseWorkbookBoolean(cell(row, "webretail")),
      countryOfOrigin: optionalText(cell(row, "c_of_o")),
      catalogPage: optionalText(cell(row, "catalog_pg_num")),
      material: optionalText(cell(row, "material")),
      size: optionalText(cell(row, "size")),
      nonStock: parseWorkbookBoolean(cell(row, "non_stock")),
      noExport: parseWorkbookBoolean(cell(row, "no_export")),
      length: length.ok ? length.value : null,
      width: width.ok ? width.value : null,
      height: height.ok ? height.value : null,
      diameter: diameter.ok ? diameter.value : null,
      weight: weight.ok ? weight.value : null,
      weightUom: optionalText(cell(row, "wt_uom")),
      defaultOrderQty: defaultOrderQty.ok ? defaultOrderQty.value : null,
      defaultWeight: defaultWeight.ok ? defaultWeight.value : null,
      defaultWeightUom: optionalText(cell(row, "def_wt_uom")),
      locationCode: optionalText(cell(row, "location")),
      locationIsPickBin: parseWorkbookBoolean(cell(row, "pickbin")),
      vendorNumber,
      vendorName,
      supplierSku,
      upc,
      altCodes,
      minOrderQty: minOrderQty.ok ? minOrderQty.value : null,
      minOrderAmountCents: minOrderAmount.ok ? minOrderAmount.cents : null,
      lastPoCostCents: lastPoCost.ok ? lastPoCost.cents : null,
      reorderMin: reorderMin.ok ? reorderMin.value : null,
      reorderMax: reorderMax.ok ? reorderMax.value : null,
      innerPackQty: innerPackQty.ok ? innerPackQty.value : null,
      innerPackLength: innerPackLength.ok ? innerPackLength.value : null,
      innerPackWidth: innerPackWidth.ok ? innerPackWidth.value : null,
      innerPackHeight: innerPackHeight.ok ? innerPackHeight.value : null,
      innerPackWeight: innerPackWeight.ok ? innerPackWeight.value : null,
      innerPackWeightUom: optionalText(cell(row, "ip_wt_uom")),
      packLength: packLength.ok ? packLength.value : null,
      packWidth: packWidth.ok ? packWidth.value : null,
      packHeight: packHeight.ok ? packHeight.value : null,
      packWeight: packWeight.ok ? packWeight.value : null,
      packWeightUom: optionalText(cell(row, "pkg_wt_uom")),
      caseQty: caseQty.ok ? caseQty.value : null,
      caseLength: caseLength.ok ? caseLength.value : null,
      caseWidth: caseWidth.ok ? caseWidth.value : null,
      caseHeight: caseHeight.ok ? caseHeight.value : null,
      caseWeight: caseWeight.ok ? caseWeight.value : null,
      categoryNames: parseProductBrowserCategoryNames(row),
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
