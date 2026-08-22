import { describe, expect, it } from "vitest";
import { unwrapListData } from "../src/data-table/use-data-table";

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
