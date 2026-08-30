import type {
  CatalogCsvWriteInput,
  CatalogCsvWriteResult,
  ICatalogCsvWriter,
} from "../domain/ports/catalog-csv-writer.js";

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export class InMemoryCatalogCsvWriter implements ICatalogCsvWriter {
  last: CatalogCsvWriteResult | null = null;

  async write(input: CatalogCsvWriteInput): Promise<CatalogCsvWriteResult> {
    const lines = [
      input.columns.map((column) => escapeCell(column.header)).join(","),
      ...input.rows.map((row) =>
        input.columns.map((column) => escapeCell(row[column.key] ?? "")).join(","),
      ),
    ];
    const result = {
      bytes: new TextEncoder().encode(`${lines.join("\n")}\n`),
      contentType: "text/csv; charset=utf-8",
      filename: input.filename,
    };
    this.last = result;
    return result;
  }
}
