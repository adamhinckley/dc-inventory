import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";
import type {
  IWorkbookWriter,
  WorkbookWriteInput,
  WorkbookWriteResult,
} from "../domain/ports/workbook-writer.js";

export class ExcelJsWorkbookWriter implements IWorkbookWriter {
  async write(input: WorkbookWriteInput): Promise<WorkbookWriteResult> {
    if (input.format === "csv") {
      const records = input.rows.map((row) =>
        Object.fromEntries(input.columns.map((column) => [column.header, row[column.key] ?? ""])),
      );
      const csv = stringify(records, {
        header: true,
        columns: input.columns.map((column) => column.header),
      });
      return {
        bytes: new TextEncoder().encode(csv),
        contentType: "text/csv",
        filename: `${input.sheetName}.csv`,
      };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(input.sheetName);
    sheet.columns = input.columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: Math.max(column.header.length, 12),
    }));
    for (const row of input.rows) {
      sheet.addRow(row);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return {
      bytes,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${input.sheetName}.xlsx`,
    };
  }
}
