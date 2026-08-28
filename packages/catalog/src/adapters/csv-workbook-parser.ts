import { parse } from "csv-parse/sync";
import type {
  IWorkbookParser,
  WorkbookParseInput,
  WorkbookRow,
} from "../domain/ports/workbook-parser.js";

function decodeBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export class CsvWorkbookParser implements IWorkbookParser {
  parseSync(input: WorkbookParseInput): WorkbookRow[] {
    const text = decodeBytes(input.bytes);
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      bom: true,
      trim: true,
      cast: false,
    }) as Array<Record<string, string | undefined>>;

    return records.map((record) => {
      const row: WorkbookRow = {};
      for (const [header, value] of Object.entries(record)) {
        row[header.trim()] = value ?? "";
      }
      return row;
    });
  }

  async parse(input: WorkbookParseInput): Promise<WorkbookRow[]> {
    return this.parseSync(input);
  }
}
