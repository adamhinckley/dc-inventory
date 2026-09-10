import { describe, expect, it, vi } from "vitest";
import { getInternalSupplier } from "@dc-inventory/api-client-internal";
import {
  isSupplierPoPrefixMissing,
  loadSuppliersMissingPoPrefix,
} from "./missing-supplier-po-prefix";

vi.mock("@dc-inventory/api-client-internal", () => ({
  getInternalSupplier: vi.fn(),
}));

describe("isSupplierPoPrefixMissing", () => {
  it("treats blank prefixes as missing", () => {
    expect(isSupplierPoPrefixMissing(null)).toBe(true);
    expect(isSupplierPoPrefixMissing(undefined)).toBe(true);
    expect(isSupplierPoPrefixMissing("")).toBe(true);
    expect(isSupplierPoPrefixMissing("  ")).toBe(true);
    expect(isSupplierPoPrefixMissing("HF")).toBe(false);
  });
});

describe("loadSuppliersMissingPoPrefix", () => {
  it("treats failed supplier lookups as missing prefix", async () => {
    vi.mocked(getInternalSupplier).mockResolvedValueOnce({
      status: 404,
      data: { error: "not_found" },
    } as Awaited<ReturnType<typeof getInternalSupplier>>);

    await expect(loadSuppliersMissingPoPrefix(["11111111-1111-4111-8111-111111111111"])).resolves.toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        vendorNumber: "",
        name: "Vendor",
        poPrefix: null,
      },
    ]);
  });
});
