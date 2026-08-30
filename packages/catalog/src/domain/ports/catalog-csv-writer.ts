export type CatalogCsvColumn = {
  key: string;
  header: string;
};

export type CatalogCsvWriteInput = {
  filename: string;
  columns: readonly CatalogCsvColumn[];
  rows: readonly Record<string, string>[];
};

export type CatalogCsvWriteResult = {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
};

export interface ICatalogCsvWriter {
  write(input: CatalogCsvWriteInput): Promise<CatalogCsvWriteResult>;
}
