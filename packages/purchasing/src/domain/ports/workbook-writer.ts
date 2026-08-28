export type WorkbookRow = Record<string, string | number | Date>;

export type WorkbookFormat = "xlsx" | "csv";

export type WorkbookColumn = {
  key: string;
  header: string;
  numFmt?: string;
};

export type WorkbookWriteInput = {
  sheetName: string;
  columns: readonly WorkbookColumn[];
  rows: readonly WorkbookRow[];
  format: WorkbookFormat;
};

export type WorkbookWriteResult = {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
};

export interface IWorkbookWriter {
  write(input: WorkbookWriteInput): Promise<WorkbookWriteResult>;
}
