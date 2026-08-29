import { describe, expect, it } from "vitest";
import { CsvWorkbookParser } from "../src/adapters/csv-workbook-parser.js";

describe("CsvWorkbookParser", () => {
  it("parses Product Browser headers and quoted names", async () => {
    const csv = [
      "product_id,item,vendor_num,vendor,mp_price",
      'DC1,"Styrofoam Sheet 2""x12""",1018,FloraCraft,6.75',
    ].join("\n");
    const rows = await new CsvWorkbookParser().parse({
      bytes: new TextEncoder().encode(csv),
      filename: "products.csv",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.product_id).toBe("DC1");
    expect(rows[0]?.item).toContain("Styrofoam");
    expect(rows[0]?.vendor).toBe("FloraCraft");
  });

  it("returns no data rows when the CSV has headers only", async () => {
    const csv = "product_id,item,vendor_num,vendor\n";
    const rows = await new CsvWorkbookParser().parse({
      bytes: new TextEncoder().encode(csv),
      filename: "products.csv",
    });
    expect(rows).toEqual([]);
  });

  it("rejects Excel binary bytes instead of throwing a parser internals error", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 1, 2, 3]);
    await expect(
      new CsvWorkbookParser().parse({
        bytes: ole,
        filename: "products.xls",
        contentType: "application/vnd.ms-excel",
      }),
    ).rejects.toThrow("not a valid CSV");
  });
});
