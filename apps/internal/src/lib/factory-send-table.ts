export type FactorySendColumn = {
  key: string;
  header: string;
};

export type FactorySendRow = Record<string, string | number | boolean>;

const COLUMN_WIDTH: Record<string, number> = {
  ship_date: 110,
  canc_date: 110,
  mat_num: 140,
  quan: 80,
  price: 80,
  extprice: 90,
  mfg_code: 120,
  mfg_sku: 110,
  mfg_upc: 120,
  product_upc_1: 130,
  cs_cube_metric: 130,
  tot_cartons: 110,
  tot_cbm: 130,
};

export const FACTORY_SEND_NO_CASE_QTY_LABEL = "No case qty";

export const FACTORY_SEND_ENTER_CASE_QTY_HINT =
  "Enter case quantity so tot_cartons can be calculated";

export function formatFactorySendCell(value: string | number | boolean | undefined): string {
  if (value === undefined || value === "" || typeof value === "boolean") {
    return "";
  }
  return String(value);
}

export function factorySendRowBlocksCartons(row: FactorySendRow): boolean {
  return row.blocks_tot_cartons === true;
}

export function factorySendBlockedSkus(rows: readonly FactorySendRow[]): ReadonlySet<string> {
  return new Set(
    rows.filter(factorySendRowBlocksCartons).map((row) => String(row.mat_num ?? "")),
  );
}

export function factorySendTableColumns(columns: readonly FactorySendColumn[]) {
  return columns.map((column) => ({
    id: column.key,
    label: column.header,
    sort: false as const,
    width: COLUMN_WIDTH[column.key],
    render: ({ record }: { record: FactorySendRow }) =>
      formatFactorySendCell(record[column.key]),
  }));
}

export function missingCaseQtyRowElementId(sku: string): string {
  return `po-line-missing-case-qty-${sku}`;
}

export function firstBlockedSku(rows: readonly FactorySendRow[]): string | null {
  for (const row of rows) {
    if (!factorySendRowBlocksCartons(row)) {
      continue;
    }
    const sku = String(row.mat_num ?? "");
    if (sku.length > 0) {
      return sku;
    }
  }
  return null;
}

export function factorySendRowId(row: FactorySendRow): string {
  return String(row.mat_num ?? "line");
}

export function factorySendRowClassName(row: FactorySendRow): string | undefined {
  return factorySendRowBlocksCartons(row) ? "bg-warning/25" : undefined;
}
