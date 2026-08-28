import type {
  IWorkbookParser,
  WorkbookParseInput,
  WorkbookRow,
} from "../domain/ports/workbook-parser.js";

export class InMemoryWorkbookParser implements IWorkbookParser {
  constructor(private readonly rows: readonly WorkbookRow[] = []) {}

  async parse(_input: WorkbookParseInput): Promise<WorkbookRow[]> {
    return this.rows.map((row) => ({ ...row }));
  }
}
