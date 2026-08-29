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

function looksLikeOleCompound(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}

export class CsvWorkbookParser implements IWorkbookParser {
  parseSync(input: WorkbookParseInput): WorkbookRow[] {
    if (looksLikeOleCompound(input.bytes)) {
      throw new Error("Workbook is not a valid CSV");
    }
    let records: Array<Record<string, string | undefined>>;
    try {
      records = parse(decodeBytes(input.bytes), {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
        bom: true,
        trim: true,
        cast: false,
      }) as Array<Record<string, string | undefined>>;
    } catch {
      throw new Error("Workbook is not a valid CSV");
    }

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
