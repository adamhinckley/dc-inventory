import { describe, expect, it } from "vitest";
import {
  supplierWriteErrorMessage,
  throwIfSupplierWriteFailed,
} from "./supplier-write-errors";

describe("supplier write errors", () => {
  it("names duplicate vendor number and PO prefix conflicts", () => {
    expect(
      supplierWriteErrorMessage({
        status: 409,
        data: { error: "duplicate_vendor_number" },
      }),
    ).toBe("Another supplier already uses this vendor number.");
    expect(
      supplierWriteErrorMessage({
        status: 409,
        data: { error: "duplicate_po_prefix" },
      }),
    ).toBe("Another supplier already uses this PO prefix.");
  });

  it("does not throw on a successful envelope", () => {
    expect(() => throwIfSupplierWriteFailed({ status: 200 })).not.toThrow();
    expect(() => {
      throwIfSupplierWriteFailed({
        status: 409,
        data: { error: "duplicate_po_prefix" },
      });
    }).toThrow("Another supplier already uses this PO prefix.");
  });
});
