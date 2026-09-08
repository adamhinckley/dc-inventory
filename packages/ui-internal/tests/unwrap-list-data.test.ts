import { describe, expect, it } from "vitest";
import { isSuccessfulOrvalResponse } from "@dc-inventory/ui";
import {
  isListQueryFailed,
  isListTableBusy,
  unwrapListData,
} from "../src/data-table/use-data-table";

const envelope = {
  items: [{ id: "1" }],
  page: 1,
  pageSize: 25,
  total: 1,
};

describe("unwrapListData", () => {
  it("recognizes bare list envelopes and rejects other shapes", () => {
    expect(unwrapListData(undefined)).toBeUndefined();
    expect(unwrapListData({} as never)).toBeUndefined();
    expect(unwrapListData(envelope)?.total).toBe(1);
  });

  it("unwraps the Orval { data, status, headers } envelope", () => {
    expect(
      unwrapListData({
        data: envelope,
        status: 200,
        headers: new Headers(),
      })?.total,
    ).toBe(1);
  });
});

describe("isListQueryFailed", () => {
  it("treats non-2xx Orval envelopes as failed once hydrated", () => {
    const unauthorized = {
      status: 401,
      data: { error: "unauthorized" },
      headers: new Headers(),
    } as never;
    expect(isListQueryFailed(true, unauthorized)).toBe(true);
    expect(isListQueryFailed(false, unauthorized)).toBe(false);
    expect(isListTableBusy(true, undefined, isListQueryFailed(true, unauthorized))).toBe(false);
  });

  it("treats a successful empty list envelope as success", () => {
    const empty = {
      status: 200,
      data: { items: [], total: 0, page: 1, pageSize: 25 },
      headers: new Headers(),
    };
    expect(isListQueryFailed(true, empty)).toBe(false);
    expect(isSuccessfulOrvalResponse(empty)).toBe(true);
    expect(unwrapListData(empty)).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });
    expect(isListTableBusy(true, unwrapListData(empty), false)).toBe(false);
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
