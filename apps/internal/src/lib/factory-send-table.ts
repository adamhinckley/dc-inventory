export type FactorySendColumn = {
  key: string;
  header: string;
};

export type FactorySendRow = Record<string, string | number>;

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

export function formatFactorySendCell(value: string | number | undefined): string {
  if (value === undefined || value === "") {
    return "";
  }
  return String(value);
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

export function factorySendRowId(row: FactorySendRow): string {
  return String(row.mat_num ?? "line");
}
