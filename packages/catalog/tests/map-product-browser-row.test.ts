import { describe, expect, it } from "vitest";
import { dollarsToCents, mapProductBrowserRow } from "../src/application/map-product-browser-row.js";

function row(overrides: Record<string, string> = {}) {
  return {
    product_id: "DC10274LTGD",
    item: "31” Crystal Drop Branch",
    detail: "",
    item2: "",
    mp_price: "10.2",
    uom: "IN",
    inactive: "FALSE",
    discontin: "FALSE",
    webwholesale: "TRUE",
    vendor_num: "1075",
    vendor: "REGXJ",
    mfg_code: "JA149015",
    vendor_min_order: "0",
    min_order_amt: "0",
    po_cost: "3.57",
    cs_qty: "192",
    onhand_qty: "199",
    ...overrides,
  };
}

describe("mapProductBrowserRow", () => {
  it("converts money, booleans, and defaults while ignoring inventory qty columns", () => {
    const mapped = mapProductBrowserRow(row(), 2);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) {
      return;
    }
    expect(mapped.value.memberPriceCents).toBe(1020);
    expect(mapped.value.lastPoCostCents).toBe(357);
    expect(mapped.value.webWholesale).toBe(true);
    expect(mapped.value.minOrderQty).toBeNull();
    expect(mapped.value).not.toHaveProperty("onHand");
    expect(mapped.value).not.toHaveProperty("onhand_qty");
  });

  it("defaults empty UOM to EA", () => {
    const mapped = mapProductBrowserRow(row({ uom: "" }), 2);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value.uom).toBe("EA");
    }
  });

  it("allows products with no vendor", () => {
    const mapped = mapProductBrowserRow(row({ vendor_num: "", vendor: "" }), 2);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value.vendorNumber).toBeNull();
      expect(mapped.value.vendorName).toBeNull();
    }
  });

  it("rejects invalid SKUs and empty names with row-addressable errors", () => {
    const invalidSku = mapProductBrowserRow(row({ product_id: "CANCELLATION~~FEE", item: "" }), 3);
    expect(invalidSku.ok).toBe(false);
    if (!invalidSku.ok) {
      expect(invalidSku.errors.map((error) => error.field).sort()).toEqual(["item", "product_id"]);
      expect(invalidSku.errors.every((error) => error.row === 3)).toBe(true);
    }

    const spacedSku = mapProductBrowserRow(row({ product_id: "SB2412G180 -1" }), 10);
    expect(spacedSku.ok).toBe(false);
    if (!spacedSku.ok) {
      expect(spacedSku.errors[0]?.field).toBe("product_id");
    }
  });

  it("treats empty or zero case quantity as missing", () => {
    const empty = mapProductBrowserRow(row({ cs_qty: "" }), 2);
    expect(empty.ok).toBe(true);
    if (empty.ok) {
      expect(empty.value.caseQty).toBeNull();
    }
    const zero = mapProductBrowserRow(row({ cs_qty: "0" }), 2);
    expect(zero.ok).toBe(true);
    if (zero.ok) {
      expect(zero.value.caseQty).toBeNull();
    }
    const paddedZero = mapProductBrowserRow(row({ cs_qty: "00", vendor_min_order: "000" }), 2);
    expect(paddedZero.ok).toBe(true);
    if (paddedZero.ok) {
      expect(paddedZero.value.caseQty).toBeNull();
      expect(paddedZero.value.minOrderQty).toBeNull();
    }
  });

  it("maps case inches and treats empty or zero as missing", () => {
    const empty = mapProductBrowserRow(row({ cs_len: "", cs_wid: "0", cs_ht: "0.0" }), 2);
    expect(empty.ok).toBe(true);
    if (empty.ok) {
      expect(empty.value.caseLength).toBeNull();
      expect(empty.value.caseWidth).toBeNull();
      expect(empty.value.caseHeight).toBeNull();
    }

    const invalid = mapProductBrowserRow(row({ cs_len: "wide" }), 4);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors).toEqual([
        { row: 4, field: "cs_len", message: "Case length must be a non-negative number" },
      ]);
    }
  });

  it("rounds fractional dollars to integer cents", () => {
    expect(dollarsToCents("2.3808")).toEqual({ ok: true, cents: 238 });
    expect(dollarsToCents("10.35")).toEqual({ ok: true, cents: 1035 });
    expect(dollarsToCents("")).toEqual({ ok: true, cents: 0 });
    expect(dollarsToCents("-1")).toEqual({ ok: false });
  });
});
