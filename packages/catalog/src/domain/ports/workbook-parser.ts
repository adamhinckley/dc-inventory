export type WorkbookRow = Record<string, string>;

export type WorkbookParseInput = {
  bytes: Uint8Array;
  filename?: string;
  contentType?: string;
};

export interface IWorkbookParser {
  parse(input: WorkbookParseInput): Promise<WorkbookRow[]>;
}
