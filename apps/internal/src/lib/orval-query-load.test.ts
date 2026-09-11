import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSuccessfulOrvalResponse } from "@dc-inventory/ui";
import {
  orvalBillToLoadFailed,
  orvalBillToMissing,
  orvalDetailViewError,
  orvalEnvelopeFailed,
  orvalQueryFailed,
} from "./orval-query-load";

const serverError = {
  status: 500,
  data: { error: "internal_error", message: "An unexpected error occurred." },
  headers: new Headers(),
};

const notFound = {
  status: 404,
  data: { error: "not_found" },
  headers: new Headers(),
};

const okEntity = {
  status: 200,
  data: { id: "cust-1" },
  headers: new Headers(),
};

describe("orvalEnvelopeFailed / orvalQueryFailed", () => {
  it("treats a 500 Orval envelope as failed even when isError is false", () => {
    expect(isSuccessfulOrvalResponse(serverError)).toBe(false);
    expect(orvalEnvelopeFailed(serverError)).toBe(true);
    expect(orvalQueryFailed({ data: serverError, isError: false })).toBe(true);
  });

  it("does not treat a missing envelope as a failed load", () => {
    expect(orvalEnvelopeFailed(undefined)).toBe(false);
    expect(orvalQueryFailed({ data: undefined, isError: false })).toBe(false);
  });

  it("treats React Query isError as failed", () => {
    expect(orvalQueryFailed({ data: undefined, isError: true })).toBe(true);
  });

  it("does not treat a 200 envelope as failed", () => {
    expect(orvalQueryFailed({ data: okEntity, isError: false })).toBe(false);
  });
});

describe("orvalDetailViewError", () => {
  it("surfaces a 500 envelope as a load error so DetailView is not Not found", () => {
    const error = orvalDetailViewError({ data: serverError, isError: false });
    expect(error).toBeTruthy();
    expect(error).toBe(serverError);
  });

  it("leaves 404 unset so DetailView can render Not found", () => {
    expect(orvalDetailViewError({ data: notFound, isError: false })).toBeUndefined();
  });

  it("leaves a successful GET unset", () => {
    expect(orvalDetailViewError({ data: okEntity, isError: false })).toBeUndefined();
  });
});

describe("orvalBillToLoadFailed", () => {
  it("treats 404 as empty, not a load failure", () => {
    expect(orvalBillToMissing(notFound)).toBe(true);
    expect(orvalBillToLoadFailed({ data: notFound, isError: false })).toBe(false);
  });

  it("treats a 500 envelope as a load failure", () => {
    expect(orvalBillToMissing(serverError)).toBe(false);
    expect(orvalBillToLoadFailed({ data: serverError, isError: false })).toBe(true);
  });
});

describe("detail page wiring", () => {
  it.each([
    "../components/supplier-detail-page.tsx",
    "../components/customer-detail-page.tsx",
  ])("uses orvalDetailViewError instead of query.isError alone in %s", (rel) => {
    const source = readFileSync(new URL(rel, import.meta.url), "utf8");
    expect(source).toContain("orvalDetailViewError");
    expect(source).not.toContain("error={query.isError ? query.error : undefined}");
  });
});

describe("customer child list wiring", () => {
  it.each([
    "../components/customer-certificates-panel.tsx",
    "../components/customer-ship-tos-panel.tsx",
    "../components/customer-contacts-panel.tsx",
  ])("passes orvalQueryFailed into useTable isError in %s", (rel) => {
    const source = readFileSync(new URL(rel, import.meta.url), "utf8");
    expect(source).toContain("orvalQueryFailed");
    expect(source).toMatch(/isError:\s*orvalQueryFailed/);
  });

  it("treats bill-to 500 as a load error, not empty success", () => {
    const source = readFileSync(
      new URL("../components/customer-bill-to-panel.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("orvalBillToLoadFailed");
    expect(source).toContain("BILL_TO_LOAD_ERROR");
  });
});
