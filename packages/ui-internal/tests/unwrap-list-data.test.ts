import { describe, expect, it } from "vitest";
import { isListTableBusy, unwrapListData } from "../src/data-table/use-data-table";

const envelope = {
  items: [{ id: "1" }],
  page: 1,
  pageSize: 25,
  total: 1,
};

describe("unwrapListData", () => {
  it("accepts a bare list envelope", () => {
    expect(unwrapListData(envelope)).toEqual(envelope);
  });

  it("unwraps the Orval { data, status, headers } envelope", () => {
    expect(
      unwrapListData({
        data: envelope,
        status: 200,
        headers: new Headers(),
      }),
    ).toEqual(envelope);
  });
});

describe("isListTableBusy", () => {
  it("is busy before hydration so SSR HTML matches the client's first paint", () => {
    expect(isListTableBusy(false, envelope, false)).toBe(true);
    expect(isListTableBusy(false, undefined, true)).toBe(true);
  });

  it("is busy after hydration until a list envelope or error arrives", () => {
    expect(isListTableBusy(true, undefined, false)).toBe(true);
    expect(isListTableBusy(true, undefined, undefined)).toBe(true);
    expect(isListTableBusy(true, envelope, false)).toBe(false);
    expect(isListTableBusy(true, undefined, true)).toBe(false);
  });
});
