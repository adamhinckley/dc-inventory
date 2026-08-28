import type {
  IWorkbookWriter,
  WorkbookWriteInput,
  WorkbookWriteResult,
} from "../domain/ports/workbook-writer.js";

export type CapturedWorkbookWrite = WorkbookWriteInput & {
  result: WorkbookWriteResult;
};

/**
 * Test fake: records writes and returns deterministic bytes without parsing XLSX/CSV.
 */
export class InMemoryWorkbookWriter implements IWorkbookWriter {
  readonly writes: CapturedWorkbookWrite[] = [];

  async write(input: WorkbookWriteInput): Promise<WorkbookWriteResult> {
    const contentType =
      input.format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv";
    const extension = input.format === "xlsx" ? "xlsx" : "csv";
    const filename = `${input.sheetName}.${extension}`;
    const payload = JSON.stringify({
      sheetName: input.sheetName,
      columns: input.columns,
      rows: input.rows,
      format: input.format,
    });
    const result: WorkbookWriteResult = {
      bytes: new TextEncoder().encode(payload),
      contentType,
      filename,
    };
    this.writes.push({ ...input, result });
    return result;
  }
}
